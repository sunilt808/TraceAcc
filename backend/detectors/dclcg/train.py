"""
train.py — DC-LCG training loop with a soft-label buffer (paper Alg. 2).

Supervised mode:    pass `labels` {account: 0|1} from a labeled CSV.
Weak-supervised:    labels are bootstrapped from the existing heuristic
                    engine (score.py suspicion scores) — this is what makes
                    DC-LCG usable on unlabeled client uploads.

Artifacts are saved to backend/models_artifacts/ as torch archives with
config + metrics + accounts metadata for the registry.
"""
from __future__ import annotations

import os
import time
from typing import Dict, Optional, Tuple

import numpy as np
import torch

from .value_encoder import build_value_features
from .model import DCLCGModel, WalkGraph
from .inference import predict_graph

ARTIFACT_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "models_artifacts",
)


def _weak_labels_from_heuristics(graph) -> Dict[str, float]:
    """Bootstrap soft labels from the heuristic suspicion engine."""
    from detectors.score import compute_scores_and_rings
    from detectors.cycle import find_cycles
    from detectors.fan import detect_fan_patterns
    from detectors.layering import find_layered_shells
    from detectors.burst import detect_burst_activity

    cycles = find_cycles(graph, max_length=4, max_cycles=100)
    fans = detect_fan_patterns(graph, threshold=3, time_window_hours=72)
    shells = find_layered_shells(graph, min_chain_length=3, max_degree=3)
    bursts = detect_burst_activity(
        graph, dormant_days=180, burst_threshold=10, burst_window_hours=72
    )
    suspicious, _ = compute_scores_and_rings(
        cycle_rings=cycles, fan_rings=fans,
        shell_rings=shells, burst_accounts=bursts,
    )
    raw = {a["account_id"]: float(a["suspicion_score"]) for a in suspicious}
    mx = max(raw.values(), default=1.0) or 1.0
    return {a: min(raw.get(a, 0.0) / mx, 1.0) for a in graph.nodes}


def train_dclcg(
    graph,
    labels: Optional[Dict[str, int]] = None,
    *,
    epochs: int = 30,
    hidden_dim: int = 32,
    n_layers: int = 2,
    lr: float = 1e-2,
    walk_length: int = 6,
    walks_per_node: int = 4,
    seed: int = 7,
) -> Tuple[DCLCGModel, dict]:
    """
    Train DC-LCG on a TransactionGraph.

    Args:
        graph:  utils.graph.TransactionGraph
        labels: optional ground truth {account: 0|1}. When omitted the
                heuristic engine bootstraps weak labels.
    Returns:
        (model, info) where info carries metrics/config for the registry.
    """
    torch.manual_seed(seed)
    np.random.seed(seed)

    accounts, X_np = build_value_features(graph)
    index = {a: i for i, a in enumerate(accounts)}

    # ---- initial soft-label buffer -------------------------------------
    if labels:
        y_true = np.array(
            [float(labels.get(a, 0)) for a in accounts], dtype=np.float32
        )
        buffer = y_true.copy()
        supervised = True
    else:
        weak = _weak_labels_from_heuristics(graph)
        y_true = np.array([weak[a] for a in accounts], dtype=np.float32)
        buffer = y_true.copy()
        supervised = False

    edges = [(tx["sender"], tx["receiver"]) for tx in graph.transactions]
    walk_graph = WalkGraph(accounts, edges)
    neighbors = walk_graph.neighbors

    x_t = torch.tensor(X_np, dtype=torch.float32)
    model = DCLCGModel(in_dim=X_np.shape[1], hidden_dim=hidden_dim, n_layers=n_layers)
    opt = torch.optim.Adam(model.parameters(), lr=lr)

    history = []
    final_paths: Dict[int, list] = {}

    for epoch in range(max(epochs, 1)):
        soft = torch.clamp(torch.tensor(buffer, dtype=torch.float32), 0.0, 1.0)
        paths = walk_graph.random_walks(
            buffer,
            walk_length=walk_length,
            walks_per_node=walks_per_node,
            seed=seed + epoch,
        )
        model.train()
        opt.zero_grad()
        probs, _, _ = model(x_t, soft, neighbors, paths)

        target = torch.tensor(y_true, dtype=torch.float32)
        bce = torch.nn.functional.binary_cross_entropy(probs, target.clamp(0, 1))
        # Consistency regularizer: predictions should not drift far from
        # the current soft-label buffer too quickly (paper Eq.19 spirit).
        consist = torch.nn.functional.mse_loss(probs, soft)
        loss = bce + 0.25 * consist
        loss.backward()
        opt.step()

        # Update the soft-label buffer with model output (Alg. 2 step 16)
        buffer = probs.detach().numpy().clip(0.0, 1.0)
        history.append(float(loss.item()))

    with torch.no_grad():
        soft_final = torch.tensor(buffer, dtype=torch.float32)
        paths_final = walk_graph.random_walks(buffer, seed=seed)
        probs, h_emb, c_emb = model(x_t, soft_final, neighbors, paths_final)

    metrics: Dict[str, Optional[float]] = {}
    if supervised and 0 < y_true.sum() < len(y_true):
        try:
            from sklearn.metrics import f1_score, roc_auc_score, average_precision_score

            preds = probs.numpy()
            pred_bin = (preds >= 0.5).astype(int)
            metrics["f1"] = round(float(f1_score(y_true, pred_bin, zero_division=0)), 4)
            if len(set(y_true.tolist())) > 1:
                metrics["auc"] = round(float(roc_auc_score(y_true, preds)), 4)
                metrics["ap"] = round(float(average_precision_score(y_true, preds)), 4)
        except Exception:
            pass
    else:
        flagged = int((probs.numpy() >= 0.5).sum())
        metrics["f1"] = None
        metrics["note"] = f"weak-supervised; {flagged}/{len(accounts)} flagged"

    info = {
        "accounts": accounts,
        "n_accounts": len(accounts),
        "n_transactions": len(graph.transactions),
        "epochs": epochs,
        "hidden_dim": hidden_dim,
        "n_layers": n_layers,
        "supervised": supervised,
        "metrics": metrics,
        "loss_history": history[-10:],
        "trained_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "paths": paths_final,
        "probs": probs.detach().numpy(),
        "embeddings_local": h_emb.detach().numpy(),
        "embeddings_ctx": c_emb.detach().numpy(),
    }
    return model, info


def save_artifact(model: DCLCGModel, info: dict, name: str) -> str:
    """Persist model + metadata into the registry directory."""
    os.makedirs(ARTIFACT_DIR, exist_ok=True)
    safe = "".join(c for c in name if c.isalnum() or c in "-_") or "model"
    path = os.path.join(ARTIFACT_DIR, f"dclcg_{safe}.pt")
    torch.save(
        {
            "state_dict": model.state_dict(),
            "accounts": info["accounts"],
            "config": {
                k: info[k]
                for k in ("epochs", "hidden_dim", "n_layers", "supervised",
                          "n_accounts", "n_transactions", "metrics", "trained_at")
            },
        },
        path,
    )
    return path
