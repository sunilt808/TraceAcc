import sys
import os
from pathlib import Path

# Add backend to sys.path
backend_path = Path(r"c:\traceacc\TraceAcc1\backend")
sys.path.insert(0, str(backend_path))

import random
from datetime import datetime, timezone
from decimal import Decimal
from services.liveshield.accounts import AccountPopulation
from services.liveshield.legitimate import LegitimateTransactionGenerator
from services.liveshield.registry import scenario_registry
from services.liveshield.screening import FastScreeningEngine
from services.liveshield.decision_engine import DecisionEngine
from services.liveshield.evaluator import DualEvaluationEngine
from services.liveshield.graph_worker import AccountRiskCache

def run_diagnostic():
    seed = 42
    rng = random.Random(seed)
    num_accounts = 60
    total_txns = 1000
    fraud_pct = 20.0
    selected_scenarios = ["F01", "F02", "F03", "F04", "F05", "F06"]

    population = AccountPopulation(num_accounts=num_accounts, currency="USD", seed=seed)
    legit_gen = LegitimateTransactionGenerator(population=population, currency="USD", seed=seed)
    screening_engine = FastScreeningEngine()
    risk_cache = AccountRiskCache()
    decision_engine = DecisionEngine(detection_mode="shadow")
    evaluator = DualEvaluationEngine(simulation_id=1)

    # We will simulate 1000 transactions
    counter = 1
    generated_txns = []
    
    # Let's see what happens without DC-LCG cache first, then with simulated DC-LCG cache
    rule_trigger_counts = {}
    fp_rule_counts = {}
    fp_details = []

    for i in range(total_txns):
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
            else:
                legit_gen.counter = counter
                txn = legit_gen.generate_single_transaction()
                counter = legit_gen.counter
        else:
            legit_gen.counter = counter
            txn = legit_gen.generate_single_transaction()
            counter = legit_gen.counter
            
        txn["simulation_id"] = 1
        
        # Screening
        s_acc = txn.get("sender_account", "")
        r_acc = txn.get("receiver_account", "")
        cached_s = risk_cache.get_account_risk(s_acc)
        cached_r = risk_cache.get_account_risk(r_acc)
        
        fast_score, fast_signals = screening_engine.screen_transaction(
            txn=txn,
            cached_sender_risk=cached_s,
            cached_receiver_risk=cached_r
        )
        
        decision_rec = decision_engine.evaluate_decision(
            transaction=txn,
            screening_result={"fast_score": fast_score, "signals": fast_signals},
            dclcg_score=None,
            cached_sender_risk=0.0,
            cached_receiver_risk=0.0
        )
        
        evaluator.record_decision(decision_rec)
        
        # Track rules
        for sig in fast_signals:
            r_id = sig["rule_id"]
            rule_trigger_counts[r_id] = rule_trigger_counts.get(r_id, 0) + 1
            if txn.get("synthetic_ground_truth") == "legitimate":
                fp_rule_counts[r_id] = fp_rule_counts.get(r_id, 0) + 1
                
        if decision_rec.get("evaluation_label") == "FALSE_POSITIVE":
            fp_details.append({
                "txn_id": txn.get("transaction_id"),
                "amount": txn.get("amount"),
                "category": txn.get("transaction_type"),
                "fast_score": fast_score,
                "combined_risk": decision_rec.get("combined_risk_score"),
                "signals": fast_signals
            })

    summary = evaluator.get_summary()
    print("=== SUMMARY WITHOUT DC-LCG CACHE ===")
    print(f"Total: {summary['total_transactions']}, Legit: {summary['total_legitimate']}, Fraud: {summary['total_fraudulent']}")
    print(f"TP: {summary['true_positives']}, FP: {summary['false_positives']}, TN: {summary['true_negatives']}, FN: {summary['false_negatives']}")
    print(f"Precision: {summary['precision']:.4f}, Recall: {summary['recall']:.4f}, FPR: {summary['false_positive_rate']:.4f}, F1: {summary['f1_score']:.4f}")
    print("\n--- Rule Trigger Counts Total ---")
    for r_id, count in rule_trigger_counts.items():
        print(f"  {r_id}: {count}")
    print("\n--- Rule Trigger Counts on Legitimate Txns (False Positive Triggers) ---")
    for r_id, count in fp_rule_counts.items():
        print(f"  {r_id}: {count}")
        
    print(f"\nTotal False Positive Transactions: {len(fp_details)}")
    if fp_details:
        print("Sample FP details (first 10):")
        for fp in fp_details[:10]:
            print(" ", fp)

if __name__ == "__main__":
    run_diagnostic()
