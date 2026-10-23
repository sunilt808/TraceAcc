import sys
from pathlib import Path
backend_path = Path(r"c:\traceacc\TraceAcc1\backend")
sys.path.insert(0, str(backend_path))

import random
from datetime import datetime, timezone, timedelta
from decimal import Decimal
import numpy as np
import torch
import os

from services.liveshield.accounts import AccountPopulation
from services.liveshield.legitimate import LegitimateTransactionGenerator
from services.liveshield.registry import scenario_registry
from services.liveshield.evaluator import DualEvaluationEngine
from services.liveshield.decision_engine import DecisionEngine
from utils.graph import TransactionGraph
from detectors.dclcg.train import train_dclcg, ARTIFACT_DIR
from detectors.dclcg.value_encoder import FeatureScaler, build_value_features
from detectors.dclcg.inference import load_artifact, predict_graph

# 1. Train a clean, robustly calibrated DC-LCG artifact on balanced synthetic graphs
def train_clean_model():
    print("Training clean calibrated DC-LCG model...")
    seed = 42
    rng = random.Random(seed)
    
    # Large population of 200 accounts
    pop = AccountPopulation(num_accounts=200, currency="USD", seed=seed)
    legit_gen = LegitimateTransactionGenerator(population=pop, currency="USD", seed=seed)
    selected_scenarios = ["F01", "F02", "F03", "F04", "F05", "F06", "F07", "F08"]
    
    graph = TransactionGraph()
    account_labels = {acc.account_id: 0 for acc in pop.accounts.values()}
    counter = 1
    
    # 3,000 transactions (15% fraud scenarios)
    for i in range(3000):
        is_fraud = (rng.random() * 100.0) < 15.0
        if is_fraud:
            scen_id = rng.choice(selected_scenarios)
            seq_txns, counter = scenario_registry.generate_sequence(
                scenario_id=scen_id,
                population=pop,
                base_time=datetime.now(timezone.utc),
                txn_prefix="TXN",
                counter_start=counter,
                rng=rng,
            )
            if seq_txns:
                for tx in seq_txns:
                    account_labels[tx["sender_account"]] = 1
                    account_labels[tx["receiver_account"]] = 1
                    graph.add_transaction(tx["sender_account"], tx["receiver_account"], float(tx["amount"]), tx["timestamp"])
            else:
                tx = legit_gen.generate_single_transaction()
                graph.add_transaction(tx["sender_account"], tx["receiver_account"], float(tx["amount"]), tx["timestamp"])
        else:
            tx = legit_gen.generate_single_transaction()
            graph.add_transaction(tx["sender_account"], tx["receiver_account"], float(tx["amount"]), tx["timestamp"])

    fraud_accs = sum(account_labels.values())
    legit_accs = len(account_labels) - fraud_accs
    print(f"Dataset generated: {len(graph.nodes)} accounts ({fraud_accs} fraud, {legit_accs} legit), {len(graph.transactions)} txns")
    
    # Train model with supervised true labels
    model, info = train_dclcg(
        graph,
        labels=account_labels,
        epochs=35,
        lr=0.005,
        hidden_dim=32,
        seed=42,
    )
    
    # Fit scaler
    _, X_raw = build_value_features(graph)
    scaler = FeatureScaler()
    scaler.fit(X_raw)
    
    save_path = os.path.join(ARTIFACT_DIR, "dclcg_prod_e2e.pt")
    torch.save({
        "state_dict": model.state_dict(),
        "accounts": list(graph.nodes),
        "scaler": scaler.to_dict(),
        "config": {"hidden_dim": 32, "n_layers": 2},
    }, save_path)
    print("Successfully saved calibrated model artifact to:", save_path)
    return save_path

if __name__ == "__main__":
    train_clean_model()
