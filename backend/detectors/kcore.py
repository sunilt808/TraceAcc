"""
kcore.py — K-Core decomposition for dense subgraph identification.

High-core accounts are deeply embedded in the transaction network,
a structural indicator of coordination in money muling schemes.
"""
from typing import Dict, Any, List
import networkx as nx
from utils.graph import TransactionGraph


def detect_kcore(graph: TransactionGraph, min_k: int = 2) -> Dict[str, Any]:
    """
    Decompose the graph into k-cores.

    Args:
        graph:  TransactionGraph instance
        min_k:  minimum core number to report (default 2)

    Returns:
        core_numbers: dict mapping account_id -> core number
        high_core_accounts: accounts in the densest cores
        summary: statistics about core distribution
    """
    G_undirected = graph.to_networkx(multi=False).to_undirected()

    if not G_undirected.nodes:
        return {"core_numbers": {}, "high_core_accounts": [], "summary": {}}

    # Remove self-loops which cause issues with k-core
    G_undirected.remove_edges_from(nx.selfloop_edges(G_undirected))

    core_numbers: Dict[str, int] = nx.core_number(G_undirected)

    max_k = max(core_numbers.values()) if core_numbers else 0

    # Accounts in the top core (densest subgraph)
    high_core_accounts: List[Dict[str, Any]] = [
        {"account_id": node, "core_number": k}
        for node, k in core_numbers.items()
        if k >= min_k
    ]
    high_core_accounts.sort(key=lambda x: x["core_number"], reverse=True)

    # Core distribution histogram
    from collections import Counter
    distribution = dict(Counter(core_numbers.values()))

    summary = {
        "max_k": max_k,
        "accounts_in_kcore": len(high_core_accounts),
        "core_distribution": {str(k): v for k, v in sorted(distribution.items())},
    }

    return {
        "core_numbers": {n: int(k) for n, k in core_numbers.items()},
        "high_core_accounts": high_core_accounts,
        "summary": summary,
    }
