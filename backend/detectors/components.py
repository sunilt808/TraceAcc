"""
components.py — Strongly & Weakly Connected Components.

SCC reveals tightly coupled fraud rings where funds recirculate.
WCC reveals the full extent of accounts touched by a scheme.
"""
from typing import Dict, Any, List
import networkx as nx
from utils.graph import TransactionGraph


def detect_components(graph: TransactionGraph) -> Dict[str, Any]:
    """
    Find Strongly and Weakly Connected Components.

    Returns:
        scc: list of strongly connected components (size > 1)
        wcc: list of weakly connected components (size > 1)
        summary: component counts and sizes
    """
    G = graph.to_networkx(multi=False)

    if not G.nodes:
        return {"scc": [], "wcc": [], "summary": {}}

    # ── Strongly Connected Components ──────────────────────────
    scc_raw = list(nx.strongly_connected_components(G))
    scc = [
        {
            "component_id": f"SCC_{i:04d}",
            "members": sorted(comp),
            "size": len(comp),
        }
        for i, comp in enumerate(sorted(scc_raw, key=len, reverse=True))
        if len(comp) > 1
    ]

    # ── Weakly Connected Components ────────────────────────────
    wcc_raw = list(nx.weakly_connected_components(G))
    wcc = [
        {
            "component_id": f"WCC_{i:04d}",
            "members": sorted(comp),
            "size": len(comp),
        }
        for i, comp in enumerate(sorted(wcc_raw, key=len, reverse=True))
        if len(comp) > 1
    ]

    # ── Account → Component mapping ────────────────────────────
    account_scc: Dict[str, str] = {}
    for item in scc:
        for node in item["members"]:
            account_scc[node] = item["component_id"]

    account_wcc: Dict[str, str] = {}
    for item in wcc:
        for node in item["members"]:
            account_wcc[node] = item["component_id"]

    summary = {
        "total_nodes": len(G.nodes),
        "total_scc": len(scc),
        "total_wcc": len(wcc),
        "largest_scc_size": scc[0]["size"] if scc else 0,
        "largest_wcc_size": wcc[0]["size"] if wcc else 0,
    }

    return {
        "scc": scc,
        "wcc": wcc,
        "account_scc_map": account_scc,
        "account_wcc_map": account_wcc,
        "summary": summary,
    }
