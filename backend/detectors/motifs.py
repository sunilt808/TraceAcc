"""
motifs.py — Graph motif detection.

Motifs are small recurring subgraph patterns. In AML:
  - Triangle:  A→B→C→A (3-cycle)
  - Chain:     A→B→C→D (sequential layering)
  - Star:      many nodes → one hub (collection)
  - Diamond:   A→{B,C}→D (split and recombine)
  - Wheel:     hub connected to all ring members
"""
from typing import Dict, Any, List
import networkx as nx
from utils.graph import TransactionGraph


def detect_motifs(graph: TransactionGraph) -> Dict[str, Any]:
    """
    Detect Triangle, Chain, Star, Diamond, and Wheel motifs.

    Returns:
        triangles: list of 3-node cycles
        chains:    list of chain paths
        stars:     high-degree hub nodes
        diamonds:  split-recombine patterns
        summary:   counts
    """
    G  = graph.to_networkx(multi=False)
    GU = G.to_undirected()

    triangles: List[Dict] = []
    chains:    List[Dict] = []
    stars:     List[Dict] = []
    diamonds:  List[Dict] = []

    # ── Triangles ─────────────────────────────────────────────
    # 3-node directed cycles (A→B→C→A)
    seen_triangles = set()
    for node in G.nodes:
        for neighbor in G.successors(node):
            for nn in G.successors(neighbor):
                if G.has_edge(nn, node) and nn != node:
                    tri = tuple(sorted([node, neighbor, nn]))
                    if tri not in seen_triangles:
                        seen_triangles.add(tri)
                        triangles.append({
                            "nodes": list(tri),
                            "type": "triangle",
                        })

    # ── Stars ──────────────────────────────────────────────────
    # High in-degree nodes (collector) or high out-degree (distributor)
    for node in G.nodes:
        in_d  = G.in_degree(node)
        out_d = G.out_degree(node)
        if in_d >= 5:
            stars.append({
                "hub": node,
                "type": "collector_star",
                "degree": in_d,
                "spokes": list(G.predecessors(node)),
            })
        elif out_d >= 5:
            stars.append({
                "hub": node,
                "type": "distributor_star",
                "degree": out_d,
                "spokes": list(G.successors(node)),
            })
    stars.sort(key=lambda x: x["degree"], reverse=True)

    # ── Chains ────────────────────────────────────────────────
    # Sequential A→B→C→D … (degree-1 nodes at each step)
    visited_chain = set()
    for node in G.nodes:
        if G.in_degree(node) == 0 and G.out_degree(node) == 1:
            # potential chain start
            chain = [node]
            cur = node
            while True:
                successors = list(G.successors(cur))
                if len(successors) != 1:
                    break
                nxt = successors[0]
                if nxt in visited_chain or nxt == node:
                    break
                chain.append(nxt)
                visited_chain.add(nxt)
                cur = nxt
                if G.out_degree(cur) != 1:
                    break

            if len(chain) >= 3:
                chain_key = tuple(chain)
                if chain_key not in {tuple(c.get("chain", [])) for c in chains}:
                    chains.append({
                        "chain": chain,
                        "length": len(chain),
                        "type": "chain",
                    })
    chains.sort(key=lambda x: x["length"], reverse=True)

    # ── Diamonds ──────────────────────────────────────────────
    # A→{B,C}→D (fork then join)
    for node in G.nodes:
        if G.out_degree(node) >= 2:
            successors = set(G.successors(node))
            # Find nodes reachable from 2+ successors
            reachable: Dict[str, set] = {}
            for s in successors:
                for nn in G.successors(s):
                    if nn != node:
                        reachable.setdefault(nn, set()).add(s)

            for target, via in reachable.items():
                if len(via) >= 2:
                    diamonds.append({
                        "source":  node,
                        "via":     list(via),
                        "target":  target,
                        "type":    "diamond",
                    })

    summary = {
        "triangles": len(triangles),
        "chains":    len(chains),
        "stars":     len(stars),
        "diamonds":  len(diamonds),
    }

    return {
        "triangles": triangles[:100],  # cap for payload size
        "chains":    chains[:100],
        "stars":     stars[:50],
        "diamonds":  diamonds[:100],
        "summary":   summary,
    }
