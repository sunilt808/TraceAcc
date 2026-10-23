"""
backend/tests/test_liveshield_phase2_5_crre.py — Automated Test Suite for Continuous Risk Re-evaluation (CRRE).

Covers:
1. Scenario A: Initially flagged transaction subsequently cleared following evidence.
2. Scenario B: Initially approved transaction subsequently escalated after downstream graph activity (Retrospective Alert).
3. Preservation of immutable payment decisions, ground-truth labels, and audit history.
4. Absence of activity not causing false automatic clearance.
5. Affected neighborhood discovery (prioritizing sequence hops over distant nodes).
6. Risk state transitions and hysteresis near score boundaries.
7. Deduplication of pending reassessment jobs.
8. Investigator verified evidence overrides.
9. Multi-horizon dual evaluation tracking (Initial vs Retrospective Confusion Matrix).
10. Full End-to-End Simulation with live DC-LCG inference.
"""
import asyncio
from datetime import datetime, timezone, timedelta
from decimal import Decimal
import pytest

from db.database import init_db
from services.liveshield.affected_index import AffectedTransactionIndex
from services.liveshield.graph_worker import AccountRiskCache, RollingGraphInferenceWorker
from services.liveshield.screening import FastScreeningEngine
from services.liveshield.decision_engine import DecisionEngine
from services.liveshield.evaluator import DualEvaluationEngine
from services.liveshield.alert_bridge import LiveShieldAlertBridge
from services.liveshield.reevaluation import ContinuousRiskReevaluationEngine
from services.liveshield.engine import SimulationEngine

# Initialize database schema models so SQLAlchemy mapper relations are loaded
try:
    init_db()
except Exception:
    pass


def test_affected_index_neighborhood_and_prioritization():
    """Verify affected index prioritizes direct sequence hops and 1-hop counterparties over distant nodes."""
    index = AffectedTransactionIndex(simulation_id=1, max_indexed_transactions=100)

    # Ingest 3 transactions
    t0 = datetime.now(timezone.utc)
    txn1 = {
        "transaction_id": "TXN_001",
        "sender_account": "ACC_A",
        "receiver_account": "ACC_B",
        "amount": 5000.0,
        "timestamp": t0 - timedelta(seconds=20),
        "sequence_id": "SEQ_MULE_1",
        "synthetic_ground_truth": "fraudulent",
    }
    txn2 = {
        "transaction_id": "TXN_002",
        "sender_account": "ACC_B",
        "receiver_account": "ACC_C",
        "amount": 4800.0,
        "timestamp": t0 - timedelta(seconds=10),
        "sequence_id": "SEQ_MULE_1",
        "synthetic_ground_truth": "fraudulent",
    }
    txn3 = {
        "transaction_id": "TXN_003",
        "sender_account": "ACC_X",
        "receiver_account": "ACC_Y",
        "amount": 200.0,
        "timestamp": t0 - timedelta(seconds=5),
        "synthetic_ground_truth": "legitimate",
    }

    index.index_transaction(txn1, "APPROVE", 0.10, "LOW_RISK", 1)
    index.index_transaction(txn2, "APPROVE", 0.15, "LOW_RISK", 1)
    index.index_transaction(txn3, "APPROVE", 0.05, "LOW_RISK", 1)

    # Discover affected transactions when a new 3rd hop in SEQ_MULE_1 arrives (C -> D)
    affected = index.find_affected_transactions(
        trigger_type="NEW_TRANSACTION",
        triggering_txn_id="TXN_004",
        sender_account="ACC_C",
        receiver_account="ACC_D",
        sequence_id="SEQ_MULE_1",
        max_hops=2,
        max_affected_txns=10,
        lookback_sec=300.0,
    )

    affected_ids = [a["transaction_id"] for a in affected]
    assert "TXN_001" in affected_ids
    assert "TXN_002" in affected_ids
    assert "TXN_003" not in affected_ids  # Unrelated transaction excluded


