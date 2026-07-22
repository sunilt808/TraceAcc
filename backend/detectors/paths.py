"""
paths.py — Suspicious path detection and multi-hop tracing.

Finds shortest paths between high-risk accounts to reveal
the routing chain used in layering schemes.
"""
from typing import Dict, Any, List, Optional
import networkx as nx
from utils.graph import TransactionGraph


def trace_suspicious_paths(
    graph: TransactionGraph,
    suspicious_accounts: List[str],
    max_pairs: int = 50,
    max_hops: int = 6,
) -> Dict[str, Any]:
    """
    Trace shortest paths between flagged accounts.

    Args:
        graph:               TransactionGraph instance
        suspicious_accounts: list of pre-flagged account IDs
        max_pairs:           max account pairs to trace (performance guard)
        max_hops:            ignore paths longer than this

    Returns:
        paths: list of path dicts with route and hop count
        summary: statistics
    """
    G = graph.to_networkx(multi=False)

    if not G.nodes or len(suspicious_accounts) < 2:
        return {"paths": [], "summary": {"total_paths_found": 0}}

    paths: List[Dict[str, Any]] = []
    suspects = [a for a in suspicious_accounts if a in G.nodes]
    pairs_checked = 0

    for i, source in enumerate(suspects):
        for target in suspects[i + 1:]:
            if pairs_checked >= max_pairs:
                break
            pairs_checked += 1
            try:
                path = nx.shortest_path(G, source=source, target=target)
                if len(path) - 1 <= max_hops:
                    paths.append({
                        "source": source,
                        "target": target,
                        "path": path,
                        "hops": len(path) - 1,
                    })
            except nx.NetworkXNoPath:
                pass
            except nx.NodeNotFound:
                pass

    paths.sort(key=lambda x: x["hops"])

    return {
        "paths": paths,
        "summary": {
            "total_paths_found": len(paths),
            "pairs_checked": pairs_checked,
            "shortest_path_hops": paths[0]["hops"] if paths else None,
        },
    }


def find_all_simple_paths(
    graph: TransactionGraph,
    source: str,
    target: str,
    max_hops: int = 5,
) -> List[List[str]]:
    """Find all simple paths between two accounts (for detailed investigation)."""
    G = graph.to_networkx(multi=False)

    if source not in G or target not in G:
        return []

    try:
        return list(nx.all_simple_paths(G, source=source, target=target, cutoff=max_hops))
    except Exception:
        return []
