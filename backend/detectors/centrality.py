"""
centrality.py — Graph centrality measures for AML detection.

Computes Degree, Betweenness, Closeness, Eigenvector, and PageRank
centrality to identify structurally critical accounts in the transaction graph.
"""
from typing import Dict, Any
import networkx as nx
from utils.graph import TransactionGraph


def compute_centrality(graph: TransactionGraph) -> Dict[str, Any]:
    """
    Compute multiple centrality metrics for every account.

    Returns a dict keyed by account_id with centrality scores.
    """
    G = graph.to_networkx(multi=False)
    G_undirected = G.to_undirected()

    results: Dict[str, Dict[str, float]] = {}

    if not G.nodes:
        return results

    # ── Degree Centrality ──────────────────────────────────────
    in_degree  = nx.in_degree_centrality(G)
    out_degree = nx.out_degree_centrality(G)

    # ── Betweenness Centrality ─────────────────────────────────
    try:
        betweenness = nx.betweenness_centrality(G, normalized=True, weight="amount")
    except Exception:
        betweenness = {n: 0.0 for n in G.nodes}

    # ── Closeness Centrality ───────────────────────────────────
    try:
        closeness = nx.closeness_centrality(G_undirected)
    except Exception:
        closeness = {n: 0.0 for n in G.nodes}

    # ── Eigenvector Centrality ─────────────────────────────────
    try:
        eigenvector = nx.eigenvector_centrality(G_undirected, max_iter=500, tol=1e-4)
    except Exception:
        eigenvector = {n: 0.0 for n in G.nodes}

    # ── PageRank ───────────────────────────────────────────────
    try:
        pagerank = nx.pagerank(G, alpha=0.85, weight="amount", max_iter=500)
    except Exception:
        pagerank = {n: 0.0 for n in G.nodes}

    # ── Assemble per-node results ──────────────────────────────
    for node in G.nodes:
        results[node] = {
            "in_degree_centrality":  round(in_degree.get(node, 0.0), 6),
            "out_degree_centrality": round(out_degree.get(node, 0.0), 6),
            "betweenness_centrality": round(betweenness.get(node, 0.0), 6),
            "closeness_centrality":  round(closeness.get(node, 0.0), 6),
            "eigenvector_centrality": round(eigenvector.get(node, 0.0), 6),
            "pagerank":              round(pagerank.get(node, 0.0), 6),
        }

    return results


def get_top_central_nodes(graph: TransactionGraph, metric: str = "pagerank", top_n: int = 20) -> list:
    """Return top-N accounts ranked by a given centrality metric."""
    centrality = compute_centrality(graph)
    ranked = sorted(centrality.items(), key=lambda x: x[1].get(metric, 0), reverse=True)
    return [{"account_id": k, **v} for k, v in ranked[:top_n]]
