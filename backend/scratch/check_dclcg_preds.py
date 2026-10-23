import sys
from pathlib import Path
backend_path = Path(r"c:\traceacc\TraceAcc1\backend")
sys.path.insert(0, str(backend_path))

import random
from datetime import datetime, timezone
import os
import numpy as np

from services.liveshield.accounts import AccountPopulation
from services.liveshield.legitimate import LegitimateTransactionGenerator
from services.liveshield.registry import scenario_registry
from utils.graph import TransactionGraph
from detectors.dclcg.inference import load_artifact, predict_graph
from detectors.dclcg.train import ARTIFACT_DIR

def check_dclcg_predictions():
    seed = 42
    rng = random.Random(seed)
    population = AccountPopulation(num_accounts=60, currency="USD", seed=seed)
    legit_gen = LegitimateTransactionGenerator(population=population, currency="USD", seed=seed)
    selected_scenarios = ["F01", "F02", "F03", "F04", "F05", "F06"]
    
    counter = 1
    graph = TransactionGraph()
    
    # Generate 1000 transactions
    account_ground_truth = {acc.account_id: "legitimate" for acc in population.accounts.values()}
    
    for i in range(1000):
        is_fraud = (rng.random() * 100.0) < 20.0
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
                for tx in seq_txns:
                    account_ground_truth[tx["sender_account"]] = "fraudulent"
                    account_ground_truth[tx["receiver_account"]] = "fraudulent"
                txn = seq_txns[0]
            else:
                legit_gen.counter = counter
                txn = legit_gen.generate_single_transaction()
                counter = legit_gen.counter
        else:
            legit_gen.counter = counter
            txn = legit_gen.generate_single_transaction()
            counter = legit_gen.counter
            
        graph.add_transaction(txn["sender_account"], txn["receiver_account"], float(txn["amount"]), txn["timestamp"])

    bundle = load_artifact(os.path.join(ARTIFACT_DIR, "dclcg_prod_e2e.pt"))
    res = predict_graph(graph, bundle)
    probs = res["probs"]
    
    print(f"Total graph accounts: {len(probs)}")
    fraud_accs = [acc for acc, gt in account_ground_truth.items() if gt == "fraudulent"]
    legit_accs = [acc for acc, gt in account_ground_truth.items() if gt == "legitimate"]
    print(f"Ground truth accounts: {len(legit_accs)} Legitimate, {len(fraud_accs)} Fraudulent")
    
    fraud_probs = [probs[a] for a in fraud_accs if a in probs]
    legit_probs = [probs[a] for a in legit_accs if a in probs]
    
    print(f"\nFraud Accounts (n={len(fraud_probs)}): Mean prob = {np.mean(fraud_probs):.4f}, Min = {np.min(fraud_probs):.4f}, Max = {np.max(fraud_probs):.4f}")
    print(f"Legit Accounts (n={len(legit_probs)}): Mean prob = {np.mean(legit_probs):.4f}, Min = {np.min(legit_probs):.4f}, Max = {np.max(legit_probs):.4f}")
    
    print("\nSample Probabilities (Legitimate Accounts):")
    for a in legit_accs[:15]:
        if a in probs:
            print(f"  {a}: prob={probs[a]:.4f}")

    print("\nSample Probabilities (Fraud Accounts):")
    for a in fraud_accs[:15]:
        if a in probs:
            print(f"  {a}: prob={probs[a]:.4f}")

if __name__ == "__main__":
    check_dclcg_predictions()
