"""
value_encoder.py — Dynamic Value Field Encoder (DC-LCG paper Sec IV-A).

Discretizes transaction amounts into log-space "value fields" and enriches
each account with behavioural + value-distribution features. Produces the
raw feature matrix X consumed by both DC-LCG views.
"""
from __future__ import annotations

import math
from typing import Dict, List, Tuple

import numpy as np

# Number of log-space amount bins ("value fields").
NUM_VALUE_FIELDS = 8


def _amount_bin(amount: float) -> int:
    """Map an amount to one of NUM_VALUE_FIELDS log-space bins (0..N-1)."""
    if amount <= 0:
        return 0
    # log10 scale: 1 -> bin0, 10 -> ~bin1 ... 1e7+ -> last bin
    idx = int(math.log10(max(amount, 1.0)) / (7.0 / NUM_VALUE_FIELDS))
    return min(idx, NUM_VALUE_FIELDS - 1)


def build_value_features(graph) -> Tuple[List[str], np.ndarray]:
    """
    Build per-account feature vectors from a TransactionGraph.

    Feature layout (D = 6 + NUM_VALUE_FIELDS*2):
        0 log1p(total_sent)
        1 log1p(total_received)
        2 out_degree
        3 in_degree
        4 sent/received ratio (clipped)
        5 amount std (log1p)
        6..6+N-1   sent value-field histogram (normalized)
        6+N..end   received value-field histogram (normalized)

    Returns:
        (accounts, X) where accounts[i] corresponds to row X[i].
    """
    accounts: List[str] = sorted(graph.nodes)
    index: Dict[str, int] = {a: i for i, a in enumerate(accounts)}
    n = len(accounts)
    d = 6 + NUM_VALUE_FIELDS * 2
    X = np.zeros((n, d), dtype=np.float32)

    sent_total = np.zeros(n, dtype=np.float64)
    recv_total = np.zeros(n, dtype=np.float64)
    amounts_seen: List[List[float]] = [[] for _ in range(n)]

    for tx in graph.transactions:
        s = index.get(tx["sender"])
        r = index.get(tx["receiver"])
        amt = float(tx["amount"])
        b = _amount_bin(amt)
        if s is not None:
            sent_total[s] += amt
            X[s, 2] += 1
            X[s, 6 + b] += 1.0
            amounts_seen[s].append(amt)
        if r is not None:
            recv_total[r] += amt
            X[r, 3] += 1
            X[r, 6 + NUM_VALUE_FIELDS + b] += 1.0
            amounts_seen[r].append(amt)

    for i in range(n):
        X[i, 0] = math.log1p(sent_total[i])
        X[i, 1] = math.log1p(recv_total[i])
        denom = max(recv_total[i], 1.0)
        X[i, 4] = min(sent_total[i] / denom, 50.0)
        amts = amounts_seen[i]
        if len(amts) > 1:
            X[i, 5] = math.log1p(float(np.std(amts)))

    # Normalize histograms to distributions
    for block_start in (6, 6 + NUM_VALUE_FIELDS):
        rows = X[:, block_start:block_start + NUM_VALUE_FIELDS]
        sums = rows.sum(axis=1, keepdims=True)
        sums[sums == 0] = 1.0
        X[:, block_start:block_start + NUM_VALUE_FIELDS] = rows / sums

    # Guard against NaN/Inf
    X = np.nan_to_num(X, nan=0.0, posinf=50.0, neginf=0.0)
    return accounts, X
