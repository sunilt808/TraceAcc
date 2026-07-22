def find_cycles(graph, max_length: int = 3, max_cycles: int = 100):
    import time
    start_time = time.time()

    rings = {}
    ring_counter = 0

    # 🔥 Only nodes that can actually form cycles
    candidate_nodes = [
        node for node in graph.nodes
        if len(graph.get_outgoing(node)) > 0
        and len(graph.get_incoming(node)) > 0
    ]

    def dfs(current, start, path, visited):
        nonlocal ring_counter

        # Stop if max cycles reached
        if ring_counter >= max_cycles:
            return

        # Stop if max depth reached
        if len(path) > max_length:
            return

        for (neighbor, _, _) in graph.get_outgoing(current):

            # 🔥 Prune backward exploration (avoid duplicate cycles)
            if neighbor < start:
                continue

            # Found cycle
            if neighbor == start and len(path) >= 3:
                ring_id = f"RING_{ring_counter:03d}"
                rings[ring_id] = path + [start]
                ring_counter += 1
                continue

            # Continue DFS safely
            if neighbor not in visited:
                dfs(
                    neighbor,
                    start,
                    path + [neighbor],
                    visited | {neighbor}
                )

    # Run DFS only on candidate nodes
    for node in sorted(candidate_nodes):
        dfs(node, node, [node], {node})
        if ring_counter >= max_cycles:
            break

    print("Cycle detection time:", time.time() - start_time)
    print("Cycles found:", len(rings))

    return rings