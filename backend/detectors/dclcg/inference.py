"""
inference.py — load a trained DC-LCG artifact and run prediction on a
TransactionGraph, producing:

  probs      : account -> illicit probability (0-1)
  disguise   : account -> camouflage score (paper Fig.1a homophily inverted;
               high = neighbours look unlike the node = disguised mule)
  top_paths  : account -> most suspicious pruned transaction paths
"""
from __future__ import annotations

import os
from typing import Dict, List, Optional, Tuple

import numpy as np
import torch

from .value_encoder import build_value_features, FeatureScaler
from .model import DCLCGModel, WalkGraph


def _artifact_path(name: str) -> str:
    from .train import ARTIFACT_DIR

    safe = "".join(c for c in name if c.isalnum() or c in "-_") or "model"
    return os.path.join(ARTIFACT_DIR, f"dclcg_{safe}.pt")


def load_artifact(path: str) -> dict:
    """Load a saved artifact bundle (state_dict + accounts + config)."""
    bundle = torch.load(path, map_location="cpu", weights_only=False)
    return bundle


def predict_graph(graph, bundle: dict) -> Dict[str, object]:
    """
    Run inference with a loaded artifact on a (possibly new) graph.

    The stored accounts define the feature/model layout; accounts unseen at
    training time are handled by rebuilding features over the union and only
    scoring known ones — for the common case (same dataset re-scored) all
    nodes are scored.
    """
    train_accounts: List[str] = list(bundle["accounts"])
    config = bundle.get("config", {})

    # Build features over the CURRENT graph.
    accounts, X_raw = build_value_features(graph)
    index = {a: i for i, a in enumerate(accounts)}

    # Apply persisted FeatureScaler if available in artifact bundle
    if bundle.get("scaler"):
        scaler = FeatureScaler.from_dict(bundle["scaler"])
        X_np = scaler.transform(X_raw)
    else:
        X_np = X_raw

    edges = [(tx["sender"], tx["receiver"]) for tx in graph.transactions]
    walk_graph = WalkGraph(accounts, edges)

    model = DCLCGModel(
        in_dim=X_np.shape[1],
        hidden_dim=int(config.get("hidden_dim", 32)),
        n_layers=int(config.get("n_layers", 2)),
    )
    model.load_state_dict(bundle["state_dict"])
    model.eval()

    # Initial soft labels for THIS graph come from heuristic suspicion so the
    # grouping starts from something meaningful even on new data.
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
    # Calibrated absolute soft-label scaling: only genuinely high multi-pattern evidence elevates prior
    soft_list = []
    for a in accounts:
        score = raw.get(a, 0.0)
        if score >= 40.0:
            soft_list.append(min(score / 100.0, 0.95))
        elif score >= 20.0:
            soft_list.append(0.30)
        else:
            soft_list.append(0.05)
    soft_np = np.array(soft_list, dtype=np.float32)

    paths = walk_graph.random_walks(soft_np, seed=11)

    x_t = torch.tensor(X_np, dtype=torch.float32)
    soft_t = torch.clamp(torch.tensor(soft_np), 0.0, 1.0)
    with torch.no_grad():
        probs_t, h_emb, _ = model(x_t, soft_t, walk_graph.neighbors, paths)
    probs = probs_t.numpy().clip(0.0, 1.0)

    # ---- explainability -------------------------------------------------
    # Disguise score: fraction of neighbours whose probability is far from
    # the node's own (low neighbourhood agreement = camouflaged placement).
    disguise: Dict[str, float] = {}
    for acc in accounts:
        i = index[acc]
        nbrs = walk_graph.neighbors[i]
        if not nbrs:
            disguise[acc] = 0.0
            continue
        diffs = [abs(float(probs[j]) - float(probs[i])) for j in nbrs]
        far = sum(1 for d in diffs if d > 0.25)
        disguise[acc] = round(far / len(diffs), 3)

    top_paths: Dict[str, List[str]] = {}
    for acc in accounts[:]:
        i = index[acc]
        best = sorted(
            paths.get(i, [[i]]),
            key=lambda p: -sum(float(probs[j]) for j in p) / max(len(p), 1),
        )[:2]
        rendered = [
            " -> ".join(accounts[j] for j in p) for p in best
        ]
        top_paths[acc] = rendered

    prob_map = {a: round(float(probs[index[a]]), 4) for a in accounts}

    return {
        "probs": prob_map,
        "disguise": disguise,
        "top_paths": top_paths,
        "model_config": config,
        "train_overlap": len(set(train_accounts) & set(accounts)),
    }
