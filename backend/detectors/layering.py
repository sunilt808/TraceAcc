import time

def find_layered_shells(graph, min_chain_length: int = 3, max_degree: int = 8, max_rings: int = 200):
    """
    Optimized layered shell / linear pass-through chain detection:
    - Detect multi-hop pass-through chains: Node_1 -> Node_2 -> Node_3 -> ...
    - Intermediate shell nodes act as transit conduits with limited branching
    - Deduplicates redundant sub-paths
    """
    start_time = time.time()
    rings = {}
    ring_counter = 0
    MAX_DEPTH = 6

    # Candidate start nodes: accounts that initiate funds with outgoing transfers
    candidate_nodes = [
        node for node in graph.nodes
        if len(graph.get_outgoing(node)) > 0
    ]

    seen_chains = set()

    def dfs(current, path, visited):
        nonlocal ring_counter

        if ring_counter >= max_rings or len(path) > MAX_DEPTH:
            return

        if len(path) >= min_chain_length:
            chain_key = "->".join(path)
            if chain_key not in seen_chains:
                seen_chains.add(chain_key)
                ring_id = f"RING_{ring_counter:03d}"
                rings[ring_id] = list(path)
                ring_counter += 1

        outgoing = graph.get_outgoing(current)
        for (neighbor, _, _) in outgoing:
            if neighbor in visited or neighbor == current:
                continue

            in_deg = len(graph.get_incoming(neighbor))
            out_deg = len(graph.get_outgoing(neighbor))
            total_deg = in_deg + out_deg

            # Intermediary conduit node
            if total_deg <= max_degree or out_deg > 0:
                dfs(
                    neighbor,
                    path + [neighbor],
                    visited | {neighbor}
                )

    for node in sorted(candidate_nodes):
        if ring_counter >= max_rings:
            break
        dfs(node, [node], {node})

    print("Layered shell detection time:", time.time() - start_time)
    print("Shell rings found:", len(rings))

    return rings
