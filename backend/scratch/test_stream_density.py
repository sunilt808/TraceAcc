import sys
from pathlib import Path
backend_path = Path(r"c:\traceacc\TraceAcc1\backend")
sys.path.insert(0, str(backend_path))

import random
from datetime import datetime, timezone, timedelta
from decimal import Decimal
import numpy as np
import os

from services.liveshield.accounts import AccountPopulation
from services.liveshield.legitimate import LegitimateTransactionGenerator
from services.liveshield.registry import scenario_registry
from services.liveshield.evaluator import DualEvaluationEngine
from services.liveshield.decision_engine import DecisionEngine
from services.liveshield.screening import FastScreeningEngine

def test_stream_density(step_seconds=30.0):
    seed = 42
    rng = random.Random(seed)
    pop = AccountPopulation(num_accounts=100, currency="USD", seed=seed)
    legit_gen = LegitimateTransactionGenerator(population=pop, currency="USD", seed=seed)
    screening = FastScreeningEngine()
    decision_engine = DecisionEngine(detection_mode="shadow")
    evaluator = DualEvaluationEngine(simulation_id=1)
    
    selected_scenarios = ["F01", "F02", "F03", "F04", "F05", "F06"]
    counter = 1
    scheduled_queue = []
    
    sim_clock = datetime(2026, 1, 1, 8, 0, 0, tzinfo=timezone.utc)
    
    rule_counts = {}
    fp_rule_counts = {}
    
    for i in range(1000):
        sim_clock += timedelta(seconds=step_seconds)
        due_idx = [j for j, item in enumerate(scheduled_queue) if item[0] <= sim_clock]
        if due_idx:
            earliest_j = min(due_idx, key=lambda j: scheduled_queue[j][0])
            _, txn = scheduled_queue.pop(earliest_j)
            txn["timestamp"] = sim_clock
        else:
            is_fraud = (rng.random() * 100.0) < 20.0
            if is_fraud:
                scen_id = rng.choice(selected_scenarios)
                seq_txns, counter = scenario_registry.generate_sequence(
                    scenario_id=scen_id,
                    population=pop.get_syndicate_population(),
                    base_time=sim_clock,
                    txn_prefix="TXN",
                    counter_start=counter,
                    rng=rng,
                )
                if seq_txns:
                    txn = seq_txns[0]
                    base_seq_time = seq_txns[0]["timestamp"]
                    for step_txn in seq_txns[1:]:
                        delay_sec = (step_txn["timestamp"] - base_seq_time).total_seconds()
                        scheduled_queue.append((sim_clock + timedelta(seconds=delay_sec), step_txn))
                else:
                    legit_gen.counter = counter
                    txn = legit_gen.generate_single_transaction(timestamp=sim_clock)
                    counter = legit_gen.counter
            else:
                legit_gen.counter = counter
                txn = legit_gen.generate_single_transaction(timestamp=sim_clock)
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
    print(f"=== STREAM DENSITY TEST (step={step_seconds}s) ===")
    print(f"Total: {summary['total_transactions']} (Legit: {summary['total_legitimate']}, Fraud: {summary['total_fraudulent']})")
    print(f"TP: {summary['true_positives']} | FP: {summary['false_positives']} | TN: {summary['true_negatives']} | FN: {summary['false_negatives']}")
    print(f"Precision: {summary['precision']*100:.2f}% | Recall: {summary['recall']*100:.2f}% | FPR: {summary['false_positive_rate']*100:.2f}% | F1: {summary['f1_score']*100:.2f}%")
    print("\nRule Trigger Counts Total:", rule_counts)
    print("Rule Trigger Counts on Legitimate (FP):", fp_rule_counts)

if __name__ == "__main__":
    test_stream_density(step_seconds=30.0)
