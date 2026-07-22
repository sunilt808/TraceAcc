"""
bridges.py — Bridge edge and articulation point detection.

Bridges are edges whose removal disconnects the graph.
Articulation points (cut vertices) are nodes whose removal increases
the number of connected components.
In AML, these represent critical relay accounts and single-point channels.
"""
from typing import Dict, Any, List
import networkx as nx
from utils.graph import TransactionGraph


def detect_bridges(graph: TransactionGraph) -> Dict[str, Any]:
    """
    Find bridge edges and articulation points in the transaction graph.

    Returns:
        bridges: list of (sender, receiver) edge pairs that are bridges
        articulation_points: list of critical relay accounts
        summary: counts
    """
    G_undirected = graph.to_networkx(multi=False).to_undirected()

    if not G_undirected.nodes:
        return {"bridges": [], "articulation_points": [], "summary": {}}

    # Remove self-loops
    G_undirected.remove_edges_from(nx.selfloop_edges(G_undirected))

    # ── Bridge Edges ───────────────────────────────────────────
    bridge_edges = list(nx.bridges(G_undirected))
    bridges: List[Dict[str, str]] = [
        {"source": u, "target": v}
        for u, v in bridge_edges
    ]

    # ── Articulation Points ────────────────────────────────────
    art_points = list(nx.articulation_points(G_undirected))

    # Score articulation points by degree (more connections = higher risk)
    art_with_degree = [
        {
            "account_id": node,
            "degree": G_undirected.degree(node),
        }
        for node in art_points
    ]
    art_with_degree.sort(key=lambda x: x["degree"], reverse=True)

    summary = {
        "total_bridge_edges": len(bridges),
        "total_articulation_points": len(art_with_degree),
        "total_nodes": len(G_undirected.nodes),
    }

    return {
        "bridges": bridges,
        "articulation_points": art_with_degree,
        "summary": summary,
    }
