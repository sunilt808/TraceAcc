import sys
from pathlib import Path
backend_path = Path(r"c:\traceacc\TraceAcc1\backend")
sys.path.insert(0, str(backend_path))

import random
from datetime import datetime, timezone, timedelta
from decimal import Decimal
import numpy as np

from services.liveshield.accounts import AccountPopulation
from services.liveshield.legitimate import LegitimateTransactionGenerator
from services.liveshield.registry import scenario_registry
from services.liveshield.evaluator import DualEvaluationEngine
from services.liveshield.decision_engine import DecisionEngine

# Let's test with simulated timeline where 1000 txns span a realistic 24-hour business window
def test_realistic_timeline():
    seed = 42
    rng = random.Random(seed)
    population = AccountPopulation(num_accounts=100, currency="USD", seed=seed)
    legit_gen = LegitimateTransactionGenerator(population=population, currency="USD", seed=seed)
    
    # Import our high precision screening engine
    from scratch.test_high_precision import PrecisionFastScreeningEngine
    screening = PrecisionFastScreeningEngine()
    
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
    
    selected_scenarios = ["F01", "F02", "F03", "F04", "F05", "F06"]
    counter = 1
    scheduled_queue = []
    
    # Base datetime: Jan 1, 2026 08:00:00 UTC
    base_dt = datetime(2026, 1, 1, 8, 0, 0, tzinfo=timezone.utc)
    current_dt = base_dt
    
    rule_counts = {}
    fp_rule_counts = {}
    
    for i in range(1000):
        # Time advances by 30 to 90 seconds per transaction (realistic 24h stream)
        current_dt += timedelta(seconds=rng.uniform(30.0, 90.0))
        
        due_idx = [j for j, item in enumerate(scheduled_queue) if item[0] <= current_dt]
        if due_idx:
            earliest_j = min(due_idx, key=lambda j: scheduled_queue[j][0])
            _, txn = scheduled_queue.pop(earliest_j)
            txn["timestamp"] = current_dt
        else:
            is_fraud = (rng.random() * 100.0) < 20.0
            if is_fraud:
                scen_id = rng.choice(selected_scenarios)
                seq_txns, counter = scenario_registry.generate_sequence(
                    scenario_id=scen_id,
                    population=population,
                    base_time=current_dt,
                    txn_prefix="TXN",
                    counter_start=counter,
                    rng=rng,
                )
                if seq_txns:
                    txn = seq_txns[0]
                    base_seq_time = seq_txns[0]["timestamp"]
                    for step_txn in seq_txns[1:]:
                        delay_sec = (step_txn["timestamp"] - base_seq_time).total_seconds()
                        scheduled_queue.append((current_dt + timedelta(seconds=delay_sec), step_txn))
                else:
                    legit_gen.counter = counter
                    txn = legit_gen.generate_single_transaction(timestamp=current_dt)
                    counter = legit_gen.counter
            else:
                legit_gen.counter = counter
                txn = legit_gen.generate_single_transaction(timestamp=current_dt)
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

    summary = evaluator.get_summary()
    print("=== REALISTIC TIMELINE SIMULATION RESULTS ===")
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
    test_realistic_timeline()
