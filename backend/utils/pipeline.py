"""
pipeline.py — The ONE unified analysis pipeline for TraceAcc.

This module contains the single run_full_analysis() function that executes
ALL detectors in sequence and returns a rich, complete result dictionary.

The /analyze/advanced endpoint calls this. The old /analyze endpoint is
kept for backward compatibility but also calls this.

Every frontend page reads from AnalysisContext which caches this result.
No page triggers its own analysis — they all consume the SAME object.
"""
from __future__ import annotations

import time
import logging
from typing import Any, Dict, Optional

from utils.graph import TransactionGraph

# ── Existing core detectors ────────────────────────────────────────────
from detectors.cycle     import find_cycles
from detectors.fan       import detect_fan_patterns
from detectors.layering  import find_layered_shells
from detectors.burst     import detect_burst_activity
from detectors.score     import compute_scores_and_rings

# ── Extended detectors ─────────────────────────────────────────────────
from detectors.centrality       import compute_centrality
from detectors.community        import detect_communities
from detectors.components       import detect_components
from detectors.kcore            import detect_kcore
from detectors.bridges          import detect_bridges
from detectors.temporal         import detect_temporal_patterns
from detectors.velocity         import compute_velocity
from detectors.amount_patterns  import detect_amount_patterns
from detectors.repeat           import detect_repeat_pairs
from detectors.motifs           import detect_motifs
from detectors.account_profile  import build_account_profiles
from detectors.ml_anomaly       import detect_ml_anomalies
from detectors.hybrid_engine    import compute_hybrid_scores
from detectors.risk_propagation import propagate_risk

logger = logging.getLogger("trackacc.pipeline")


