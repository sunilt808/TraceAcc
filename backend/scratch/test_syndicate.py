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

from services.liveshield.accounts import AccountPopulation, SyntheticAccount
from services.liveshield.legitimate import LegitimateTransactionGenerator
from services.liveshield.registry import scenario_registry
from services.liveshield.evaluator import DualEvaluationEngine
from services.liveshield.decision_engine import DecisionEngine
from services.liveshield.screening import FastScreeningEngine
from utils.graph import TransactionGraph
from detectors.dclcg.train import train_dclcg, ARTIFACT_DIR
from detectors.dclcg.value_encoder import FeatureScaler, build_value_features
from detectors.dclcg.inference import predict_graph, load_artifact

class SyndicateAccountPopulation(AccountPopulation):
    def __init__(self, num_accounts=100, syndicate_ratio=0.15, currency="USD", seed=42):
        super().__init__(num_accounts=num_accounts, currency=currency, seed=seed)
        self.rng = random.Random(seed)
        num_syndicate = max(4, int(num_accounts * syndicate_ratio))
        self.syndicate_ids = self.account_ids[:num_syndicate]
        self.clean_ids = self.account_ids[num_syndicate:]
        for acc_id in self.syndicate_ids:
            self.accounts[acc_id].account_type = "PERSONAL"

def test_syndicate_architecture():
    seed = 42
    pop = SyndicateAccountPopulation(num_accounts=100, syndicate_ratio=0.20, seed=seed)
    print(f"Total Accounts: {len(pop.account_ids)} (Clean: {len(pop.clean_ids)}, Syndicate: {len(pop.syndicate_ids)})")
    
    # Let's train DC-LCG on a dataset where fraud scenarios sample strictly from syndicate_ids
    # and legitimate transactions sample from clean_ids (or clean -> merchant)
    rng = random.Random(seed)
    legit_gen = LegitimateTransactionGenerator(population=pop, currency="USD", seed=seed)
    train_graph = TransactionGraph()
    account_labels = {acc_id: (1 if acc_id in pop.syndicate_ids else 0) for acc_id in pop.account_ids}
    
    selected_scenarios = ["F01", "F02", "F03", "F04", "F05", "F06", "F07", "F08"]
    counter = 1
    
    # Helper to generate scenario on subpopulation
    class SubPop:
        def __init__(self, parent_pop, ids):
            self.account_ids = ids
            self.accounts = {i: parent_pop.accounts[i] for i in ids}
            self.currency = parent_pop.currency
            self.personal_ids = [i for i in ids if parent_pop.accounts[i].account_type == "PERSONAL"]
            self.business_ids = [i for i in ids if parent_pop.accounts[i].account_type == "BUSINESS"]
            self.merchant_ids = [i for i in ids if parent_pop.accounts[i].account_type == "MERCHANT"]
            self.dormant_ids = [i for i in ids if parent_pop.accounts[i].account_type == "DORMANT"]
            self.rng = parent_pop.rng
        def sample_pair(self, cat="p2p"):
            s, r = random.sample(self.account_ids, 2)
            return self.accounts[s], self.accounts[r]

    syndicate_subpop = SubPop(pop, pop.syndicate_ids)
    clean_subpop = SubPop(pop, pop.clean_ids)
    
    for i in range(2500):
        is_fraud = (rng.random() * 100.0) < 20.0
        if is_fraud:
            scen_id = rng.choice(selected_scenarios)
            seq_txns, counter = scenario_registry.generate_sequence(
                scenario_id=scen_id,
                population=syndicate_subpop,
                base_time=datetime.now(timezone.utc),
                txn_prefix="TXN",
                counter_start=counter,
                rng=rng,
            )
            if seq_txns:
                for tx in seq_txns:
                    train_graph.add_transaction(tx["sender_account"], tx["receiver_account"], float(tx["amount"]), tx["timestamp"])
        else:
            s, r = clean_subpop.sample_pair()
            amt = float(legit_gen._sample_amount("p2p"))
            train_graph.add_transaction(s.account_id, r.account_id, amt, datetime.now(timezone.utc))

    print(f"Training Graph: {len(train_graph.nodes)} nodes ({sum(account_labels.values())} fraud, {len(account_labels)-sum(account_labels.values())} legit), {len(train_graph.transactions)} edges")
    
    # Train DC-LCG
    model, info = train_dclcg(
        train_graph,
        labels=account_labels,
        epochs=35,
        lr=0.005,
        hidden_dim=32,
        seed=42,
    )
    
    _, X_raw = build_value_features(train_graph)
    scaler = FeatureScaler()
    scaler.fit(X_raw)
    
    save_path = os.path.join(ARTIFACT_DIR, "dclcg_prod_e2e.pt")
    torch.save({
        "state_dict": model.state_dict(),
        "accounts": list(train_graph.nodes),
        "scaler": scaler.to_dict(),
        "config": {"hidden_dim": 32, "n_layers": 2},
    }, save_path)
    print("Trained and saved clean model artifact to", save_path)
    
    # Now run inference test on independent test graph
    bundle = load_artifact(save_path)
    res = predict_graph(train_graph, bundle)
    probs = res["probs"]
    
    fraud_p = [probs[a] for a in pop.syndicate_ids if a in probs]
    legit_p = [probs[a] for a in pop.clean_ids if a in probs]
    
    print("\n--- INFERENCE SEPARATION CHECK ---")
    print(f"Syndicate Accounts (Fraud) Probs: Mean={np.mean(fraud_p):.4f}, Min={np.min(fraud_p):.4f}, Max={np.max(fraud_p):.4f}")
    print(f"Clean Accounts (Legitimate) Probs: Mean={np.mean(legit_p):.4f}, Min={np.min(legit_p):.4f}, Max={np.max(legit_p):.4f}")

if __name__ == "__main__":
    test_syndicate_architecture()