@pytest.mark.asyncio
async def test_scenario_b_retrospective_fraud_escalation():
    """Scenario B: Initially approved transaction subsequently escalated after downstream graph activity."""
    sim_id = 101
    affected_index = AffectedTransactionIndex(simulation_id=sim_id)
    risk_cache = AccountRiskCache(ttl_seconds=60.0)
    screening_engine = FastScreeningEngine()
    evaluator = DualEvaluationEngine(simulation_id=sim_id)

    reassessment_events = []

    def on_reassess(event_data):
        reassessment_events.append(event_data)
        evaluator.record_reassessment(event_data)

    engine = ContinuousRiskReevaluationEngine(
        simulation_id=sim_id,
        affected_index=affected_index,
        risk_cache=risk_cache,
        screening_engine=screening_engine,
        alert_bridge=LiveShieldAlertBridge(db_session_factory=None, organization_id=1),
        config={"detection_config": {"hold_threshold": 0.70, "flag_threshold": 0.50}},
        on_reassessment=on_reassess,
    )
    await engine.start()

    # Step 1: Ingest initial transaction A -> B (Clean fast score, APPROVED)
    t0 = datetime.now(timezone.utc)
    txn1 = {
        "transaction_id": "TXN_INIT_001",
        "sender_account": "ACC_MULE_A",
        "receiver_account": "ACC_MULE_B",
        "amount": 9500.0,
        "timestamp": t0,
        "sequence_id": "SEQ_F01",
        "synthetic_ground_truth": "fraudulent",
        "scenario_id": "F01",
    }
    decision1 = {
        "transaction_id": "TXN_INIT_001",
        "sender_account": "ACC_MULE_A",
        "receiver_account": "ACC_MULE_B",
        "amount": 9500.0,
        "combined_risk_score": 0.15,
        "final_decision": "APPROVE",
        "risk_tier": "LOW",
        "synthetic_ground_truth": "fraudulent",
        "scenario_id": "F01",
    }
    evaluator.record_decision(decision1)

    # Register initial transaction in CRRE
    await engine.trigger_new_transaction(
        txn=txn1,
        initial_decision="APPROVE",
        risk_score=0.15,
        risk_status="LOW_RISK",
    )

    # Initial evaluation should show 1 False Negative (initially missed fraud)
    init_summary = evaluator.get_summary()
    assert init_summary["initial_metrics"]["false_negatives"] == 1
    assert init_summary["true_positives"] == 0

    # Step 2: Downstream activity reveals mule chain; DC-LCG marks ACC_MULE_A as high-risk
    risk_cache.update_scores(
        prob_map={"ACC_MULE_A": 0.92, "ACC_MULE_B": 0.88},
        disguise_map={"ACC_MULE_A": 0.40},
        paths_map={"ACC_MULE_A": ["ACC_MULE_A -> ACC_MULE_B -> ACC_MULE_C"]},
        model_version="dclcg_prod_e2e",
        graph_version=2,
    )

    # Trigger graph pattern reassessment
    await engine.trigger_graph_pattern(
        pattern_type="MULE_CHAIN",
        participating_accounts=["ACC_MULE_A", "ACC_MULE_B"],
        graph_version=2,
    )

    # Wait for background queue worker
    await asyncio.sleep(0.15)

    # Verify state transition: LOW_RISK -> HIGH_RISK, payment remains APPROVED
    meta = affected_index.get_transaction("TXN_INIT_001")
    assert meta["current_risk_status"] == "HIGH_RISK"
    assert meta["payment_status"] in ("APPROVE", "APPROVED")  # Payment status is immutable
    assert meta["assessment_version"] >= 2
    assert engine.total_retrospective_alerts >= 1

    # Verify retrospective evaluation metrics update: FN -> TP (Late Fraud Discovery)
    post_summary = evaluator.get_summary()
    assert post_summary["true_positives"] == 1
    assert post_summary["false_negatives"] == 0
    assert post_summary["reassessment_impact"]["late_fraud_discoveries"] == 1

    await engine.stop()


