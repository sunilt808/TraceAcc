import sys
from pathlib import Path
backend_path = Path(r"c:\traceacc\TraceAcc1\backend")
sys.path.insert(0, str(backend_path))

import random
from datetime import datetime, timezone
from decimal import Decimal
import numpy as np

from services.liveshield.accounts import AccountPopulation
from services.liveshield.legitimate import LegitimateTransactionGenerator
from services.liveshield.registry import scenario_registry
from services.liveshield.screening import FastScreeningEngine
from services.liveshield.decision_engine import DecisionEngine
from services.liveshield.evaluator import DualEvaluationEngine
from services.liveshield.graph_worker import AccountRiskCache
from utils.graph import TransactionGraph
from detectors.dclcg.inference import load_artifact, predict_graph
from detectors.dclcg.train import ARTIFACT_DIR
import os

def generate_deterministic_dataset(seed=42, total_txns=1000, fraud_pct=20.0, num_accounts=60):
    rng = random.Random(seed)
    population = AccountPopulation(num_accounts=num_accounts, currency="USD", seed=seed)
    legit_gen = LegitimateTransactionGenerator(population=population, currency="USD", seed=seed)
    selected_scenarios = ["F01", "F02", "F03", "F04", "F05", "F06"]
    
    counter = 1
    transactions = []
    
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
        transactions.append(txn)
        
    return transactions, population

def run_ablation(mode_name, transactions, use_fast=True, use_dclcg=True, use_hist=True):
    # Load DC-LCG artifact
    artifact_path = os.path.join(ARTIFACT_DIR, "dclcg_prod_e2e.pt")
    bundle = load_artifact(artifact_path)
    
    # We will build a rolling graph for DC-LCG inference
    rolling_graph = TransactionGraph()
    risk_cache = AccountRiskCache()
    screening_engine = FastScreeningEngine()
    
    # Configure decision engine weights
    # If a component is turned off, its weight is 0.0 or score is ignored
    w_fast = 0.45 if use_fast else 0.0
    w_dclcg = 0.45 if use_dclcg else 0.0
    w_hist = 0.10 if use_hist else 0.0
    
    config = {
        "weight_fast": w_fast,
        "weight_dclcg": w_dclcg,
        "weight_hist": w_hist,
        "flag_threshold": 0.35,
        "hold_threshold": 0.65,
        "reject_threshold": 0.85,
    }
    
    decision_engine = DecisionEngine(detection_mode="shadow", config=config)
    evaluator = DualEvaluationEngine(simulation_id=1)
    
    for i, txn in enumerate(transactions):
        s_acc = txn["sender_account"]
        r_acc = txn["receiver_account"]
        amt = float(txn["amount"])
        ts = txn.get("timestamp") or datetime.now(timezone.utc)
        
        # Add to rolling graph
        rolling_graph.add_transaction(s_acc, r_acc, amt, ts)
        
        # Periodically run DC-LCG inference (every 50 txns or when enough data)
        if use_dclcg and len(rolling_graph.transactions) >= 10 and (i % 25 == 0 or i == len(transactions) - 1):
            res = predict_graph(rolling_graph, bundle)
            risk_cache.update_scores(
                prob_map=res.get("probs", {}),
                disguise_map=res.get("disguise", {}),
                paths_map=res.get("top_paths", {}),
                model_version="dclcg_prod_e2e.pt",
                graph_version=i,
            )
            
        cached_s = risk_cache.get_account_risk(s_acc) if use_hist else None
        cached_r = risk_cache.get_account_risk(r_acc) if use_hist else None
        
        s_prob = cached_s.get("illicit_prob", 0.0) if cached_s else 0.0
        r_prob = cached_r.get("illicit_prob", 0.0) if cached_r else 0.0
        
        if use_fast:
            fast_score, fast_signals = screening_engine.screen_transaction(
                txn=txn,
                cached_sender_risk=cached_s if use_hist else None,
                cached_receiver_risk=cached_r if use_hist else None,
            )
        else:
            fast_score, fast_signals = 0.0, []
            
        dclcg_prob = max(s_prob, r_prob) if (use_dclcg and (cached_s or cached_r)) else None
        
        # Evaluate decision
        decision_rec = decision_engine.evaluate_decision(
            transaction=txn,
            screening_result={"fast_score": fast_score, "signals": fast_signals},
            dclcg_score=dclcg_prob if use_dclcg else None,
            cached_sender_risk=s_prob if use_hist else 0.0,
            cached_receiver_risk=r_prob if use_hist else 0.0,
        )
        evaluator.record_decision(decision_rec)
        
    summary = evaluator.get_summary()
    print(f"[{mode_name}] TP: {summary['true_positives']:3d} | FP: {summary['false_positives']:3d} | TN: {summary['true_negatives']:3d} | FN: {summary['false_negatives']:3d} | "
          f"Prec: {summary['precision']*100:5.2f}% | Rec: {summary['recall']*100:5.2f}% | FPR: {summary['false_positive_rate']*100:5.2f}% | F1: {summary['f1_score']*100:5.2f}%")
    return summary

def main():
    txns, pop = generate_deterministic_dataset(seed=42, total_txns=1000, fraud_pct=20.0, num_accounts=60)
    print("Total transactions:", len(txns))
    fraud_count = sum(1 for t in txns if t.get("synthetic_ground_truth") == "fraudulent")
    legit_count = sum(1 for t in txns if t.get("synthetic_ground_truth") == "legitimate")
    print(f"Ground truth breakdown: {legit_count} Legitimate, {fraud_count} Fraudulent\n")
    
    print("--- RUNNING 7-WAY ABLATION MATRIX (A to G) CURRENT BASELINE ---")
    run_ablation("A: Fast Screening Only       ", txns, use_fast=True, use_dclcg=False, use_hist=False)
    run_ablation("B: DC-LCG Only               ", txns, use_fast=False, use_dclcg=True, use_hist=False)
    run_ablation("C: Account Risk Cache Only   ", txns, use_fast=False, use_dclcg=False, use_hist=True)
    run_ablation("D: Fast Screening + DC-LCG   ", txns, use_fast=True, use_dclcg=True, use_hist=False)
    run_ablation("E: Fast Screening + Hist Risk", txns, use_fast=True, use_dclcg=False, use_hist=True)
    run_ablation("F: DC-LCG + Hist Risk        ", txns, use_fast=False, use_dclcg=True, use_hist=True)
    run_ablation("G: Full Combined Pipeline    ", txns, use_fast=True, use_dclcg=True, use_hist=True)

if __name__ == "__main__":
    main()
