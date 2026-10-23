"""
test_liveshield_phase2.py — Test suite for TraceAcc LiveShield Phase 2 (Real-Time Fraud Detection & Decisioning).
"""
import pytest
import asyncio
import time
from datetime import datetime, timezone, timedelta
from decimal import Decimal

from services.liveshield.stream import LiveShieldStreamBroker
from services.liveshield.screening import FastScreeningEngine, AccountRollingStats
from services.liveshield.graph_worker import RollingGraphInferenceWorker, AccountRiskCache
from services.liveshield.decision_engine import DecisionEngine, HeldTransactionQueue
from services.liveshield.evaluator import DualEvaluationEngine
from services.liveshield.engine import SimulationEngine


@pytest.mark.asyncio
async def test_stream_broker_decoupling_and_sequence_reordering():
    broker = LiveShieldStreamBroker(simulation_id=1, max_queue_size=100)
    
    # Ingest sequence items out of order
    await broker.publish_transaction({
        "transaction_id": "T2",
        "sequence_id": "SEQ_01",
        "step_index": 1,
        "amount": Decimal("100.00"),
        "sender_account": "ACC_1",
        "receiver_account": "ACC_2",
    })
    await broker.publish_transaction({
        "transaction_id": "T1",
        "sequence_id": "SEQ_01",
        "step_index": 0,
        "amount": Decimal("100.00"),
        "sender_account": "ACC_1",
        "receiver_account": "ACC_2",
    })
    
    # Retrieve from graph queue
    assert not broker.graph_queue.empty()
    item1 = broker.graph_queue.get_nowait()
    item2 = broker.graph_queue.get_nowait()
    
    # Verify sequence step 0 was processed before step 1
    assert item1["transaction_id"] == "T1"
    assert item2["transaction_id"] == "T2"
    await broker.close()


def test_fast_screening_rules_and_velocity():
    screening = FastScreeningEngine()
    now = datetime.now(timezone.utc)

    # 1. Normal transaction
    score1, signals1 = screening.screen_transaction({
        "transaction_id": "T_NORM",
        "sender_account": "ACC_SENDER",
        "receiver_account": "ACC_RECV",
        "amount": Decimal("50.00"),
        "timestamp": now,
    })
    assert score1 < 0.30

    # 2. Large transaction + CTR Structuring amount
    score2, signals2 = screening.screen_transaction({
        "transaction_id": "T_LARGE",
        "sender_account": "ACC_WHALE",
        "receiver_account": "ACC_TARGET",
        "amount": Decimal("9500.00"),
        "timestamp": now,
    })
    assert score2 > 0.40
    rule_ids = [s["rule_id"] for s in signals2]
    assert "R01_CTR_STRUCTURING" in rule_ids


def test_account_risk_cache_freshness():
    cache = AccountRiskCache(ttl_seconds=1.0)
    cache.update_scores(
        prob_map={"ACC_FRAUD_1": 0.92},
        disguise_map={"ACC_FRAUD_1": 0.15},
        paths_map={"ACC_FRAUD_1": [["ACC_FRAUD_1", "ACC_TARGET"]]},
        model_version="dclcg_v1",
        graph_version=1,
    )

    # Immediate lookup
    entry = cache.get_account_risk("ACC_FRAUD_1")
    assert entry is not None
    assert entry["illicit_prob"] == 0.92
    assert entry["model_version"] == "dclcg_v1"
    assert not entry["is_stale"]


@pytest.mark.asyncio
async def test_graph_worker_model_artifact_loading():
    cache = AccountRiskCache()
    queue = asyncio.Queue()
    worker = RollingGraphInferenceWorker(simulation_id=1, graph_queue=queue, risk_cache=cache, max_graph_size=50)

    # Worker initializes with model version
    assert "dclcg" in worker.model_version_str
    
    # Ingest transactions
    for i in range(10):
        worker._add_to_rolling_graph({
            "transaction_id": f"TXN_{i}",
            "sender_account": f"ACC_{i}",
            "receiver_account": f"ACC_{i+1}",
            "amount": Decimal("500.00"),
            "timestamp": datetime.now(timezone.utc),
        })
    
    telemetry = worker.get_telemetry()
    assert telemetry["rolling_graph_nodes"] >= 10
    assert telemetry["rolling_graph_edges"] >= 10


