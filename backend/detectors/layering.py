def find_layered_shells(graph, min_chain_length: int = 3, max_degree: int = 3, max_rings: int = 200):
    """
    Optimized layered shell detection:
    - Detect chains >= min_chain_length
    - Intermediate nodes have low total degree
    - Protected against explosion
    """

    import time
    start_time = time.time()

    rings = {}
    ring_counter = 0

    MAX_DEPTH = 5  # Keep small for performance

    # 🔥 Candidate start nodes:
    # low incoming degree and at least one outgoing edge
    candidate_nodes = [
        node for node in graph.nodes
        if len(graph.get_outgoing(node)) > 0
        and len(graph.get_incoming(node)) <= max_degree
    ]

    def dfs(current, path, visited):

        nonlocal ring_counter

        if ring_counter >= max_rings:
            return

        if len(path) > MAX_DEPTH:
            return

        outgoing = graph.get_outgoing(current)

        for (neighbor, _, _) in outgoing:

            if neighbor in visited:
                continue

            in_deg = len(graph.get_incoming(neighbor))
            out_deg = len(graph.get_outgoing(neighbor))
            total_deg = in_deg + out_deg

            # 🔥 Continue chain if shell node
            if total_deg <= max_degree:
                dfs(
                    neighbor,
                    path + [neighbor],
                    visited | {neighbor}
                )

            # 🔥 End chain when reaching higher-degree node
            elif len(path) >= min_chain_length:
                ring_id = f"RING_{ring_counter:03d}"
                rings[ring_id] = path + [neighbor]
                ring_counter += 1

    # Run DFS safely
    for node in candidate_nodes:

        if ring_counter >= max_rings:
            break

        dfs(node, [node], {node})

    print("Layered shell detection time:", time.time() - start_time)
    print("Shell rings found:", len(rings))

    return rings
