"""
temporal.py — Temporal pattern detection.

Detects suspicious time-of-day / day-of-week patterns:
  - Night transactions (23:00 – 05:00)
  - Weekend activity spikes
  - Periodic/regular transfer intervals
  - Rapid money movement (all transactions within a short window)
"""
from typing import Dict, Any, List
from datetime import datetime, timedelta
from collections import defaultdict
from utils.graph import TransactionGraph

# ── Thresholds ─────────────────────────────────────────────────
NIGHT_START_HOUR = 23
NIGHT_END_HOUR   = 5   # exclusive
RAPID_WINDOW_HOURS = 2
RAPID_MIN_TX       = 5
PERIODIC_TOLERANCE_MINUTES = 15  # gap ± tolerance = periodic


def _is_night(dt: datetime) -> bool:
    h = dt.hour
    return h >= NIGHT_START_HOUR or h < NIGHT_END_HOUR


def _is_weekend(dt: datetime) -> bool:
    return dt.weekday() >= 5  # Saturday = 5, Sunday = 6


def detect_temporal_patterns(graph: TransactionGraph) -> Dict[str, Any]:
    """
    Analyse transaction timestamps to find suspicious temporal behaviour.

    Returns:
        night_actors:    accounts with > 50% night transactions
        weekend_actors:  accounts with > 60% weekend transactions
        rapid_movers:    accounts that make >= RAPID_MIN_TX in RAPID_WINDOW_HOURS
        periodic_actors: accounts whose outgoing intervals are suspiciously regular
        summary:         aggregated counts
    """
    # ── Per-account time buckets ────────────────────────────────
    account_tx_times: Dict[str, List[datetime]] = defaultdict(list)

    for tx in graph.transactions:
        ts = tx["timestamp"]
        if ts is None:
            continue
        account_tx_times[tx["sender"]].append(ts)
        account_tx_times[tx["receiver"]].append(ts)

    night_actors:    List[Dict] = []
    weekend_actors:  List[Dict] = []
    rapid_movers:    List[Dict] = []
    periodic_actors: List[Dict] = []

    for account, times in account_tx_times.items():
        if not times:
            continue

        sorted_times = sorted(times)
        total = len(sorted_times)

        # ── Night activity ──────────────────────────────────────
        night_count = sum(1 for t in sorted_times if _is_night(t))
        night_ratio = night_count / total
        if night_ratio > 0.50:
            night_actors.append({
                "account_id": account,
                "night_tx_count": night_count,
                "total_tx": total,
                "night_ratio": round(night_ratio, 3),
            })

        # ── Weekend activity ────────────────────────────────────
        weekend_count = sum(1 for t in sorted_times if _is_weekend(t))
        weekend_ratio = weekend_count / total
        if weekend_ratio > 0.60:
            weekend_actors.append({
                "account_id": account,
                "weekend_tx_count": weekend_count,
                "total_tx": total,
                "weekend_ratio": round(weekend_ratio, 3),
            })

        # ── Rapid movement ──────────────────────────────────────
        window = timedelta(hours=RAPID_WINDOW_HOURS)
        for i, start in enumerate(sorted_times):
            burst_count = sum(
                1 for t in sorted_times[i:]
                if (t - start) <= window
            )
            if burst_count >= RAPID_MIN_TX:
                rapid_movers.append({
                    "account_id": account,
                    "rapid_tx_count": burst_count,
                    "window_hours": RAPID_WINDOW_HOURS,
                    "first_tx": start.isoformat(),
                })
                break  # one report per account

        # ── Periodic behaviour ──────────────────────────────────
        if total >= 4:
            gaps = [
                (sorted_times[i + 1] - sorted_times[i]).total_seconds() / 60
                for i in range(len(sorted_times) - 1)
            ]
            avg_gap = sum(gaps) / len(gaps)
            if avg_gap > 0:
                deviations = [abs(g - avg_gap) for g in gaps]
                avg_dev = sum(deviations) / len(deviations)
                if avg_dev <= PERIODIC_TOLERANCE_MINUTES:
                    periodic_actors.append({
                        "account_id": account,
                        "avg_interval_minutes": round(avg_gap, 1),
                        "avg_deviation_minutes": round(avg_dev, 1),
                        "tx_count": total,
                    })

    summary = {
        "night_actor_count":    len(night_actors),
        "weekend_actor_count":  len(weekend_actors),
        "rapid_mover_count":    len(rapid_movers),
        "periodic_actor_count": len(periodic_actors),
    }

    return {
        "night_actors":    sorted(night_actors,    key=lambda x: x["night_ratio"],    reverse=True),
        "weekend_actors":  sorted(weekend_actors,  key=lambda x: x["weekend_ratio"],  reverse=True),
        "rapid_movers":    rapid_movers,
        "periodic_actors": sorted(periodic_actors, key=lambda x: x["avg_deviation_minutes"]),
        "summary":         summary,
    }
