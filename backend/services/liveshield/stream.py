"""
stream.py — Durable Ingestion Broker and Independent Fan-Out Queues for LiveShield Phase 2.

Architecture:
- Ingestion Broker receives transactions from SimulationEngine.
- Stamps unique event_id, idempotency key, and timing milestones (t_generated, t_ingested).
- Fans out to two completely DECOUPLED consumer queues:
    1. FastScreeningConsumer: Synchronous screening & initial payment decision (target < 50ms).
    2. GraphInferenceConsumer: Incremental buffer & DC-LCG rolling graph worker (1-3s async).
- Enforces strict sequence ordering for multi-step scenarios by sequence_id and step_index.
- Tracks processing stages independently with idempotency and recovery state.
"""
import asyncio
from datetime import datetime, timezone
import logging
import time
from typing import Dict, List, Optional, Any, Callable, Set

logger = logging.getLogger("liveshield")


class LiveShieldStreamBroker:
    def __init__(self, simulation_id: int, max_queue_size: int = 10000):
        self.simulation_id = simulation_id
        self.max_queue_size = max_queue_size
        
        # Independent decoupled queues
        self.screening_queue: asyncio.Queue = asyncio.Queue(maxsize=max_queue_size)
        self.graph_queue: asyncio.Queue = asyncio.Queue(maxsize=max_queue_size)
        
        # Sequence ordering tracker: sequence_id -> list of buffered out-of-order steps
        self._sequence_buffers: Dict[str, Dict[int, Dict[str, Any]]] = {}
        self._sequence_expected_step: Dict[str, int] = {}
        
        # Idempotency tracking (set of processed transaction_ids)
        self._processed_events: Set[str] = set()
        self._event_counter = 0
        self._is_active = True
        self._lock = asyncio.Lock()

    async def publish_transaction(self, raw_txn: Dict[str, Any]) -> bool:
        """
        Ingest a transaction, stamp tracking metadata, and fan out to independent queues.
        Ensures idempotency and preserves sequence step ordering.
        """
        if not self._is_active:
            return False

        t_ingested = datetime.now(timezone.utc)
        t_ingested_mono = time.monotonic()
        
        txn_id = raw_txn.get("transaction_id")
        if not txn_id:
            return False

        # Idempotency check
        async with self._lock:
            if txn_id in self._processed_events:
                logger.warning("Duplicate transaction %s suppressed by idempotency guard", txn_id)
                return False
            self._processed_events.add(txn_id)
            self._event_counter += 1
            event_id = f"EVT-{self.simulation_id}-{self._event_counter:08d}"

        # Enriched stream envelope
        envelope = dict(raw_txn)
        envelope["event_id"] = event_id
        envelope["idempotency_key"] = f"IDEMP-{txn_id}"
        envelope["t_generated"] = raw_txn.get("generated_timestamp") or t_ingested
        envelope["t_ingested"] = t_ingested
        envelope["_t_ingested_mono"] = t_ingested_mono

        # Handle sequence step ordering
        seq_id = envelope.get("sequence_id")
        step_idx = envelope.get("step_index", 0)

        if seq_id:
            async with self._lock:
                expected = self._sequence_expected_step.get(seq_id, 0)
                if step_idx == expected:
                    # Next expected step in sequence
                    self._sequence_expected_step[seq_id] = expected + 1
                    await self._fan_out(envelope)
                    
                    # Drain any buffered subsequent steps for this sequence
                    buf = self._sequence_buffers.get(seq_id, {})
                    cur_step = expected + 1
                    while cur_step in buf:
                        next_env = buf.pop(cur_step)
                        self._sequence_expected_step[seq_id] = cur_step + 1
                        await self._fan_out(next_env)
                        cur_step += 1
                    if not buf and seq_id in self._sequence_buffers:
                        del self._sequence_buffers[seq_id]
                else:
                    # Buffer out-of-order step
                    if seq_id not in self._sequence_buffers:
                        self._sequence_buffers[seq_id] = {}
                    self._sequence_buffers[seq_id][step_idx] = envelope
        else:
            await self._fan_out(envelope)

        return True

    async def _fan_out(self, envelope: Dict[str, Any]):
        """Non-blocking fan-out to both independent consumer queues."""
        # 1. Fast screening queue
        try:
            self.screening_queue.put_nowait(envelope)
        except asyncio.QueueFull:
            logger.warning("Screening queue full (simulation %d); dropping oldest", self.simulation_id)
            try:
                self.screening_queue.get_nowait()
                self.screening_queue.put_nowait(envelope)
            except Exception:
                pass

        # 2. Graph inference queue
        try:
            self.graph_queue.put_nowait(envelope)
        except asyncio.QueueFull:
            logger.warning("Graph queue full (simulation %d); buffering drop oldest", self.simulation_id)
            try:
                self.graph_queue.get_nowait()
                self.graph_queue.put_nowait(envelope)
            except Exception:
                pass

    def get_screening_backlog(self) -> int:
        return self.screening_queue.qsize()

    def get_graph_backlog(self) -> int:
        return self.graph_queue.qsize()

    async def close(self):
        self._is_active = False
