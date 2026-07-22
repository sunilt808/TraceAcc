from datetime import datetime, timedelta

def detect_fan_patterns(graph, threshold: int = 10, time_window_hours: int = 72, max_rings: int = 200):
    """
    Optimized fan-in / fan-out detection with:
    - Safe timestamp parsing
    - Sliding window time check (O(n))
    - Unique sender/receiver validation
    - Merchant false-positive control
    - Ring limit protection
    """

    import time
    start_time = time.time()

    rings = {}
    ring_counter = 0
    window_seconds = time_window_hours * 3600

    # ✅ Safe sliding window function
    def transactions_in_window(tx_list):

        if len(tx_list) < threshold:
            return False

        # Convert timestamps safely
        timestamps = []
        for _, _, ts in tx_list:
            if isinstance(ts, datetime):
                timestamps.append(ts)
            elif hasattr(ts, 'to_pydatetime'):
                # Pandas Timestamp
                timestamps.append(ts.to_pydatetime())
            else:
                try:
                    timestamps.append(datetime.strptime(str(ts), "%Y-%m-%d %H:%M:%S"))
                except (ValueError, TypeError):
                    continue  # skip unparseable timestamps

        timestamps.sort()

        left = 0
        for right in range(len(timestamps)):

            while (
                left < right and
                (timestamps[right] - timestamps[left]).total_seconds() > window_seconds
            ):
                left += 1

            if (right - left + 1) >= threshold:
                return True

        return False

    # 🔥 FAN-IN (many → one)
    for node in graph.nodes:

        if ring_counter >= max_rings:
            break

        incoming = graph.get_incoming(node)

        # Unique senders only
        unique_senders = list(set([s for s, _, _ in incoming]))

        # ⚠ False positive control (merchant trap)
        if (
            len(unique_senders) >= threshold and
            len(graph.get_outgoing(node)) < threshold
        ):

            if transactions_in_window(incoming):

                ring_id = f"RING_{ring_counter:03d}"
                rings[ring_id] = unique_senders + [node]
                ring_counter += 1

    # 🔥 FAN-OUT (one → many)
    for node in graph.nodes:

        if ring_counter >= max_rings:
            break

        outgoing = graph.get_outgoing(node)

        unique_receivers = list(set([r for r, _, _ in outgoing]))

        # ⚠ False positive control
        if (
            len(unique_receivers) >= threshold and
            len(graph.get_incoming(node)) < threshold
        ):

            if transactions_in_window(outgoing):

                ring_id = f"RING_{ring_counter:03d}"
                rings[ring_id] = [node] + unique_receivers
                ring_counter += 1

    print("Fan detection time:", time.time() - start_time)
    print("Fan rings found:", len(rings))

    return rings
