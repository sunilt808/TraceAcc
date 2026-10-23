from datetime import datetime, timezone
import time

def _parse_ts_utc(ts):
    """Safely convert any timestamp format to a timezone-aware UTC datetime."""
    if ts is None:
        return None
    if isinstance(ts, (int, float)):
        try:
            return datetime.fromtimestamp(ts, tz=timezone.utc)
        except Exception:
            return None
    if isinstance(ts, datetime):
        return ts if ts.tzinfo else ts.replace(tzinfo=timezone.utc)
    if hasattr(ts, 'to_pydatetime'):
        dt = ts.to_pydatetime()
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    
    s = str(ts).strip()
    if not s or s.lower() == 'nan':
        return None
    
    # Try ISO-8601 first (handles '2026-09-26T08:00:00Z', '2026-09-26T08:00:00.123+00:00', etc.)
    try:
        dt = datetime.fromisoformat(s.replace('Z', '+00:00'))
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except Exception:
        pass

    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d", "%m/%d/%Y %H:%M:%S", "%d-%m-%Y %H:%M:%S"):
        try:
            return datetime.strptime(s, fmt).replace(tzinfo=timezone.utc)
        except Exception:
            pass

    return None


def detect_fan_patterns(graph, threshold: int = 3, time_window_hours: int = 72, max_rings: int = 200):
    """
    Optimized fan-in / fan-out detection with:
    - Robust ISO-8601 & heterogeneous timestamp parsing
    - Sliding window time check (O(n log n))
    - Accurate aggregation & dispersion money-mule detection
    """
    start_time = time.time()
    rings = {}
    ring_counter = 0
    window_seconds = max(1, time_window_hours * 3600)

    def transactions_in_window(tx_list):
        if len(tx_list) < threshold:
            return False

        timestamps = []
        for _, _, ts in tx_list:
            dt = _parse_ts_utc(ts)
            if dt:
                timestamps.append(dt)

        # If no valid timestamps exist in the dataset, fall back to sequential transaction count
        if not timestamps:
            return len(tx_list) >= threshold

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

    # 1. FAN-IN (Many senders -> One aggregator / mule node)
    for node in graph.nodes:
        if ring_counter >= max_rings:
            break

        incoming = graph.get_incoming(node)
        unique_senders = list(set([s for s, _, _ in incoming if s != node]))

        if len(unique_senders) >= threshold:
            if transactions_in_window(incoming):
                ring_id = f"RING_{ring_counter:03d}"
                rings[ring_id] = unique_senders + [node]
                ring_counter += 1

    # 2. FAN-OUT (One source -> Many disbursement / mule recipients)
    for node in graph.nodes:
        if ring_counter >= max_rings:
            break

        outgoing = graph.get_outgoing(node)
        unique_receivers = list(set([r for r, _, _ in outgoing if r != node]))

        if len(unique_receivers) >= threshold:
            if transactions_in_window(outgoing):
                ring_id = f"RING_{ring_counter:03d}"
                rings[ring_id] = [node] + unique_receivers
                ring_counter += 1

    print("Fan detection time:", time.time() - start_time)
    print("Fan rings found:", len(rings))

    return rings

