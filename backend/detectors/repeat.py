"""
repeat.py — Repeated sender-receiver pair detection.

Accounts that repeatedly transact with the same counterparty
may indicate controlled/coordinated money movement.
"""
from typing import Dict, Any, List
from collections import defaultdict
from utils.graph import TransactionGraph

MIN_REPEAT_COUNT = 3  # pair must appear at least this many times


def detect_repeat_pairs(
    graph: TransactionGraph,
    min_count: int = MIN_REPEAT_COUNT,
) -> Dict[str, Any]:
    """
    Identify repeatedly-used sender → receiver pairs.

    Args:
        graph:     TransactionGraph instance
        min_count: minimum transactions for a pair to be flagged

    Returns:
        repeat_pairs:       list of flagged pairs with stats
        repeat_senders:     accounts who repeatedly use the same receiver
        repeat_receivers:   accounts who repeatedly receive from the same sender
        summary:            counts
    """
    pair_counts:   Dict[tuple, int]   = defaultdict(int)
    pair_amounts:  Dict[tuple, float] = defaultdict(float)

    for tx in graph.transactions:
        pair = (tx["sender"], tx["receiver"])
        pair_counts[pair]  += 1
        pair_amounts[pair] += tx.get("amount", 0)

    repeat_pairs: List[Dict[str, Any]] = []
    repeat_sender_set:   Dict[str, int] = defaultdict(int)
    repeat_receiver_set: Dict[str, int] = defaultdict(int)

    for (sender, receiver), count in pair_counts.items():
        if count >= min_count:
            repeat_pairs.append({
                "sender":        sender,
                "receiver":      receiver,
                "tx_count":      count,
                "total_amount":  round(pair_amounts[(sender, receiver)], 2),
                "avg_amount":    round(pair_amounts[(sender, receiver)] / count, 2),
            })
            repeat_sender_set[sender]     += 1
            repeat_receiver_set[receiver] += 1

    repeat_pairs.sort(key=lambda x: x["tx_count"], reverse=True)

    repeat_senders = [
        {"account_id": acc, "unique_repeat_receivers": cnt}
        for acc, cnt in sorted(repeat_sender_set.items(), key=lambda x: x[1], reverse=True)
    ]
    repeat_receivers = [
        {"account_id": acc, "unique_repeat_senders": cnt}
        for acc, cnt in sorted(repeat_receiver_set.items(), key=lambda x: x[1], reverse=True)
    ]

    summary = {
        "total_repeat_pairs": len(repeat_pairs),
        "unique_repeat_senders": len(repeat_senders),
        "unique_repeat_receivers": len(repeat_receivers),
        "min_repeat_threshold": min_count,
    }

    return {
        "repeat_pairs":     repeat_pairs,
        "repeat_senders":   repeat_senders,
        "repeat_receivers": repeat_receivers,
        "summary":          summary,
    }
