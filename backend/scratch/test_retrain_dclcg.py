import sys
from pathlib import Path
backend_path = Path(r"c:\traceacc\TraceAcc1\backend")
sys.path.insert(0, str(backend_path))

import random
from datetime import datetime, timezone
from decimal import Decimal
import numpy as np
import os
import torch

from services.liveshield.accounts import AccountPopulation
from services.liveshield.legitimate import LegitimateTransactionGenerator
from services.liveshield.registry import scenario_registry
from utils.graph import TransactionGraph
from detectors.dclcg.train import train_dclcg, ARTIFACT_DIR
from detectors.dclcg.inference import predict_graph, load_artifact
from detectors.dclcg.value_encoder import FeatureScaler

def retrain_and_evaluate():
    seed = 42
    rng = random.Random(seed)
    
    # Let's generate a training graph of 100 accounts with 2000 transactions (mixed traffic)
    population = AccountPopulation(num_accounts=100, currency="USD", seed=seed)
    legit_gen = LegitimateTransactionGenerator(population=population, currency="USD", seed=seed)
    selected_scenarios = ["F01", "F02", "F03", "F04", "F05", "F06"]
    
    train_graph = TransactionGraph()
    account_labels = {acc.account_id: 0 for acc in population.accounts.values()}
    counter = 1
    
    for i in range(2000):
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
                    account_labels[tx["sender_account"]] = 1
                    account_labels[tx["receiver_account"]] = 1
                    train_graph.add_transaction(tx["sender_account"], tx["receiver_account"], float(tx["amount"]), tx["timestamp"])
            else:
                txn = legit_gen.generate_single_transaction()
                train_graph.add_transaction(txn["sender_account"], txn["receiver_account"], float(txn["amount"]), txn["timestamp"])
        else:
            txn = legit_gen.generate_single_transaction()
            train_graph.add_transaction(txn["sender_account"], txn["receiver_account"], float(txn["amount"]), txn["timestamp"])

    pos_accs = sum(account_labels.values())
    print(f"Training accounts: {len(account_labels)}, Fraud: {pos_accs}, Legit: {len(account_labels) - pos_accs}")
    
    # Train DC-LCG with supervised ground-truth labels
    model, info = train_dclcg(
        train_graph,
        labels=account_labels,
        epochs=40,
        lr=0.005,
        hidden_dim=32,
        seed=42,
    )
    
    # Save newly trained artifact
    save_path = os.path.join(ARTIFACT_DIR, "dclcg_prod_e2e_retrained.pt")
    # Make sure scaler is saved
    scaler = FeatureScaler()
    from detectors.dclcg.value_encoder import build_value_features
    _, X_raw = build_value_features(train_graph)
    scaler.fit(X_raw)
    
    torch.save({
        "state_dict": model.state_dict(),
        "accounts": list(train_graph.nodes),
        "scaler": scaler.to_dict(),
        "config": {"hidden_dim": 32, "n_layers": 2},
    }, save_path)
    print("Saved retrained artifact to", save_path)
    
    # Now evaluate on test graph (independent seed 123)
    test_rng = random.Random(123)
    test_pop = AccountPopulation(num_accounts=60, currency="USD", seed=123)
    test_legit_gen = LegitimateTransactionGenerator(population=test_pop, currency="USD", seed=123)
    test_graph = TransactionGraph()
    test_gt = {acc.account_id: 0 for acc in test_pop.accounts.values()}
    counter = 1
    
    for i in range(1000):
        is_fraud = (test_rng.random() * 100.0) < 20.0
        if is_fraud:
            scen_id = test_rng.choice(selected_scenarios)
            seq_txns, counter = scenario_registry.generate_sequence(
                scenario_id=scen_id,
                population=test_pop,
                base_time=datetime.now(timezone.utc),
                txn_prefix="TXN",
                counter_start=counter,
                rng=test_rng,
            )
            if seq_txns:
                for tx in seq_txns:
                    test_gt[tx["sender_account"]] = 1
                    test_gt[tx["receiver_account"]] = 1
                    test_graph.add_transaction(tx["sender_account"], tx["receiver_account"], float(tx["amount"]), tx["timestamp"])
        else:
            txn = test_legit_gen.generate_single_transaction()
            test_graph.add_transaction(txn["sender_account"], txn["receiver_account"], float(txn["amount"]), txn["timestamp"])

    bundle_retrained = load_artifact(save_path)
    res = predict_graph(test_graph, bundle_retrained)
    probs = res["probs"]
    
    fraud_probs = [probs[a] for a, gt in test_gt.items() if gt == 1 and a in probs]
    legit_probs = [probs[a] for a, gt in test_gt.items() if gt == 0 and a in probs]
    
    print("\n--- TEST GRAPH EVALUATION ---")
    print(f"Fraud accounts (n={len(fraud_probs)}): Mean={np.mean(fraud_probs):.4f}, Min={np.min(fraud_probs):.4f}, Max={np.max(fraud_probs):.4f}")
    if legit_probs:
        print(f"Legit accounts (n={len(legit_probs)}): Mean={np.mean(legit_probs):.4f}, Min={np.min(legit_probs):.4f}, Max={np.max(legit_probs):.4f}")
    else:
        print("All test accounts participated in fraud sequences.")

if __name__ == "__main__":
    retrain_and_evaluate()
