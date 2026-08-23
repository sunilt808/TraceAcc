"""
pattern_suite.py — 15-pattern detection orchestrator for TraceAcc Pro.

Groups:
    basic         5 foundational laundering shapes
    intermediate  5 harder structural / temporal signatures
    advanced_ml   5 model-driven detections (DC-LCG GNN + sklearn)

Each detector returns a uniform block:
    {key, name, tier, description, flagged_count, accounts, details}

The suite is deliberately read-only over the TransactionGraph so it can be
re-run on any stored dataset without side effects.
"""
from __future__ import annotations

import time
from collections import defaultdict
from datetime import timedelta
from typing import Any, Dict, List, Optional

from utils.graph import TransactionGraph
from detectors.cycle import find_cycles
from detectors.fan import detect_fan_patterns
from detectors.burst import detect_burst_activity
from detectors.layering import find_layered_shells
from detectors.amount_patterns import detect_amount_patterns
from detectors.velocity import compute_velocity
from detectors.temporal import detect_temporal_patterns
from detectors.risk_propagation import propagate_risk

MAX_ACCOUNTS_LISTED = 50


def _block(
    key: str,
    name: str,
    tier: str,
    description: str,
    accounts: List[Any],
    details: Optional[Dict[str, Any]] = None,
    runtime_ms: float = 0.0,
) -> Dict[str, Any]:
    return {
        "key": key,
        "name": name,
        "tier": tier,
        "description": description,
        "flagged_count": len(accounts),
        "accounts": accounts[:MAX_ACCOUNTS_LISTED],
        "details": details or {},
        "runtime_ms": round(runtime_ms, 1),
    }


# ── new detector: dormancy break ───────────────────────────────────────
def detect_dormant_activation(
    graph: TransactionGraph,
    silent_days: int = 30,
    post_tx_min: int = 3,
) -> List[Dict[str, Any]]:
    """Accounts silent for >= silent_days that suddenly become active."""
    times_by_account: Dict[str, list] = defaultdict(list)
    for tx in graph.transactions:
        ts = tx.get("timestamp")
        if ts is None:
            continue
        times_by_account[tx["sender"]].append(ts)
        times_by_account[tx["receiver"]].append(ts)

    results = []
    for account, times in times_by_account.items():
        if len(times) < post_tx_min + 1:
            continue
        times.sort()
        # find largest gap; check activity density after it
        best = None
        for i in range(1, len(times)):
            gap = (times[i] - times[i - 1]).total_seconds() / 86400.0
            if gap >= silent_days and (best is None or gap > best[1]):
                best = (i, gap)
        if not best:
            continue
        i, gap = best
        after = len(times) - i
        if after >= post_tx_min:
            results.append({
                "account_id": account,
                "silent_days": round(gap, 1),
                "transactions_after": after,
                "resumed_at": times[i].isoformat(),
            })
    results.sort(key=lambda x: x["silent_days"], reverse=True)
    return results


# ── helpers ────────────────────────────────────────────────────────────
def _degree(graph: TransactionGraph, node: str) -> int:
    return len(graph.get_outgoing(node)) + len(graph.get_incoming(node))


def _split_fan_rings(graph: TransactionGraph, rings: Dict[str, list]):
    """
    Fan rings are plain account lists: fan-out rings start with the hub,
    fan-in rings end with it. Classify by which endpoint holds the
    highest total degree.
    """
    fan_in, fan_out = [], []
    for ring in rings.values():
        if len(ring) < 2:
            continue
        first_deg = _degree(graph, ring[0])
        last_deg = _degree(graph, ring[-1])
        entry = {"hub": None, "members": ring}
        if first_deg >= last_deg:
            e = dict(entry); e["hub"] = ring[0]; fan_out.append(e)
        else:
            e = dict(entry); e["hub"] = ring[-1]; fan_in.append(e)
    return fan_in, fan_out


