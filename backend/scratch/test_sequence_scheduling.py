import sys
from pathlib import Path
backend_path = Path(r"c:\traceacc\TraceAcc1\backend")
sys.path.insert(0, str(backend_path))

import random
import time
from datetime import datetime, timezone
from decimal import Decimal
import numpy as np

from services.liveshield.accounts import AccountPopulation
from services.liveshield.legitimate import LegitimateTransactionGenerator
from services.liveshield.registry import scenario_registry
from services.liveshield.evaluator import DualEvaluationEngine
from services.liveshield.decision_engine import DecisionEngine
from services.liveshield.screening import FastScreeningEngine

# Let's test with sequence interleaving and proper screening/decision calibration
from scratch.test_refined_velocity import AdaptiveFastScreeningEngine

def run_calibrated_simulation():
    seed = 42
    rng = random.Random(seed)
    num_accounts = 60
    currency = "USD"
    fraud_pct = 20.0
    selected_scenarios = ["F01", "F02", "F03", "F04", "F05", "F06"]

    population = AccountPopulation(num_accounts=num_accounts, currency=currency, seed=seed)
    legit_gen = LegitimateTransactionGenerator(population=population, currency=currency, seed=seed)
    
    screening = AdaptiveFastScreeningEngine()
    
    decision_config = {
        "weight_fast": 0.60,
        "weight_dclcg": 0.30,
        "weight_hist": 0.10,
        "flag_threshold": 0.50,
        "hold_threshold": 0.70,
        "reject_threshold": 0.88,
    }
    decision_engine = DecisionEngine(detection_mode="shadow", config=decision_config)
    evaluator = DualEvaluationEngine(simulation_id=1)
    
    # Interleaved sequence queue
    scheduled_queue = []
    counter = 1
    total_generated = 0
    sim_time = 0.0 # simulated seconds
    
    rule_counts = {}
    fp_rule_counts = {}
    
    while total_generated < 1000:
        sim_time += 0.02 # 50 TPS -> 0.02s per txn
        
        # Check scheduled sequence queue
        due_idx = [i for i, item in enumerate(scheduled_queue) if item[0] <= sim_time]
        if due_idx:
            # Pop earliest
            earliest_i = min(due_idx, key=lambda i: scheduled_queue[i][0])
            _, txn = scheduled_queue.pop(earliest_i)
        else:
            is_fraud = (rng.random() * 100.0) < fraud_pct
            if is_fraud:
                scen_id = rng.choice(selected_scenarios)
                seq_txns, counter = scenario_registry.generate_sequence(
                    scenario_id=scen_id,
                    population=population,
                    base_time=datetime.now(timezone.utc),
                    txn_prefix="TXN",
                    counter_start=counter,
                    rng=rng,
                )
                if seq_txns:
                    txn = seq_txns[0]
                    # Schedule subsequent steps with realistic scaled delay (e.g. 0.1s to 1.0s apart)
                    base_ts = seq_txns[0]["timestamp"]
                    for step_txn in seq_txns[1:]:
                        raw_offset = (step_txn["timestamp"] - base_ts).total_seconds()
                        scaled_delay = max(0.05, min(2.0, raw_offset / 60.0))
                        scheduled_queue.append((sim_time + scaled_delay, step_txn))
                else:
                    legit_gen.counter = counter
                    txn = legit_gen.generate_single_transaction()
                    counter = legit_gen.counter
            else:
                legit_gen.counter = counter
                txn = legit_gen.generate_single_transaction()
                counter = legit_gen.counter

        txn["simulation_id"] = 1
        
        fast_score, fast_signals = screening.screen_transaction(txn)
        
        decision_rec = decision_engine.evaluate_decision(
            transaction=txn,
            screening_result={"fast_score": fast_score, "signals": fast_signals},
            dclcg_score=None,
            cached_sender_risk=0.0,
            cached_receiver_risk=0.0,
        )
        evaluator.record_decision(decision_rec)
        
        for sig in fast_signals:
            rid = sig["rule_id"]
            rule_counts[rid] = rule_counts.get(rid, 0) + 1
            if txn.get("synthetic_ground_truth") == "legitimate":
                fp_rule_counts[rid] = fp_rule_counts.get(rid, 0) + 1
                
        total_generated += 1
        
    summary = evaluator.get_summary()
    print("=== CALIBRATED SIMULATION WITH SCALED SEQUENCES ===")
    print(f"Total Transactions: {summary['total_transactions']} (Legit: {summary['total_legitimate']}, Fraud: {summary['total_fraudulent']})")
    print(f"True Positives (TP):  {summary['true_positives']}")
    print(f"False Positives (FP): {summary['false_positives']}")
    print(f"True Negatives (TN):  {summary['true_negatives']}")
    print(f"False Negatives (FN): {summary['false_negatives']}")
    print(f"Precision:            {summary['precision']*100:.2f}%")
    print(f"Recall:               {summary['recall']*100:.2f}%")
    print(f"False Positive Rate:  {summary['false_positive_rate']*100:.2f}%")
    print(f"F1 Score:             {summary['f1_score']*100:.2f}%")
    print(f"Accuracy:             {summary['accuracy']*100:.2f}%")
    print("\nScenario breakdown:")
    for sc, data in summary["scenario_metrics"].items():
        print(f"  {sc}: total={data['total']}, TP={data['tp']}, FN={data['fn']}, FP={data['fp']}, Detection Rate={data['detection_rate']*100:.1f}%")
    print("\nRule trigger counts total:", rule_counts)
    print("Rule trigger counts on legitimate (FP):", fp_rule_counts)

if __name__ == "__main__":
    run_calibrated_simulation()
