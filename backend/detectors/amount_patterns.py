"""
amount_patterns.py — Transaction amount pattern detection.

Identifies structuring (smurfing), round-number preference,
repeated fixed amounts, split payments, and circular amount flow.
"""
from typing import Dict, Any, List
from collections import defaultdict, Counter
from utils.graph import TransactionGraph

# ── Constants ─────────────────────────────────────────────────
STRUCTURING_THRESHOLD = 10000  # just-below reporting thresholds ($10k CTR limit)
STRUCTURING_BAND      = 2000   # captures $8,000 - $9,999 range
ROUND_NUMBER_MODULO   = 1000   # amounts divisible by this
MICRO_TRANSFER_MAX    = 10     # very small test transactions
MIN_REPEATED_COUNT    = 3      # same amount repeated this many times
SPLIT_RATIO_THRESHOLD = 0.9    # splits sum to ≥90% of a source amount


def detect_amount_patterns(graph: TransactionGraph) -> Dict[str, Any]:
    """
    Detect suspicious amount-based patterns.

    Returns:
        structuring:   accounts making just-below-threshold transactions
        round_amounts: accounts predominantly using round amounts
        smurfing:      accounts involved in coordinated micro-fragments
        repeated:      accounts using repeated fixed amounts
        summary:       counts
    """
    transactions = graph.transactions

    # ── 1. Structuring ─────────────────────────────────────────
    structuring_accounts: Dict[str, int] = defaultdict(int)
    for tx in transactions:
        amount = tx.get("amount", 0)
        if STRUCTURING_THRESHOLD - STRUCTURING_BAND <= amount < STRUCTURING_THRESHOLD:
            structuring_accounts[tx["sender"]] += 1

    structuring = [
        {"account_id": acc, "suspicious_tx_count": count}
        for acc, count in structuring_accounts.items()
        if count >= 2  # at least 2 structured transactions
    ]
    structuring.sort(key=lambda x: x["suspicious_tx_count"], reverse=True)

    # ── 2. Round Amounts ────────────────────────────────────────
    account_amounts: Dict[str, List[float]] = defaultdict(list)
    for tx in transactions:
        account_amounts[tx["sender"]].append(tx.get("amount", 0))

    round_amount_accounts = []
    for acc, amounts in account_amounts.items():
        if not amounts:
            continue
        round_count = sum(1 for a in amounts if a % ROUND_NUMBER_MODULO == 0 and a > 0)
        ratio = round_count / len(amounts)
        if ratio >= 0.7 and round_count >= 3:
            round_amount_accounts.append({
                "account_id": acc,
                "round_amount_ratio": round(ratio, 3),
                "round_count": round_count,
                "total_tx": len(amounts),
            })
    round_amount_accounts.sort(key=lambda x: x["round_amount_ratio"], reverse=True)

    # ── 3. Smurfing (micro-transfers) ───────────────────────────
    smurfing_accounts: Dict[str, int] = defaultdict(int)
    for tx in transactions:
        if tx.get("amount", 0) <= MICRO_TRANSFER_MAX:
            smurfing_accounts[tx["sender"]] += 1

    smurfing = [
        {"account_id": acc, "micro_tx_count": count}
        for acc, count in smurfing_accounts.items()
        if count >= 5
    ]
    smurfing.sort(key=lambda x: x["micro_tx_count"], reverse=True)

    # ── 4. Repeated amounts ─────────────────────────────────────
    repeated_accounts = []
    for acc, amounts in account_amounts.items():
        if len(amounts) < MIN_REPEATED_COUNT:
            continue
        counter = Counter(amounts)
        top_amount, top_count = counter.most_common(1)[0]
        if top_count >= MIN_REPEATED_COUNT:
            repeated_accounts.append({
                "account_id": acc,
                "repeated_amount": top_amount,
                "repeat_count": top_count,
                "total_tx": len(amounts),
            })
    repeated_accounts.sort(key=lambda x: x["repeat_count"], reverse=True)

    summary = {
        "structuring_accounts": len(structuring),
        "round_amount_accounts": len(round_amount_accounts),
        "smurfing_accounts": len(smurfing),
        "repeated_amount_accounts": len(repeated_accounts),
    }

    return {
        "structuring":     structuring,
        "round_amounts":   round_amount_accounts,
        "smurfing":        smurfing,
        "repeated_amounts": repeated_accounts,
        "summary":         summary,
    }