def run_full_analysis(
    graph: TransactionGraph,
    *,
    cycle_max_length:   int = 4,
    cycle_max_cycles:   int = 200,
    fan_threshold:      int = 3,
    fan_time_window:    int = 72,
    shell_min_chain:    int = 3,
    shell_max_degree:   int = 3,
    burst_dormant_days: int = 180,
    burst_threshold:    int = 10,
    burst_window_hours: int = 72,
) -> Dict[str, Any]:
    """
    Run the complete TraceAcc detection pipeline on a TransactionGraph.

    This is the ONLY place where all detectors are called.
    Both /analyze and /analyze/advanced delegate to this function.

    Parameters
    ----------
    graph : TransactionGraph
        The fully built transaction graph from parse_csv().
    All other params are tunable thresholds passed from user settings.

    Returns
    -------
    dict  A rich analysis result consumed by every frontend page.
    """
    t0 = time.perf_counter()

    # ── STAGE 1: Heuristic & Graph Structural Detectors ───────────────
    logger.info("Stage 1 — Core heuristics (Cycles, Fan-In/Out, Layered Shells, Burst Activity)")
    cycle_rings    = find_cycles(graph, max_length=cycle_max_length, max_cycles=cycle_max_cycles)
    fan_rings      = detect_fan_patterns(graph, threshold=fan_threshold, time_window_hours=fan_time_window)
    shell_rings    = find_layered_shells(graph, min_chain_length=shell_min_chain, max_degree=shell_max_degree)
    burst_accounts = detect_burst_activity(
        graph,
        dormant_days=burst_dormant_days,
        burst_threshold=burst_threshold,
        burst_window_hours=burst_window_hours,
    )

    # ── STAGE 2: Extended Graph, Temporal & Amount Analytics ───────────
    logger.info("Stage 2 — Extended analytics (Centrality, Communities, K-Core, Bridges, Temporal, Structuring/Smurfing, Motifs)")
    centrality  = compute_centrality(graph)
    community   = detect_communities(graph)
    components  = detect_components(graph)
    kcore       = detect_kcore(graph, min_k=2)
    bridges     = detect_bridges(graph)
    temporal    = detect_temporal_patterns(graph)
    velocity    = compute_velocity(graph)
    amount_pats = detect_amount_patterns(graph)
    repeat_pairs= detect_repeat_pairs(graph)
    motifs      = detect_motifs(graph)
    profiles    = build_account_profiles(graph)

    # ── STAGE 3: ML Anomaly Detection (Isolation Forest, LOF, DBSCAN) ───
    logger.info("Stage 3 — ML Unsupervised Anomaly Detection")
    ml = detect_ml_anomalies(graph)

    # ── STAGE 4: Multi-Typology Scoring & Ring Aggregation ────────────
    logger.info("Stage 4 — Scoring engine & ring synthesis across 19 typologies")
    suspicious_accounts, fraud_rings = compute_scores_and_rings(
        cycle_rings=cycle_rings,
        fan_rings=fan_rings,
        shell_rings=shell_rings,
        burst_accounts=burst_accounts,
        amount_patterns=amount_pats,
        temporal_patterns=temporal,
        bridge_patterns=bridges,
        ml_anomalies=ml,
        community_patterns=community,
    )
    base_scores = {a["account_id"]: a["suspicion_score"] for a in suspicious_accounts}

    # ── STAGE 5: Hybrid Scoring & PageRank Risk Propagation ───────────
    logger.info("Stage 5 — Hybrid scoring and graph risk propagation")
    hybrid_scores = compute_hybrid_scores(
        graph_scores=base_scores,
        profile_result=profiles,
        temporal_result=temporal,
        community_result=community,
        ml_result=ml,
        all_accounts=list(graph.nodes),
    )
    propagation = propagate_risk(graph, base_scores)

    # ── Build raw graph edges for frontend Cytoscape ──────────────────
    # Include up to 2000 transactions to keep payload reasonable
    raw_edges = [
        {
            "source": tx["sender"],
            "target": tx["receiver"],
            "amount": tx["amount"],
            "timestamp": tx["timestamp"].isoformat() if hasattr(tx["timestamp"], "isoformat") else str(tx["timestamp"]),
        }
        for tx in graph.transactions[:2000]
    ]

    processing_time = round(time.perf_counter() - t0, 3)
    logger.info(
        "Pipeline complete in %.3fs: %d accounts, %d txns, %d rings, %d suspicious accounts",
        processing_time,
        len(graph.nodes),
        len(graph.transactions),
        len(fraud_rings),
        len(suspicious_accounts),
    )

    return {
        # ── Meta ──────────────────────────────────────────────────────
        "summary": {
            "total_accounts_analyzed":    len(graph.nodes),
            "total_transactions":         len(graph.transactions),
            "suspicious_accounts_flagged": len(suspicious_accounts),
            "fraud_rings_detected":       len(fraud_rings),
            "processing_time_seconds":    processing_time,
            "detector_counts": {
                "cycles":       len(cycle_rings),
                "fans":         len(fan_rings),
                "shells":       len(shell_rings),
                "bursts":       len(burst_accounts),
                "triangles":    motifs["summary"]["triangles"],
                "stars":        motifs["summary"]["stars"],
                "chains":       motifs["summary"]["chains"],
                "diamonds":     motifs["summary"]["diamonds"],
                "scc":          components["summary"].get("total_scc", 0),
                "bridges":      bridges["summary"].get("total_bridge_edges", 0),
                "night_actors": temporal["summary"]["night_actor_count"],
                "rapid_movers": temporal["summary"]["rapid_mover_count"],
                "ml_flagged":   ml["summary"].get("total_ml_flagged", 0),
            },
        },
        # ── Core detection (backward-compatible fields) ───────────────
        "suspicious_accounts": suspicious_accounts,
        "fraud_rings":         fraud_rings,
        # ── Graph structure for Cytoscape ─────────────────────────────
        "graph": {
            "nodes": list(graph.nodes),
            "edges": raw_edges,
            "node_count": len(graph.nodes),
            "edge_count": len(raw_edges),
        },
        # ── Hybrid scoring ────────────────────────────────────────────
        "hybrid_scores": hybrid_scores[:200],
        # ── Analytics layers ──────────────────────────────────────────
        "centrality":     dict(list(centrality.items())[:100]),
        "communities":    community,
        "components":     components,
        "kcore":          kcore,
        "bridges":        bridges,
        "temporal":       temporal,
        "velocity":       velocity,
        "amount_patterns":amount_pats,
        "repeat_pairs":   repeat_pairs,
        "motifs":         motifs,
        "account_profiles": profiles["profiles"][:200],
        # ── ML results ───────────────────────────────────────────────
        "ml_anomalies": {
            "available":       ml["available"],
            "isolation_forest": ml["isolation_forest"][:30],
            "lof":             ml["lof"][:30],
            "dbscan_noise":    ml["dbscan_noise"][:30],
            "combined":        {k: v for k, v in list(ml.get("combined", {}).items())[:50]},
            "summary":         ml["summary"],
        },
        # ── Risk propagation ─────────────────────────────────────────
        "risk_propagation": {
            "summary": propagation["summary"],
            "top_propagated": sorted(
                [{"account_id": k, "score": v}
                 for k, v in propagation["propagated_scores"].items()],
                key=lambda x: x["score"], reverse=True
            )[:100],
        },
    }
