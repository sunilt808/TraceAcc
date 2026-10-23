import sys
from pathlib import Path
backend_path = Path(r"c:\traceacc\TraceAcc1\backend")
sys.path.insert(0, str(backend_path))

import torch
import numpy as np
from utils.graph import TransactionGraph
from detectors.dclcg.inference import load_artifact
from detectors.dclcg.value_encoder import build_value_features, FeatureScaler
from detectors.dclcg.model import DCLCGModel, WalkGraph
from detectors.dclcg.train import ARTIFACT_DIR
import os

from services.liveshield.accounts import AccountPopulation
from services.liveshield.legitimate import LegitimateTransactionGenerator
from services.liveshield.registry import scenario_registry
import random
from datetime import datetime, timezone

def test_priors():
    seed = 42
    rng = random.Random(seed)
    population = AccountPopulation(num_accounts=60, currency="USD", seed=seed)
    legit_gen = LegitimateTransactionGenerator(population=population, currency="USD", seed=seed)
    selected_scenarios = ["F01", "F02", "F03", "F04", "F05", "F06"]
    
    graph = TransactionGraph()
    ground_truth = {}
    counter = 1
    
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
                    ground_truth[tx["sender_account"]] = 1
                    ground_truth[tx["receiver_account"]] = 1
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
    accounts, X_raw = build_value_features(graph)
    scaler = FeatureScaler.from_dict(bundle["scaler"])
    X_np = scaler.transform(X_raw)
    edges = [(tx["sender"], tx["receiver"]) for tx in graph.transactions]
    walk_graph = WalkGraph(accounts, edges)
    
    model = DCLCGModel(in_dim=X_np.shape[1], hidden_dim=32, n_layers=2)
    model.load_state_dict(bundle["state_dict"])
    model.eval()

    # Test 1: Current soft label logic from heuristics
    from detectors.score import compute_scores_and_rings
    from detectors.cycle import find_cycles
    from detectors.fan import detect_fan_patterns
    from detectors.layering import find_layered_shells
    from detectors.burst import detect_burst_activity

    cycles = find_cycles(graph, max_length=4, max_cycles=100)
    fans = detect_fan_patterns(graph, threshold=3, time_window_hours=72)
    shells = find_layered_shells(graph, min_chain_length=3, max_degree=3)
    bursts = detect_burst_activity(graph, dormant_days=180, burst_threshold=10, burst_window_hours=72)
    suspicious, _ = compute_scores_and_rings(cycle_rings=cycles, fan_rings=fans, shell_rings=shells, burst_accounts=bursts)
    raw = {a["account_id"]: float(a["suspicion_score"]) for a in suspicious}
    mx = max(raw.values(), default=1.0) or 1.0
    soft_curr = np.array([min(raw.get(a, 0.0) / mx, 1.0) for a in accounts], dtype=np.float32)
    
    paths_curr = walk_graph.random_walks(soft_curr, seed=11)
    x_t = torch.tensor(X_np, dtype=torch.float32)
    with torch.no_grad():
        p_curr, _, _ = model(x_t, torch.tensor(soft_curr), walk_graph.neighbors, paths_curr)
    p_curr = p_curr.numpy()

    # Test 2: Prior baseline soft labels (neutral 0.15 prior or robustly scaled)
    # Robust scaling: only accounts with high multi-pattern suspicion or extreme volume
    soft_robust = np.zeros(len(accounts), dtype=np.float32)
    for i, a in enumerate(accounts):
        score = raw.get(a, 0.0)
        # Only if score is substantial compared to average
        if score >= 30.0: # threshold for multiple confirmed rings
            soft_robust[i] = min(score / 100.0, 1.0)
        else:
            soft_robust[i] = 0.05
            
    paths_robust = walk_graph.random_walks(soft_robust, seed=11)
    with torch.no_grad():
        p_robust, _, _ = model(x_t, torch.tensor(soft_robust), walk_graph.neighbors, paths_robust)
    p_robust = p_robust.numpy()

    print(f"Current soft_np: Mean={np.mean(soft_curr):.4f}, Min={np.min(soft_curr):.4f}, Max={np.max(soft_curr):.4f}")
    print(f"Current model probs: Mean={np.mean(p_curr):.4f}, Min={np.min(p_curr):.4f}, Max={np.max(p_curr):.4f}")
    print(f"\nRobust soft_np: Mean={np.mean(soft_robust):.4f}, Min={np.min(soft_robust):.4f}, Max={np.max(soft_robust):.4f}")
    print(f"Robust model probs: Mean={np.mean(p_robust):.4f}, Min={np.min(p_robust):.4f}, Max={np.max(p_robust):.4f}")
    
    # Check distribution of p_robust
    print("\nRobust Probabilities Percentiles (p10, p25, p50, p75, p90, p99):")
    for q in [10, 25, 50, 75, 90, 99]:
        print(f"  p{q}: {np.percentile(p_robust, q):.4f}")

if __name__ == "__main__":
    test_priors()
