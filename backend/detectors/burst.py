from datetime import timedelta
from bisect import bisect_left, bisect_right
from utils.graph import TransactionGraph

def detect_burst_activity(graph: TransactionGraph,
                          dormant_days: int = 14,       # 14 days
                          burst_threshold: int = 4,     # 4+ transactions in short window
                          burst_window_hours: int = 72) -> dict:
    """
    Detect accounts that were dormant (≤3 transactions in dormant_days)
    and then had a burst of ≥burst_threshold transactions within burst_window_hours.
    Returns dict: account_id -> {"burst": True, ...}

    Optimized: O(T log T) per account via bisect instead of O(T²) inner scan.
    """
    burst_accounts = {}

    for account in graph.nodes:
        # Collect all timestamps for transactions involving this account
        tx_times = [tx[2] for tx in graph.get_outgoing(account)] + \
                   [tx[2] for tx in graph.get_incoming(account)]

        if len(tx_times) < burst_threshold:
            continue

        tx_times.sort()

        # O(T log T): For each candidate window start, use bisect for O(log T) range queries
        for i in range(len(tx_times) - burst_threshold + 1):
            window_start = tx_times[i]
            window_end = window_start + timedelta(hours=burst_window_hours)

            # bisect_right gives count of elements <= window_end in O(log T)
            right_idx = bisect_right(tx_times, window_end)
            count = right_idx - i  # elements in [window_start, window_end]

            if count >= burst_threshold:
                # Check dormancy: how many transactions before the burst window?
                dormant_start = window_start - timedelta(days=dormant_days)
                left_dormant = bisect_left(tx_times, dormant_start)
                right_dormant = i  # index of window_start
                prev_txs = right_dormant - left_dormant

                if prev_txs <= 3:
                    burst_accounts[account] = {
                        "burst": True,
                        "burst_window_start": str(window_start),
                        "burst_count": count,
                        "prev_activity": prev_txs
                    }
                    break  # found a burst, no need to check further windows

    return burst_accounts