def test_decision_engine_modes_and_calibration():
    # 1. Test calibration Platt scaling
    de_shadow = DecisionEngine(detection_mode="shadow")
    low_calib = de_shadow.calibrate_score(0.05)
    high_calib = de_shadow.calibrate_score(0.95)
    assert low_calib < 0.20
    assert high_calib > 0.80

    # 2. Test Mode A (Shadow)
    txn = {
        "simulation_id": 1,
        "transaction_id": "TXN_SHADOW_01",
        "sender_account": "ACC_A",
        "receiver_account": "ACC_B",
        "amount": Decimal("1000.00"),
        "timestamp": datetime.now(timezone.utc),
        "synthetic_ground_truth": "fraudulent",
        "scenario_id": "F01",
    }
    screen_res = {"fast_score": 0.88, "signals": [{"rule_id": "TEST", "score": 0.88}]}
    dec_shadow = de_shadow.evaluate_decision(txn, screen_res)
    assert dec_shadow["detection_mode"] == "shadow"
    assert dec_shadow["initial_decision"] == "APPROVE"  # Always approves in shadow
    assert dec_shadow["hypothetical_decision"] in ("HOLD", "REJECT")
    assert dec_shadow["evaluation_label"] == "TRUE_POSITIVE"

    # 3. Test Mode B (Assisted) with Held Queue
    de_assisted = DecisionEngine(detection_mode="assisted")
    dec_assisted = de_assisted.evaluate_decision(txn, screen_res)
    assert dec_assisted["initial_decision"] in ("HOLD", "REJECT")
    if dec_assisted["initial_decision"] == "HOLD":
        assert de_assisted.held_queue.count() == 1
        resolved = de_assisted.held_queue.resolve("TXN_SHADOW_01", "MANUAL_APPROVE", operator_user_id=1, notes="Verified")
        assert resolved["final_decision"] == "APPROVE"
        assert resolved["operator_action"] == "MANUAL_APPROVE"
        assert de_assisted.held_queue.count() == 0


def test_dual_evaluation_engine_metrics():
    evaluator = DualEvaluationEngine(simulation_id=1)
    
    # Ingest 1 TP (fraud detected)
    evaluator.record_decision({
        "synthetic_ground_truth": "fraudulent",
        "scenario_id": "F01",
        "sequence_id": "SEQ_F01_1",
        "final_decision": "REJECT",
        "combined_risk_score": 0.95,
        "latency_screening_ms": 0.45,
        "latency_total_ms": 0.65,
    })
    # Ingest 1 TN (legitimate approved)
    evaluator.record_decision({
        "synthetic_ground_truth": "legitimate",
        "scenario_id": "LEGITIMATE",
        "final_decision": "APPROVE",
        "combined_risk_score": 0.05,
        "latency_screening_ms": 0.30,
        "latency_total_ms": 0.40,
    })
    # Ingest 1 FP (legitimate falsely flagged)
    evaluator.record_decision({
        "synthetic_ground_truth": "legitimate",
        "scenario_id": "LEGITIMATE",
        "final_decision": "FLAG",
        "combined_risk_score": 0.50,
        "latency_screening_ms": 0.35,
        "latency_total_ms": 0.45,
    })

    summary = evaluator.get_summary()
    assert summary["total_transactions"] == 3
    assert summary["true_positives"] == 1
    assert summary["true_negatives"] == 1
    assert summary["false_positives"] == 1
    assert summary["false_negatives"] == 0
    assert summary["precision"] == 0.5
    assert summary["recall"] == 1.0
    assert summary["network_true_positives"] == 1
    assert summary["latency_screening_p50"] > 0.0
    assert "F01" in summary["scenario_metrics"]


@pytest.mark.asyncio
async def test_end_to_end_100_tps_simulation_acceptance():
    config = {
        "mode": "basic",
        "target_tps": 100.0,
        "total_transactions": 150,
        "traffic_composition": "mixed",
        "legitimate_percentage": 80.0,
        "fraudulent_percentage": 20.0,
        "selected_scenarios": ["F01", "F02", "F03"],
        "detection_mode": "automated",
        "detection_config": {
            "flag_threshold": 0.40,
            "hold_threshold": 0.65,
            "reject_threshold": 0.85,
        },
    }

    engine = SimulationEngine(simulation_id=999, config=config)
    await engine.start()
    
    # Wait for completion (150 txns at 100 TPS is ~1.5s)
    for _ in range(80):
        if engine.status in ("COMPLETED", "STOPPED", "FAILED"):
            break
        await asyncio.sleep(0.05)

    assert engine.total_generated >= 150
    assert engine.status == "COMPLETED"
    
    stats = engine.get_stats()
    assert stats["total_legitimate"] > 0
    assert stats["total_fraudulent"] > 0
    assert stats["evaluation"]["total_transactions"] >= 150
    assert stats["evaluation"]["latency_screening_p50"] < 10.0  # sub-10ms fast screening
    await engine.stop()
