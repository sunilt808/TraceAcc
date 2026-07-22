"""
velocity.py — Transaction velocity analysis.

Measures how many transactions an account sends/receives per unit
time (minute, hour, day, week). Unusually high velocity is a
strong indicator of automated money mule behaviour.
"""
from typing import Dict, Any, List
from datetime import timedelta
from collections import defaultdict
from utils.graph import TransactionGraph

# ── Alert thresholds ──────────────────────────────────────────
THRESHOLDS = {
    "per_minute": 3,
    "per_hour":   20,
    "per_day":    60,
    "per_week":   200,
}


def compute_velocity(graph: TransactionGraph) -> Dict[str, Any]:
    """
    Compute per-account transaction velocity.

    Returns:
        velocity_profiles: per-account velocity stats
        high_velocity_accounts: accounts exceeding any threshold
        summary: counts
    """
    # Build outgoing tx per account
    account_out_times: Dict[str, List] = defaultdict(list)
    for tx in graph.transactions:
        ts = tx["timestamp"]
        if ts is None:
            continue
        account_out_times[tx["sender"]].append(ts)

    velocity_profiles: List[Dict[str, Any]] = []
    high_velocity: List[Dict[str, Any]] = []

    for account, times in account_out_times.items():
        if not times:
            continue

        sorted_times = sorted(times)
        total = len(sorted_times)

        if total < 2:
            continue

        start = sorted_times[0]
        end   = sorted_times[-1]
        span  = max((end - start).total_seconds(), 1)  # avoid /0

        span_minutes = span / 60
        span_hours   = span / 3600
        span_days    = span / 86400
        span_weeks   = span / 604800

        per_minute = total / max(span_minutes, 1)
        per_hour   = total / max(span_hours,   1)
        per_day    = total / max(span_days,    1)
        per_week   = total / max(span_weeks,   1)

        # Peak velocity: find the 1-hour rolling window with most tx
        peak_hour_count = 0
        window = timedelta(hours=1)
        for i, t in enumerate(sorted_times):
            count = sum(1 for t2 in sorted_times[i:] if (t2 - t) <= window)
            peak_hour_count = max(peak_hour_count, count)

        flags = []
        if per_minute >= THRESHOLDS["per_minute"]: flags.append("high_per_minute")
        if per_hour   >= THRESHOLDS["per_hour"]:   flags.append("high_per_hour")
        if per_day    >= THRESHOLDS["per_day"]:     flags.append("high_per_day")
        if per_week   >= THRESHOLDS["per_week"]:    flags.append("high_per_week")

        profile = {
            "account_id":       account,
            "total_outgoing":   total,
            "per_minute":       round(per_minute, 3),
            "per_hour":         round(per_hour,   3),
            "per_day":          round(per_day,    3),
            "per_week":         round(per_week,   3),
            "peak_hour_count":  peak_hour_count,
            "flags":            flags,
        }

        velocity_profiles.append(profile)

        if flags:
            high_velocity.append(profile)

    velocity_profiles.sort(key=lambda x: x["per_hour"], reverse=True)
    high_velocity.sort(key=lambda x: len(x["flags"]), reverse=True)

    return {
        "velocity_profiles":      velocity_profiles,
        "high_velocity_accounts": high_velocity,
        "summary": {
            "total_accounts_analyzed": len(velocity_profiles),
            "high_velocity_count":     len(high_velocity),
            "thresholds_used":         THRESHOLDS,
        },
    }
