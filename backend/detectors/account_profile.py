"""
account_profile.py — Behavioural profile generation per account.

Aggregates per-account statistics from the transaction graph:
total sent, total received, unique counterparties, time span,
avg amount, velocity, and a composite risk signal.
"""
from typing import Dict, Any, List
from collections import defaultdict
from datetime import datetime, timezone
from utils.graph import TransactionGraph


def build_account_profiles(graph: TransactionGraph) -> Dict[str, Any]:
    """
    Build a behavioural profile for every account in the graph.

    Returns:
        profiles: list of account profile dicts
        summary:  aggregated stats
    """
    sent:     Dict[str, List[float]]    = defaultdict(list)
    received: Dict[str, List[float]]    = defaultdict(list)
    sent_to:  Dict[str, set]            = defaultdict(set)
    recv_from:Dict[str, set]            = defaultdict(set)
    timestamps: Dict[str, List[datetime]] = defaultdict(list)

    for tx in graph.transactions:
        s, r, amt, ts = tx["sender"], tx["receiver"], tx["amount"], tx["timestamp"]
        sent[s].append(amt)
        received[r].append(amt)
        sent_to[s].add(r)
        recv_from[r].add(s)
        if ts:
            timestamps[s].append(ts)
            timestamps[r].append(ts)

    all_accounts = graph.nodes
    profiles: List[Dict[str, Any]] = []

    for acc in all_accounts:
        s_amounts = sent.get(acc, [])
        r_amounts = received.get(acc, [])
        times     = sorted(timestamps.get(acc, []))

        total_sent     = round(sum(s_amounts), 2)
        total_received = round(sum(r_amounts), 2)
        net_flow       = round(total_received - total_sent, 2)
        tx_count       = len(s_amounts) + len(r_amounts)

        avg_sent     = round(total_sent     / max(len(s_amounts), 1), 2)
        avg_received = round(total_received / max(len(r_amounts), 1), 2)

        unique_receivers = len(sent_to.get(acc, set()))
        unique_senders   = len(recv_from.get(acc, set()))

        # Activity time span
        if len(times) >= 2:
            span_hours = round((times[-1] - times[0]).total_seconds() / 3600, 2)
            first_seen = times[0].isoformat()
            last_seen  = times[-1].isoformat()
        else:
            span_hours = 0.0
            first_seen = times[0].isoformat() if times else None
            last_seen  = times[0].isoformat() if times else None

        # Ratio: what fraction of money passes through vs stays
        pass_through_ratio = (
            round(min(total_sent, total_received) / max(total_sent, total_received, 1), 3)
        )

        # Simple heuristic risk signal (used by hybrid engine)
        risk_signal = 0.0
        if total_sent > 0 and total_received > 0:
            risk_signal += pass_through_ratio * 30  # high pass-through = suspicious
        if unique_receivers > 10:
            risk_signal += min(20, unique_receivers)  # fan-out behaviour
        if unique_senders > 10:
            risk_signal += min(20, unique_senders)    # fan-in behaviour
        risk_signal = round(min(risk_signal, 100), 2)

        profiles.append({
            "account_id":        acc,
            "total_sent":        total_sent,
            "total_received":    total_received,
            "net_flow":          net_flow,
            "tx_count":          tx_count,
            "outgoing_count":    len(s_amounts),
            "incoming_count":    len(r_amounts),
            "avg_sent":          avg_sent,
            "avg_received":      avg_received,
            "unique_receivers":  unique_receivers,
            "unique_senders":    unique_senders,
            "pass_through_ratio": pass_through_ratio,
            "activity_span_hours": span_hours,
            "first_seen":        first_seen,
            "last_seen":         last_seen,
            "risk_signal":       risk_signal,
        })

    profiles.sort(key=lambda x: x["risk_signal"], reverse=True)

    summary = {
        "total_accounts": len(profiles),
        "avg_tx_count":   round(sum(p["tx_count"] for p in profiles) / max(len(profiles), 1), 1),
        "total_volume":   round(sum(p["total_sent"] for p in profiles), 2),
    }

    return {
        "profiles": profiles,
        "summary":  summary,
    }
