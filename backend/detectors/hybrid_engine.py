"""
hybrid_engine.py — Hybrid Risk Scoring Engine.

Combines signals from five dimensions into one final score (0-100):

  1. Graph Score     — from existing heuristics (cycle/fan/burst/layering)
  2. Behaviour Score — from account profile (pass-through, volume)
  3. Temporal Score  — from temporal pattern detector
  4. Community Score — from community / component membership
  5. ML Score        — from Isolation Forest, LOF, DBSCAN

Each dimension is independently explainable.
Final score = weighted sum, capped at 100.
"""
from typing import Dict, Any, List

# ── Dimension weights (must sum to 1.0) ───────────────────────
WEIGHTS = {
    "graph":      0.35,
    "behaviour":  0.20,
    "temporal":   0.15,
    "community":  0.10,
    "ml":         0.20,
}


def compute_hybrid_scores(
    *,
    graph_scores:     Dict[str, float],
    profile_result:   Dict[str, Any],
    temporal_result:  Dict[str, Any],
    community_result: Dict[str, Any],
    ml_result:        Dict[str, Any],
    all_accounts:     List[str],
) -> List[Dict[str, Any]]:
    """
    Produce a hybrid risk score for every account.

    Args:
        graph_scores:     account_id → suspicion_score (0-100) from score.py
        profile_result:   output of build_account_profiles()
        temporal_result:  output of detect_temporal_patterns()
        community_result: output of detect_communities()
        ml_result:        output of detect_ml_anomalies()
        all_accounts:     complete list of account IDs

    Returns:
        List of per-account score dicts with full breakdown.
    """

    # ── Index profiles by account ──────────────────────────────
    profile_map: Dict[str, Dict] = {
        p["account_id"]: p
        for p in profile_result.get("profiles", [])
    }

    # ── Temporal flag sets ─────────────────────────────────────
    night_set    = {x["account_id"] for x in temporal_result.get("night_actors",    [])}
    weekend_set  = {x["account_id"] for x in temporal_result.get("weekend_actors",  [])}
    rapid_set    = {x["account_id"] for x in temporal_result.get("rapid_movers",    [])}
    periodic_set = {x["account_id"] for x in temporal_result.get("periodic_actors", [])}

    # ── Community map (Louvain) ────────────────────────────────
    louvain_map: Dict[str, int] = community_result.get("louvain", {})
    # Count members per community to score large ones higher
    from collections import Counter
    community_sizes = Counter(louvain_map.values())

    # ── ML combined map ────────────────────────────────────────
    ml_combined: Dict[str, Dict] = ml_result.get("combined", {})

    results: List[Dict[str, Any]] = []

    for acc in all_accounts:
        # ── 1. Graph score ─────────────────────────────────────
        g_score = min(graph_scores.get(acc, 0), 100)

        # ── 2. Behaviour score ─────────────────────────────────
        profile = profile_map.get(acc, {})
        b_score = min(profile.get("risk_signal", 0), 100)

        # ── 3. Temporal score ──────────────────────────────────
        t_score = 0.0
        temporal_flags = []
        if acc in night_set:
            t_score += 40; temporal_flags.append("night_activity")
        if acc in weekend_set:
            t_score += 25; temporal_flags.append("weekend_activity")
        if acc in rapid_set:
            t_score += 50; temporal_flags.append("rapid_movement")
        if acc in periodic_set:
            t_score += 30; temporal_flags.append("periodic_behaviour")
        t_score = min(t_score, 100)

        # ── 4. Community score ─────────────────────────────────
        comm_id = louvain_map.get(acc)
        if comm_id is not None:
            comm_size = community_sizes.get(comm_id, 1)
            # Larger tightly-knit communities are more suspicious
            c_score = min(comm_size * 5, 100)
        else:
            c_score = 0.0

        # ── 5. ML score ────────────────────────────────────────
        ml_entry = ml_combined.get(acc, {})
        m_score  = ml_entry.get("ml_score", 0.0)

        # ── Weighted final score ───────────────────────────────
        final = (
            g_score * WEIGHTS["graph"] +
            b_score * WEIGHTS["behaviour"] +
            t_score * WEIGHTS["temporal"] +
            c_score * WEIGHTS["community"] +
            m_score * WEIGHTS["ml"]
        )
        final = round(min(final, 100), 2)

        # ── Risk tier ─────────────────────────────────────────
        if final >= 75:
            risk_tier = "CRITICAL"
        elif final >= 50:
            risk_tier = "HIGH"
        elif final >= 25:
            risk_tier = "MEDIUM"
        else:
            risk_tier = "LOW"

        results.append({
            "account_id":  acc,
            "final_score": final,
            "risk_tier":   risk_tier,
            "breakdown": {
                "graph_score":     round(g_score, 2),
                "behaviour_score": round(b_score, 2),
                "temporal_score":  round(t_score, 2),
                "community_score": round(c_score, 2),
                "ml_score":        round(m_score, 2),
            },
            "temporal_flags":  temporal_flags,
            "ml_flags":        ml_entry.get("ml_flags", []),
            "community_id":    comm_id,
            "profile_snippet": {
                "total_sent":     profile.get("total_sent",     0),
                "total_received": profile.get("total_received", 0),
                "tx_count":       profile.get("tx_count",       0),
            },
        })

    results.sort(key=lambda x: x["final_score"], reverse=True)
    return results
