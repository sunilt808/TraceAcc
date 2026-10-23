"""
graph_worker.py — Rolling Transaction Graph Adapter, DC-LCG Inference Worker, and Freshness-Aware Risk Cache for LiveShield Phase 2.

Features:
- Maintains a bounded rolling transaction graph (sliding window: 500–2,000 transactions).
- Loads trained DC-LCG model artifact (`dclcg_prod_e2e.pt`) once per worker.
- Executes asynchronous graph feature extraction and PyTorch inference in background micro-batches.
- Updates an in-memory thread-safe `AccountRiskCache` stamped with model_version, graph_version, timestamp, and TTL.
- Completely decoupled from FastScreeningEngine so graph inference never blocks payment ingestion.
"""
import asyncio
from datetime import datetime, timezone
import glob
import logging
import os
import time
from typing import Dict, List, Optional, Any, Set
try:
    import torch
except Exception as _torch_err:
    torch = None

from detectors.dclcg import load_artifact, predict_graph, ARTIFACT_DIR
from utils.graph import TransactionGraph

logger = logging.getLogger("liveshield")


class AccountRiskCache:
    def __init__(self, ttl_seconds: float = 60.0):
        self.ttl_seconds = ttl_seconds
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._lock = asyncio.Lock()

    def update_scores(
        self,
        prob_map: Dict[str, float],
        disguise_map: Dict[str, float],
        paths_map: Dict[str, List[str]],
        model_version: str,
        graph_version: int,
    ):
        """Thread-safe update of account scores with freshness metadata."""
        now = time.time()
        now_dt = datetime.now(timezone.utc)

        for acc, prob in prob_map.items():
            self._cache[acc] = {
                "illicit_prob": float(prob),
                "disguise": float(disguise_map.get(acc, 0.0)),
                "top_paths": paths_map.get(acc, []),
                "model_version": model_version,
                "graph_version": graph_version,
                "prediction_timestamp": now_dt,
                "_timestamp_mono": now,
                "ttl_seconds": self.ttl_seconds,
            }

    def get_account_risk(self, account_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve cached score if fresh; mark as stale if TTL expired."""
        entry = self._cache.get(account_id)
        if not entry:
            return None

        now = time.time()
        age = now - entry["_timestamp_mono"]
        is_stale = age > entry["ttl_seconds"]
        
        result = dict(entry)
        result["is_stale"] = is_stale
        result["age_seconds"] = round(age, 2)
        return result

    def size(self) -> int:
        return len(self._cache)


class RollingGraphInferenceWorker:
    def __init__(
        self,
        simulation_id: int,
        graph_queue: asyncio.Queue,
        risk_cache: AccountRiskCache,
        model_name: str = "prod_e2e",
        max_graph_size: int = 1500,
        batch_interval_sec: float = 1.0,
    ):
        self.simulation_id = simulation_id
        self.graph_queue = graph_queue
        self.risk_cache = risk_cache
        self.model_name = model_name
        self.max_graph_size = max_graph_size
        self.batch_interval_sec = batch_interval_sec

        # Rolling sliding graph
        self.rolling_graph = TransactionGraph()
        self.graph_version = 0
        self.total_inferred_batches = 0
        self.last_inference_latency_ms: float = 0.0
        self.avg_inference_latency_ms: float = 0.0

        # Model artifact bundle
        self.bundle: Optional[dict] = None
        self.model_version_str = f"dclcg_{model_name}"
        self._load_model_artifact()

        self._is_running = False
        self._task: Optional[asyncio.Task] = None

    def _load_model_artifact(self):
        """Load trained PyTorch bundle once upon worker initialization."""
        target_path = os.path.join(ARTIFACT_DIR, f"dclcg_{self.model_name}.pt")
        if not os.path.exists(target_path):
            # Fallback to any available dclcg_*.pt
            candidates = glob.glob(os.path.join(ARTIFACT_DIR, "dclcg_*.pt"))
            if candidates:
                target_path = candidates[0]
                logger.info("DC-LCG worker: Using fallback model artifact %s", target_path)
            else:
                logger.warning("No DC-LCG artifact found in %s; model inference will run heuristic fallback", ARTIFACT_DIR)
                return

        try:
            self.bundle = load_artifact(target_path)
            self.model_version_str = os.path.basename(target_path)
            logger.info("DC-LCG worker: Loaded artifact %s successfully.", self.model_version_str)
        except Exception as e:
            logger.error("Failed to load DC-LCG artifact %s: %s", target_path, e)
            self.bundle = None

    async def start(self):
        if self._is_running:
            return
        self._is_running = True
        self._task = asyncio.create_task(self._inference_loop())

    async def stop(self):
        self._is_running = False
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

    async def _inference_loop(self):
        """Background continuous micro-batch worker."""
        logger.info("DC-LCG Rolling Graph Worker started for simulation %d", self.simulation_id)
        
        while self._is_running:
            try:
                # Drain queue items into rolling graph
                drained_count = 0
                while not self.graph_queue.empty():
                    try:
                        envelope = self.graph_queue.get_nowait()
                        self._add_to_rolling_graph(envelope)
                        self.graph_queue.task_done()
                        drained_count += 1
                    except Exception:
                        break

                # If graph has sufficient activity, trigger inference
                if len(self.rolling_graph.transactions) >= 4 and (drained_count > 0 or self.total_inferred_batches == 0):
                    await self._run_inference_step()

                await asyncio.sleep(self.batch_interval_sec)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("Error in graph inference loop: %s", e)

    def _add_to_rolling_graph(self, envelope: Dict[str, Any]):
        """Append to bounded sliding window graph."""
        sender = envelope["sender_account"]
        receiver = envelope["receiver_account"]
        amount = float(envelope["amount"])
        ts = envelope.get("timestamp") or datetime.now(timezone.utc)

        self.rolling_graph.add_transaction(sender, receiver, amount, ts)
        self.graph_version += 1

        # Prune older transactions beyond max_graph_size
        if len(self.rolling_graph.transactions) > self.max_graph_size:
            self.rolling_graph.transactions = self.rolling_graph.transactions[-self.max_graph_size:]
            # Rebuild adjacency
            new_g = TransactionGraph()
            for tx in self.rolling_graph.transactions:
                new_g.add_transaction(tx['sender'], tx['receiver'], tx['amount'], tx['timestamp'])
            self.rolling_graph = new_g

    async def _run_inference_step(self):
        """Execute DC-LCG model prediction in executor thread and update cache."""
        if not self.bundle:
            return

        t_start = time.perf_counter()
        try:
            loop = asyncio.get_running_loop()
            # Run CPU-bound PyTorch inference in threadpool
            res = await loop.run_in_executor(
                None,
                predict_graph,
                self.rolling_graph,
                self.bundle,
            )

            latency_ms = (time.perf_counter() - t_start) * 1000.0
            self.last_inference_latency_ms = round(latency_ms, 2)
            self.total_inferred_batches += 1
            
            # Rolling average latency
            self.avg_inference_latency_ms = (
                (self.avg_inference_latency_ms * (self.total_inferred_batches - 1) + latency_ms)
                / self.total_inferred_batches
            )

            # Update cache with freshness metadata
            prob_map = res.get("probs", {})
            disguise_map = res.get("disguise", {})
            paths_map = res.get("top_paths", {})

            self.risk_cache.update_scores(
                prob_map=prob_map,
                disguise_map=disguise_map,
                paths_map=paths_map,
                model_version=self.model_version_str,
                graph_version=self.graph_version,
            )

            # Trigger Phase 2.5 CRRE if high risk nodes or patterns were identified
            if hasattr(self, "reevaluation_engine") and self.reevaluation_engine:
                high_risk_nodes = [acc for acc, p in prob_map.items() if p >= 0.70]
                if high_risk_nodes:
                    asyncio.create_task(
                        self.reevaluation_engine.trigger_graph_pattern(
                            pattern_type="HIGH_RISK_SUBGRAPH",
                            participating_accounts=high_risk_nodes,
                            graph_version=self.graph_version,
                            motif_metrics={"probs": {acc: prob_map[acc] for acc in high_risk_nodes}},
                        )
                    )

        except Exception as e:
            logger.error("DC-LCG inference step error in sim %d: %s", self.simulation_id, e)

    def get_telemetry(self) -> Dict[str, Any]:
        return {
            "model_version": self.model_version_str,
            "graph_version": self.graph_version,
            "rolling_graph_nodes": len(self.rolling_graph.nodes),
            "rolling_graph_edges": len(self.rolling_graph.transactions),
            "cached_accounts": self.risk_cache.size(),
            "total_inferred_batches": self.total_inferred_batches,
            "last_inference_latency_ms": self.last_inference_latency_ms,
            "avg_inference_latency_ms": round(self.avg_inference_latency_ms, 2),
            "is_running": self._is_running,
        }
