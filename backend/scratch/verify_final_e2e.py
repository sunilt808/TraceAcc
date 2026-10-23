import sys
from pathlib import Path
backend_path = Path(r"c:\traceacc\TraceAcc1\backend")
sys.path.insert(0, str(backend_path))

import asyncio
import time
from datetime import datetime, timezone, timedelta
from decimal import Decimal
import random

from services.liveshield.accounts import AccountPopulation
from services.liveshield.legitimate import LegitimateTransactionGenerator
from services.liveshield.registry import scenario_registry
from services.liveshield.scheduler import SimulationScheduler
from services.liveshield.screening import FastScreeningEngine
from services.liveshield.graph_worker import RollingGraphInferenceWorker, AccountRiskCache
from services.liveshield.decision_engine import DecisionEngine
from services.liveshield.evaluator import DualEvaluationEngine
from utils.graph import TransactionGraph
from detectors.dclcg.inference import load_artifact, predict_graph
from detectors.dclcg.train import ARTIFACT_DIR
import os

def test_final_verification(seed=42):
    rng = random.Random(seed)
    num_accounts = 60
    currency = "USD"
    fraud_pct = 20.0
    selected_scenarios = ["F01", "F02", "F03", "F04", "F05", "F06"]

    population = AccountPopulation(num_accounts=num_accounts, currency=currency, seed=seed)
    legit_gen = LegitimateTransactionGenerator(population=population, currency=currency, seed=seed)
    scheduler = SimulationScheduler(target_tps=Decimal("50.0"), traffic_pattern="constant", rng=rng)
    
    screening_engine = FastScreeningEngine()
    risk_cache = AccountRiskCache(ttl_seconds=300.0)
    decision_engine = DecisionEngine(detection_mode="shadow")
    evaluator = DualEvaluationEngine(simulation_id=1)
    
    rolling_graph = TransactionGraph()
    bundle = load_artifact(os.path.join(ARTIFACT_DIR, "dclcg_prod_e2e.pt"))
    
    counter = 1
    total_generated = 0
    start_time = time.monotonic()
    
    rule_counts = {}
    fp_rule_counts = {}
    
    sim_clock = datetime(2026, 1, 1, 8, 0, 0, tzinfo=timezone.utc)
    
    while total_generated < 1000:
        # Advance simulation clock by 0.02s per transaction (50 TPS)
        sim_clock += timedelta(seconds=0.02)
        now_mono = time.monotonic()
        due_seq_txns = scheduler.pop_due_sequence_items(now_mono)
        if due_seq_txns:
            txn = due_seq_txns[0]
            txn["timestamp"] = sim_clock
        else:
            is_fraud = (rng.random() * 100.0) < fraud_pct
            if is_fraud:
                scen_id = rng.choice(selected_scenarios)
                seq_txns, counter = scenario_registry.generate_sequence(
                    scenario_id=scen_id,
                    population=population.get_syndicate_population(),
                    base_time=sim_clock,
                    txn_prefix="TXN",
                    counter_start=counter,
                    rng=rng,
                )
                if seq_txns:
                    txn = seq_txns[0]
                    if len(seq_txns) > 1:
                        scheduler.schedule_sequence_transactions(seq_txns[1:], now_mono)
                else:
                    legit_gen.counter = counter
                    txn = legit_gen.generate_single_transaction(timestamp=sim_clock)
                    counter = legit_gen.counter
            else:
                legit_gen.counter = counter
                txn = legit_gen.generate_single_transaction(timestamp=sim_clock)
                counter = legit_gen.counter

        txn["simulation_id"] = 1
        rolling_graph.add_transaction(
            txn["sender_account"],
            txn["receiver_account"],
            float(txn["amount"]),
            txn["timestamp"]
        )
        
        # Periodic DC-LCG inference
        if len(rolling_graph.transactions) >= 10 and total_generated % 50 == 0:
            res = predict_graph(rolling_graph, bundle)
            risk_cache.update_scores(
                prob_map=res.get("probs", {}),
                disguise_map=res.get("disguise", {}),
                paths_map=res.get("top_paths", {}),
                model_version="dclcg_prod_e2e.pt",
                graph_version=total_generated,
            )
            
        s_acc = txn["sender_account"]
        r_acc = txn["receiver_account"]
        cached_s = risk_cache.get_account_risk(s_acc)
        cached_r = risk_cache.get_account_risk(r_acc)
        
        fast_score, fast_signals = screening_engine.screen_transaction(
            txn=txn,
            cached_sender_risk=cached_s,
            cached_receiver_risk=cached_r,
        )
        
        s_prob = cached_s.get("illicit_prob", 0.0) if cached_s else 0.0
        r_prob = cached_r.get("illicit_prob", 0.0) if cached_r else 0.0
        dclcg_prob = max(s_prob, r_prob) if (cached_s or cached_r) else None
        
        decision_rec = decision_engine.evaluate_decision(
            transaction=txn,
            screening_result={"fast_score": fast_score, "signals": fast_signals},
            dclcg_score=dclcg_prob,
            cached_sender_risk=s_prob,
            cached_receiver_risk=r_prob,
        )
        evaluator.record_decision(decision_rec)
        
        for sig in fast_signals:
            rid = sig["rule_id"]
            rule_counts[rid] = rule_counts.get(rid, 0) + 1
            if txn.get("synthetic_ground_truth") == "legitimate":
                fp_rule_counts[rid] = fp_rule_counts.get(rid, 0) + 1
                
        total_generated += 1
        
    summary = evaluator.get_summary()
    print("=== FINAL VERIFIED END-TO-END RESULTS ===")
    print(f"Total Transactions: {summary['total_transactions']} (Legitimate: {summary['total_legitimate']}, Fraudulent: {summary['total_fraudulent']})")
    print(f"True Positives (TP):  {summary['true_positives']}")
    print(f"False Positives (FP): {summary['false_positives']}")
    print(f"True Negatives (TN):  {summary['true_negatives']}")
    print(f"False Negatives (FN): {summary['false_negatives']}")
    print(f"Precision:            {summary['precision']*100:.2f}%")
    print(f"Recall:               {summary['recall']*100:.2f}%")
    print(f"False Positive Rate:  {summary['false_positive_rate']*100:.2f}%")
    print(f"F1 Score:             {summary['f1_score']*100:.2f}%")
    print(f"Accuracy:             {summary['accuracy']*100:.2f}%")
    print("\nScenario Breakdown:")
    for sc, data in summary["scenario_metrics"].items():
        print(f"  {sc:12s}: total={data['total']:3d}, TP={data['tp']:3d}, FN={data['fn']:3d}, FP={data['fp']:3d}, DetRate={data['detection_rate']*100:5.1f}%")
    print("\nRule Trigger Counts Total:", rule_counts)
    print("Rule Trigger Counts on Legitimate (FP):", fp_rule_counts)

if __name__ == "__main__":
    test_final_verification()
