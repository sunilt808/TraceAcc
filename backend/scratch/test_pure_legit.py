import sys
from pathlib import Path
backend_path = Path(r"c:\traceacc\TraceAcc1\backend")
sys.path.insert(0, str(backend_path))

import random
from datetime import datetime, timezone
import numpy as np

from services.liveshield.accounts import AccountPopulation
from services.liveshield.legitimate import LegitimateTransactionGenerator
from utils.graph import TransactionGraph
from detectors.dclcg.inference import load_artifact, predict_graph
from detectors.dclcg.train import ARTIFACT_DIR
import os

def test_pure_legit():
    seed = 42
    population = AccountPopulation(num_accounts=60, currency="USD", seed=seed)
    legit_gen = LegitimateTransactionGenerator(population=population, currency="USD", seed=seed)
    graph = TransactionGraph()
    
    # 500 PURELY LEGITIMATE TRANSACTIONS
    for _ in range(500):
        txn = legit_gen.generate_single_transaction()
        graph.add_transaction(txn["sender_account"], txn["receiver_account"], float(txn["amount"]), txn["timestamp"])
        
    print(f"Graph nodes: {len(graph.nodes)}, Graph txns: {len(graph.transactions)}")
    
    from detectors.cycle import find_cycles
    from detectors.fan import detect_fan_patterns
    from detectors.score import compute_scores_and_rings
    
    cycles = find_cycles(graph, max_length=4, max_cycles=100)
    fans = detect_fan_patterns(graph, threshold=3, time_window_hours=72)
    print(f"Cycles detected in pure legitimate traffic: {len(cycles)}")
    print(f"Fans detected in pure legitimate traffic: {len(fans)}")
    
    suspicious, _ = compute_scores_and_rings(cycle_rings=cycles, fan_rings=fans, shell_rings={}, burst_accounts=[])
    print(f"Accounts flagged as suspicious in pure legitimate traffic: {len(suspicious)} out of {len(graph.nodes)}")
    
    bundle = load_artifact(os.path.join(ARTIFACT_DIR, "dclcg_prod_e2e.pt"))
    res = predict_graph(graph, bundle)
    probs = list(res["probs"].values())
    print(f"DC-LCG model probabilities on PURE LEGITIMATE traffic: Mean={np.mean(probs):.4f}, Min={np.min(probs):.4f}, Max={np.max(probs):.4f}")
    
if __name__ == "__main__":
    test_pure_legit()