# ── main suite ─────────────────────────────────────────────────────────
def detect_all_patterns(
    graph: TransactionGraph,
    dclcg_scores: Optional[Dict[str, float]] = None,
    dclcg_meta: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Run all 15 pattern detectors.

    Args:
        graph:        parsed transaction graph
        dclcg_scores: optional {account: illicit_prob} from a trained
                      DC-LCG artifact (enables the flagship ML pattern)
        dclcg_meta:   optional metadata block (model name etc.)
    """
    patterns: List[Dict[str, Any]] = []
    warnings: List[str] = []
    amounts: Dict[str, Any] = {}  # shared between structuring & propagation

    # ══════════════════ BASIC (5) ══════════════════

    # 1. Circular transactions -----------------------------------------
    t0 = time.time()
    try:
        cycles = find_cycles(graph)
        cyc_accounts = sorted({a for ring in cycles.values() for a in ring})
        patterns.append(_block(
            "circular_transaction", "Circular Transactions", "basic",
            "Funds loop back to their origin through 2-3 hop cycles - "
            "the classic layering signature.",
            [{"account_id": a} for a in cyc_accounts],
            {"rings": [
                {"ring_id": rid, "path": path}
                for rid, path in list(cycles.items())[:20]
            ]},
            (time.time() - t0) * 1000,
        ))
    except Exception as exc:  # noqa: BLE001
        warnings.append(f"circular_transaction failed: {exc}")

    # 2. Fan-In ----------------------------------------------------------
    t0 = time.time()
    try:
        fans = detect_fan_patterns(graph)
        fan_in, fan_out = _split_fan_rings(graph, fans)
        fi_accounts = sorted({m for r in fan_in for m in r["members"]})
        patterns.append(_block(
            "fan_in", "Fan-In (Many-to-One)", "basic",
            "Many senders funnel money into one hub within a short window.",
            [{"account_id": r["hub"], "member_count": len(r["members"])}
             for r in fan_in],
            {"rings": fan_in[:20]},
            (time.time() - t0) * 1000,
        ))

        # 3. Fan-Out (same pass, reported separately) --------------------
        fo_accounts = sorted({m for r in fan_out for m in r["members"]})
        patterns.append(_block(
            "fan_out", "Fan-Out (One-to-Many)", "basic",
            "One hub disperses funds to many receivers within a short window.",
            [{"account_id": r["hub"], "member_count": len(r["members"])}
             for r in fan_out],
            {"rings": fan_out[:20]},
            (time.time() - t0) * 1000,
        ))
    except Exception as exc:  # noqa: BLE001
        warnings.append(f"fan patterns failed: {exc}")

    # 4. Burst activity ---------------------------------------------------
    t0 = time.time()
    try:
        bursts = detect_burst_activity(graph)
        burst_list = [
            {"account_id": acc, **info} for acc, info in bursts.items()
        ]
        burst_list.sort(key=lambda x: x.get("burst_count", 0), reverse=True)
        patterns.append(_block(
            "burst_activity", "Burst Activity", "basic",
            "Unusually high transaction count packed into a short window "
            "after a quiet period.",
            burst_list,
            {},
            (time.time() - t0) * 1000,
        ))
    except Exception as exc:  # noqa: BLE001
        warnings.append(f"burst_activity failed: {exc}")

    # 5. Structuring / smurfing -------------------------------------------
    t0 = time.time()
    try:
        amounts = detect_amount_patterns(graph)
        patterns.append(_block(
            "structuring", "Structuring / Smurfing", "basic",
            "Repeated transfers kept just below reporting thresholds "
            "(e.g. $8k-$9k) to evade detection.",
            amounts["structuring"],
            {"threshold_band": "8000-9000"},
            (time.time() - t0) * 1000,
        ))
    except Exception as exc:  # noqa: BLE001
        warnings.append(f"structuring failed: {exc}")

    # ══════════════════ INTERMEDIATE / HARD (5) ══════════════════

    # 6. Layered shells ----------------------------------------------------
    t0 = time.time()
    try:
        shells = find_layered_shells(graph)
        shell_accounts = sorted({
            a for ring in shells.values()
            for a in (ring if isinstance(ring, list) else [])
        })
        patterns.append(_block(
            "layering_shells", "Layered Shell Chains", "intermediate",
            "Long chains through low-degree 'shell' accounts designed to "
            "obscure the money trail.",
            [{"account_id": a} for a in shell_accounts],
            {"chains": [
                {"chain_id": cid, "path": path}
                for cid, path in list(shells.items())[:20]
            ]},
            (time.time() - t0) * 1000,
        ))
    except Exception as exc:  # noqa: BLE001
        warnings.append(f"layering_shells failed: {exc}")

    # 7. Rapid movement / velocity anomaly ---------------------------------
    t0 = time.time()
    try:
        velocity = compute_velocity(graph)
        hv = velocity["high_velocity_accounts"]
        patterns.append(_block(
            "rapid_movement", "Rapid Movement (Velocity Anomaly)", "intermediate",
            "Accounts transacting faster than human-plausible rates - "
            "a hallmark of automated mule behaviour.",
            hv,
            {"thresholds": velocity["summary"]["thresholds_used"]},
            (time.time() - t0) * 1000,
        ))
    except Exception as exc:  # noqa: BLE001
        warnings.append(f"rapid_movement failed: {exc}")

    # 8. Night-time activity --------------------------------------------------
    t0 = time.time()
    try:
        temporal = detect_temporal_patterns(graph)
        night = temporal["night_actors"]
        patterns.append(_block(
            "night_activity", "Night-Time Activity (23:00-05:00)", "intermediate",
            "Majority of an account's transactions occur at night, outside "
            "normal banking hours.",
            night,
            {"weekend_actors": len(temporal["weekend_actors"])},
            (time.time() - t0) * 1000,
        ))

        # 9. Periodic / bot-like transfers (same pass) ---------------------
        periodic = temporal["periodic_actors"]
        patterns.append(_block(
            "periodic_transfers", "Periodic Bot-like Transfers", "intermediate",
            "Transfers at suspiciously regular intervals with near-zero "
            "deviation - scripted automation signature.",
            periodic,
            {},
            (time.time() - t0) * 1000,
        ))
    except Exception as exc:  # noqa: BLE001
        warnings.append(f"temporal patterns failed: {exc}")

    # 10. Dormancy break -------------------------------------------------------
    try:
        dormant = detect_dormant_activation(graph)
        patterns.append(_block(
            "dormant_activation", "Dormant Account Activation", "intermediate",
            "Accounts silent for 30+ days that suddenly resume heavy "
            "activity - hijacked or rented mule accounts.",
            dormant,
            {},
            0.0,
        ))
    except Exception as exc:  # noqa: BLE001
        warnings.append(f"dormant_activation failed: {exc}")

    # ══════════════════ ADVANCED ML (5) ══════════════════

    # 11. DC-LCG dual-view GNN (flagship) -----------------------------------
    t0 = time.time()
    if dclcg_scores:
        ranked = sorted(dclcg_scores.items(), key=lambda kv: kv[1], reverse=True)
        flagged = [(a, p) for a, p in ranked if p >= 0.5]
        patterns.append(_block(
            "dclcg_gnn", "DC-LCG Dual-View GNN Score", "advanced_ml",
            "Basepaper model: soft-label grouping + pruned random-walk "
            "transformer with mutual-gate fusion predicts per-account "
            "illicit probability.",
            [{"account_id": a, "illicit_prob": round(p, 4)}
             for a, p in flagged],
            {
                "model": (dclcg_meta or {}).get("model"),
                "n_scored": len(dclcg_scores),
                "top_preview": [
                    {"account_id": a, "illicit_prob": round(p, 4)}
                    for a, p in ranked[:10]
                ],
            },
            (time.time() - t0) * 1000,
        ))
    else:
        patterns.append(_block(
            "dclcg_gnn", "DC-LCG Dual-View GNN Score", "advanced_ml",
            "No trained DC-LCG artifact found. Train one from the Model "
            "Registry panel to enable this detector.",
            [],
            {"available": False},
            0.0,
        ))

    # 12-14. Isolation Forest / LOF / DBSCAN ---------------------------------
    t0 = time.time()
    try:
        from detectors.ml_anomaly import detect_ml_anomalies
        ml = detect_ml_anomalies(graph)
        combined = ml.get("combined", {})
        iso, lof, dbn = [], [], []
        for aid, entry in combined.items():
            flags = entry.get("flags", [])
            row = {"account_id": aid,
                   "ml_flag_count": entry.get("ml_flag_count", len(flags))}
            if "isolation_forest" in flags:
                iso.append(row)
            if "lof" in flags:
                lof.append(row)
            if "dbscan" in flags:
                dbn.append(row)
        patterns.append(_block(
            "isolation_forest", "Isolation Forest Anomaly", "advanced_ml",
            "Tree-ensemble isolation score on behavioural features - "
            "accounts that are easy to isolate are anomalous.",
            iso, {}, (time.time() - t0) * 1000,
        ))
        patterns.append(_block(
            "lof", "Local Outlier Factor", "advanced_ml",
            "Density-based outlier score - accounts in sparse neighbourhoods "
            "of the feature space.",
            lof, {}, 0.0,
        ))
        patterns.append(_block(
            "dbscan_noise", "DBSCAN Noise Points", "advanced_ml",
            "Accounts that fit no dense behavioural cluster - neither normal "
            "nor known-mule archetype.",
            dbn, {}, 0.0,
        ))
    except Exception as exc:  # noqa: BLE001
        warnings.append(f"sklearn ML patterns failed: {exc}")

    # 15. Risk-propagation hotspots -------------------------------------------
    t0 = time.time()
    try:
        base_scores: Dict[str, float] = defaultdict(float)
        # cheap heuristic base: structuring count as seed signal
        for entry in amounts.get("structuring", []):
            base_scores[entry["account_id"]] = min(
                60 + 5 * entry.get("count", 1), 100)
        prop = propagate_risk(graph, base_scores)
        hot = sorted(
            prop["propagated_scores"].items(), key=lambda kv: kv[1],
            reverse=True)
        hot = [(a, s) for a, s in hot if s >= 40]
        patterns.append(_block(
            "risk_propagation", "Risk-Propagation Hotspots", "advanced_ml",
            "Graph-diffused suspicion (1-hop 40% / 2-hop 15% decay): "
            "neighbours of high-risk nodes inherit measurable risk.",
            [{"account_id": a, "propagated_score": round(s, 2)}
             for a, s in hot],
            {},
            (time.time() - t0) * 1000,
        ))
    except Exception as exc:  # noqa: BLE001
        warnings.append(f"risk_propagation failed: {exc}")

    return {
        "total_patterns": len(patterns),
        "total_flagged_accounts": sum(p["flagged_count"] for p in patterns),
        "tiers": {
            "basic": sum(1 for p in patterns if p["tier"] == "basic"),
            "intermediate": sum(
                1 for p in patterns if p["tier"] == "intermediate"),
            "advanced_ml": sum(
                1 for p in patterns if p["tier"] == "advanced_ml"),
        },
        "warnings": warnings,
        "patterns": patterns,
    }
