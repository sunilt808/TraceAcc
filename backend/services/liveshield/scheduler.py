"""
scheduler.py — Priority Queue Scheduler for sequence interleaving and monotonic clock rate regulation.

Ensures that:
1. Multi-hop and multi-step fraud sequences maintain strict chronological ordering and delay integrity.
2. Legitimate background transactions are interleaved at the requested target TPS.
3. Traffic curves (constant, burst, ramp, wave, random) are dynamically evaluated.
"""
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from decimal import Decimal
import heapq
import time
from typing import Dict, List, Any, Optional
import random


@dataclass(order=True)
class ScheduledItem:
    scheduled_epoch: float
    is_sequence: bool
    item_payload: Any = field(compare=False)


class SimulationScheduler:
    def __init__(
        self,
        target_tps: Decimal = Decimal("50.0"),
        traffic_pattern: str = "constant",
        burst_size: int = 50,
        burst_interval: int = 30,
        ramp_up_sec: int = 10,
        rng: Optional[random.Random] = None,
    ):
        self.target_tps = target_tps
        self.traffic_pattern = traffic_pattern
        self.burst_size = burst_size
        self.burst_interval = burst_interval
        self.ramp_up_sec = ramp_up_sec
        self.rng = rng or random.Random()
        
        # Priority queue for pre-scheduled sequence events (e.g. multi-step fraud hops)
        self.sequence_queue: List[ScheduledItem] = []
        self.start_epoch: float = time.monotonic()
        self.last_burst_epoch: float = self.start_epoch

    def schedule_sequence_transactions(self, sequence_txns: List[Dict[str, Any]], start_epoch: float):
        """Enqueue pre-planned sequence transactions with scaled timeline offsets matching target TPS."""
        if not sequence_txns:
            return
        base_time = sequence_txns[0]["timestamp"]
        tps = max(1.0, float(self.target_tps))
        for txn in sequence_txns:
            raw_offset = (txn["timestamp"] - base_time).total_seconds()
            # Scale multi-minute scenarios proportionally to real-time execution window (0.05s to 3.0s)
            scaled_offset = max(0.05, min(3.0, raw_offset / max(1.0, tps * 2.0)))
            event_epoch = start_epoch + scaled_offset
            heapq.heappush(self.sequence_queue, ScheduledItem(scheduled_epoch=event_epoch, is_sequence=True, item_payload=txn))

    def get_current_instantaneous_tps(self, elapsed_sec: float) -> float:
        """Calculate the dynamic target TPS based on the selected traffic pattern curve."""
        base_tps = float(self.target_tps)
        
        if self.traffic_pattern == "constant":
            return base_tps
            
        elif self.traffic_pattern == "ramp":
            if self.ramp_up_sec > 0 and elapsed_sec < self.ramp_up_sec:
                factor = max(0.1, elapsed_sec / self.ramp_up_sec)
                return base_tps * factor
            return base_tps

        elif self.traffic_pattern == "random":
            jitter = (self.rng.random() - 0.5) * 0.4  # +/- 20%
            return max(1.0, base_tps * (1.0 + jitter))

        elif self.traffic_pattern == "wave":
            import math
            wave_factor = 1.0 + 0.3 * math.sin(elapsed_sec / 10.0)
            return max(1.0, base_tps * wave_factor)

        elif self.traffic_pattern == "burst":
            # Normal rate baseline, periodic burst spikes
            if elapsed_sec % self.burst_interval < 3:
                return base_tps * 2.5
            return base_tps

        return base_tps

    def pop_due_sequence_items(self, current_monotonic: float) -> List[Dict[str, Any]]:
        """Retrieve all scheduled sequence transactions whose timestamp has arrived."""
        due_items = []
        while self.sequence_queue and self.sequence_queue[0].scheduled_epoch <= current_monotonic:
            item = heapq.heappop(self.sequence_queue)
            due_items.append(item.item_payload)
        return due_items