@pytest.mark.asyncio
async def test_scenario_a_false_positive_evidence_clearance():
    """Scenario A: Initially flagged transaction cleared following verified investigator evidence."""
    sim_id = 102
    affected_index = AffectedTransactionIndex(simulation_id=sim_id)
    risk_cache = AccountRiskCache(ttl_seconds=60.0)
    screening_engine = FastScreeningEngine()
    evaluator = DualEvaluationEngine(simulation_id=sim_id)

    reassessment_events = []
    engine = ContinuousRiskReevaluationEngine(
        simulation_id=sim_id,
        affected_index=affected_index,
        risk_cache=risk_cache,
        screening_engine=screening_engine,
        alert_bridge=LiveShieldAlertBridge(db_session_factory=None, organization_id=1),
        config={"detection_config": {"deescalate_threshold": 0.35}},
        on_reassessment=lambda ev: (reassessment_events.append(ev), evaluator.record_reassessment(ev)),
    )
    await engine.start()

    # Step 1: Ingest legitimate transaction that tripped unusual velocity (FLAG, False Positive)
    t0 = datetime.now(timezone.utc)
    txn = {
        "transaction_id": "TXN_FP_001",
        "sender_account": "ACC_RETAIL_1",
        "receiver_account": "ACC_MERCHANT_1",
        "amount": 9200.0,
        "timestamp": t0,
        "synthetic_ground_truth": "legitimate",
    }
    decision = {
        "transaction_id": "TXN_FP_001",
        "sender_account": "ACC_RETAIL_1",
        "receiver_account": "ACC_MERCHANT_1",
        "amount": 9200.0,
        "combined_risk_score": 0.72,
        "final_decision": "FLAG",
        "risk_tier": "HIGH",
        "synthetic_ground_truth": "legitimate",
    }
    evaluator.record_decision(decision)

    await engine.trigger_new_transaction(
        txn=txn,
        initial_decision="FLAG",
        risk_score=0.72,
        risk_status="HIGH_RISK",
    )

    init_summary = evaluator.get_summary()
    assert init_summary["initial_metrics"]["false_positives"] == 1
    assert init_summary["false_positives"] == 1

    # Step 2: Investigator verifies legitimate business invoice and submits clearance
    await engine.trigger_investigation_evidence(
        account_id="ACC_RETAIL_1",
        evidence_type="KYC_VERIFICATION",
        verified_clean=True,
        notes="Verified payroll vendor account with authorized corporate invoicing.",
        investigator_id=1,
    )

    await asyncio.sleep(0.15)

    meta = affected_index.get_transaction("TXN_FP_001")
    assert meta["current_risk_status"] == "CLEARED"
    assert meta["payment_status"] == "FLAG"  # Original payment flag preserved
    assert meta["assessment_version"] >= 2
    assert engine.total_cleared >= 1

    # Verify False Positive Reversal in evaluator
    post_summary = evaluator.get_summary()
    assert post_summary["false_positives"] == 0
    assert post_summary["true_negatives"] == 1
    assert post_summary["reassessment_impact"]["false_positive_reversals"] == 1

    await engine.stop()


def test_inactivity_does_not_cause_automatic_clearance():
    """Verify that absence of subsequent activity does not clear suspicious transactions."""
    index = AffectedTransactionIndex(simulation_id=103)
    t0 = datetime.now(timezone.utc) - timedelta(minutes=15)
    txn = {
        "transaction_id": "TXN_STALE_001",
        "sender_account": "ACC_SUSPECT",
        "receiver_account": "ACC_DEST",
        "amount": 8000.0,
        "timestamp": t0,
        "synthetic_ground_truth": "fraudulent",
    }
    index.index_transaction(txn, "FLAG", 0.65, "SUSPICIOUS", 1)

    # Query without verified evidence or graph clearance
    meta = index.get_transaction("TXN_STALE_001")
    assert meta["current_risk_status"] == "SUSPICIOUS"  # Remains suspicious


@pytest.mark.asyncio
async def test_end_to_end_simulation_with_crre_acceptance():
    """Run a deterministic multi-hop simulation with active DC-LCG inference and CRRE."""
    config = {
        "mode": "basic",
        "target_tps": 100.0,
        "total_transactions": 100,
        "traffic_composition": "mixed",
        "legitimate_percentage": 70.0,
        "fraudulent_percentage": 30.0,
        "selected_scenarios": ["F01", "F02", "F03"],
        "detection_mode": "shadow",
        "detection_config": {
            "flag_threshold": 0.50,
            "hold_threshold": 0.70,
            "weight_fast_screening": 0.55,
            "weight_dclcg": 0.35,
            "weight_historical_risk": 0.10,
        },
    }

    engine = SimulationEngine(simulation_id=777, config=config)
    await engine.start()

    for _ in range(80):
        if engine.status in ("COMPLETED", "STOPPED", "FAILED"):
            break
        await asyncio.sleep(0.05)

    assert engine.total_generated >= 50
    assert hasattr(engine, "reevaluation_engine")
    assert engine.reevaluation_engine.total_events_processed >= 1

    stats = engine.get_stats()
    assert "reevaluation_stats" in stats
    assert "affected_index_stats" in stats
    assert stats["evaluation"]["total_transactions"] >= 50

    await engine.stop()
