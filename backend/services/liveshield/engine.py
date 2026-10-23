"""
services/liveshield/engine.py — Core simulation execution engine with high-throughput rate control,
Fast Screening, DC-LCG Graph Inference, Calibrated Decisioning, and Dual Evaluation (Phases 1 & 2).
"""
import asyncio
from datetime import datetime, timezone
from decimal import Decimal
import logging
import random
import time
from typing import Dict, List, Any, Optional, Callable

from sqlalchemy.orm import Session
from fastapi.encoders import jsonable_encoder
from db.database import SessionLocal
from models.liveshield import (
    Simulation,
    SimulationTransaction,
    SimulationEvent,
    SimulationDecisionRecord,
    SimulationEvaluationSummary,
)
from services.liveshield.accounts import AccountPopulation
from services.liveshield.legitimate import LegitimateTransactionGenerator
from services.liveshield.registry import scenario_registry
from services.liveshield.scheduler import SimulationScheduler
from services.liveshield.stream import LiveShieldStreamBroker
from services.liveshield.screening import FastScreeningEngine
from services.liveshield.graph_worker import RollingGraphInferenceWorker, AccountRiskCache
from services.liveshield.decision_engine import DecisionEngine
from services.liveshield.evaluator import DualEvaluationEngine
from services.liveshield.alert_bridge import LiveShieldAlertBridge
from services.liveshield.affected_index import AffectedTransactionIndex
from services.liveshield.reevaluation import ContinuousRiskReevaluationEngine

logger = logging.getLogger("liveshield")


class SimulationEngine:
    def __init__(
        self,
        simulation_id: int,
        config: Dict[str, Any],
        on_event_callback: Optional[Callable[[Dict[str, Any]], None]] = None,
        on_transaction_callback: Optional[Callable[[Dict[str, Any]], None]] = None,
        on_decision_callback: Optional[Callable[[Dict[str, Any]], None]] = None,
    ):
        self.simulation_id = simulation_id
        self.config = config
        self.on_event = on_event_callback
        self.on_transaction = on_transaction_callback
        self.on_decision = on_decision_callback

        # Lifecycle State: DRAFT, READY, RUNNING, PAUSED, STOPPED, COMPLETED, FAILED
        self.status = "READY"
        self._is_paused = False
        self._is_stopped = False
        self._task: Optional[asyncio.Task] = None

        # Config extraction
        self.mode = config.get("mode", "basic")
        self.uploaded_transactions_queue = list(config.get("dataset_transactions") or [])
        default_target_tps = float(config.get("target_tps", 50.0))
        if default_target_tps <= 0:
            default_target_tps = 50.0
        self.target_tps = Decimal(str(default_target_tps))
        
        if self.uploaded_transactions_queue:
            self.total_transactions = len(self.uploaded_transactions_queue)
        else:
            self.total_transactions = config.get("total_transactions", 1000)
            
        self.duration_seconds = config.get("duration_seconds")
        self.unlimited = config.get("unlimited", False)
        
        # Traffic composition
        self.traffic_comp = config.get("traffic_composition", "mixed")
        self.legit_pct = float(config.get("legitimate_percentage", 80.0))
        self.fraud_pct = float(config.get("fraudulent_percentage", 20.0))
        
        self.currency = config.get("currency", "USD")
        self.num_accounts = int(config.get("num_accounts", 60))
        self.txn_prefix = config.get("txn_prefix", "TXN")
        self.seed = config.get("random_seed")
        self.rng = random.Random(self.seed)

        # Detection Configuration (Phase 2)
        self.detection_mode = config.get("detection_mode", "shadow")
        self.detection_config = config.get("detection_config", {})

        # Phase 2 Components
        self.stream_broker = LiveShieldStreamBroker(simulation_id=self.simulation_id, max_queue_size=20000)
        self.screening_engine = FastScreeningEngine(config=self.detection_config.get("screening_rules"))
        self.risk_cache = AccountRiskCache(ttl_seconds=300.0)
        self.graph_worker = RollingGraphInferenceWorker(
            simulation_id=self.simulation_id,
            graph_queue=self.stream_broker.graph_queue,
            risk_cache=self.risk_cache,
            max_graph_size=int(self.detection_config.get("graph_window_size", 1500)),
            batch_interval_sec=float(self.detection_config.get("graph_update_interval", 1.0)),
        )
        self.decision_engine = DecisionEngine(
            detection_mode=self.detection_mode,
            config=self.detection_config,
        )
        self.evaluator = DualEvaluationEngine(simulation_id=self.simulation_id)
        self.alert_bridge = LiveShieldAlertBridge(
            db_session_factory=SessionLocal,
            organization_id=self.config.get("organization_id", 1),
            created_by_id=self.config.get("created_by_id"),
            case_id=self.config.get("case_id"),
        )

        # Phase 2.5 Continuous Risk Re-evaluation Components
        self.affected_index = AffectedTransactionIndex(simulation_id=self.simulation_id)
        self.reevaluation_engine = ContinuousRiskReevaluationEngine(
            simulation_id=self.simulation_id,
            affected_index=self.affected_index,
            risk_cache=self.risk_cache,
            screening_engine=self.screening_engine,
            alert_bridge=self.alert_bridge,
            config=self.config,
            db_session_factory=SessionLocal,
            on_reassessment=self._on_crre_reassessment,
        )
        self.graph_worker.reevaluation_engine = self.reevaluation_engine

        # Initialize synthetic population & generators
        self.population = AccountPopulation(
            num_accounts=self.num_accounts,
            currency=self.currency,
            seed=self.seed,
        )
        self.legit_gen = LegitimateTransactionGenerator(
            population=self.population,
            category_weights=config.get("legitimate_category_weights"),
            currency=self.currency,
            txn_prefix=self.txn_prefix,
            seed=self.seed,
        )
        self.scheduler = SimulationScheduler(
            target_tps=self.target_tps,
            traffic_pattern=config.get("traffic_pattern", "constant"),
            rng=self.rng,
        )

        # Live telemetry counters
        self.total_generated = 0
        self.total_legitimate = 0
        self.total_fraudulent = 0
        self.total_volume = Decimal("0.00")
        self.scenario_counts: Dict[str, int] = {}
        self.start_time: Optional[float] = None
        self.start_datetime: Optional[datetime] = None
        self.elapsed_seconds: float = 0.0
        self.final_elapsed: Optional[float] = None
        self.actual_tps: float = 0.0
        self.published_tps: float = 0.0
        self.counter = 1

    def set_target_tps(self, new_tps: float):
        """Dynamically adjust streaming rate and delay per transaction in real time."""
        if new_tps <= 0.1:
            new_tps = 0.1
        self.target_tps = Decimal(str(round(new_tps, 2)))
        self.scheduler.target_tps = self.target_tps
        logger.info("Simulation %d target TPS updated dynamically to %s", self.simulation_id, self.target_tps)

    def _on_crre_reassessment(self, event_data: Dict[str, Any]):
        """Handle CRRE reassessment update: update evaluator and broadcast over WebSocket."""
        self.evaluator.record_reassessment(event_data)
        try:
            from services.liveshield.manager import simulation_manager
            simulation_manager.broadcast_event_sync(self.simulation_id, event_data, "reassessment")
        except Exception as e:
            logger.debug("Failed to broadcast CRRE event: %s", e)
        if self.on_decision:
            self.on_decision(event_data)


    def get_stats(self) -> Dict[str, Any]:
        """Compute real-time statistics snapshot including detection & evaluation metrics."""
        if self.final_elapsed is not None:
            elapsed = self.final_elapsed
        elif self.start_time:
            elapsed = time.monotonic() - self.start_time
        else:
            elapsed = 0.0
        
        if self.status in ("COMPLETED", "STOPPED", "FAILED"):
            current_tps = 0.0
            remaining_sec = 0.0
            if self.final_elapsed is None and self.start_time:
                self.final_elapsed = elapsed
        elif self.status == "PAUSED":
            current_tps = 0.0
            if self.duration_seconds:
                remaining_sec = max(0.0, self.duration_seconds - elapsed)
            elif self.total_transactions and not self.unlimited:
                remaining_txns = max(0, self.total_transactions - self.total_generated)
                remaining_sec = (remaining_txns / float(self.target_tps)) if self.target_tps > 0 else 0.0
            else:
                remaining_sec = None
        else:
            current_tps = (self.total_generated / elapsed) if elapsed > 0 else float(self.target_tps)
            remaining_sec = None
            if self.duration_seconds:
                remaining_sec = max(0.0, self.duration_seconds - elapsed)
            elif self.total_transactions and not self.unlimited:
                remaining_txns = max(0, self.total_transactions - self.total_generated)
                remaining_sec = (remaining_txns / float(self.target_tps)) if self.target_tps > 0 else 0.0

        eval_summary = self.evaluator.get_summary()

        return {
            "simulation_id": self.simulation_id,
            "status": self.status,
            "detection_mode": self.decision_engine.detection_mode,
            "configured_tps": float(self.target_tps),
            "actual_tps": round(current_tps, 2),
            "published_tps": round(self.published_tps if self.status == "RUNNING" else 0.0, 2),
            "total_generated": self.total_generated,
            "total_legitimate": self.total_legitimate,
            "total_fraudulent": self.total_fraudulent,
            "fraud_percentage": round((self.total_fraudulent / self.total_generated * 100) if self.total_generated > 0 else 0.0, 2),
            "total_volume": float(self.total_volume),
            "elapsed_seconds": round(elapsed, 2),
            "remaining_seconds": round(remaining_sec, 2) if remaining_sec is not None else None,
            "active_scenarios": list(self.scenario_counts.keys()),
            "scenario_counts": self.scenario_counts,
            "queue_backlog": len(self.scheduler.sequence_queue),
            "held_count": self.decision_engine.held_queue.count(self.simulation_id),
            "worker_status": self.status,
            "evaluation": eval_summary,
            "graph_worker_stats": self.graph_worker.get_telemetry(),
            "reevaluation_stats": self.reevaluation_engine.get_telemetry(),
            "affected_index_stats": self.affected_index.get_stats(),
        }

    async def start(self):
        """Start async simulation generation loop and background graph worker."""
        if self.status == "RUNNING":
            return
        
        self.status = "RUNNING"
        self._is_paused = False
        self._is_stopped = False
        self.final_elapsed = None
        self.start_time = time.monotonic()
        self.start_datetime = datetime.now(timezone.utc)
        
        await self.graph_worker.start()
        await self.reevaluation_engine.start()
        self._task = asyncio.create_task(self._run_loop())

    async def pause(self):
        """Pause generation without corrupting sequences."""
        if self.status == "RUNNING":
            self._is_paused = True
            self.status = "PAUSED"
            self._persist_state("PAUSED", "Simulation paused by operator")

    async def resume(self):
        """Resume generation from existing state."""
        if self.status == "PAUSED":
            self._is_paused = False
            self.status = "RUNNING"
            self._persist_state("RUNNING", "Simulation resumed by operator")

    async def stop(self):
        """Cleanly stop simulation and persist final state."""
        self._is_stopped = True
        self.status = "STOPPED"
        if self.final_elapsed is None and self.start_time:
            self.final_elapsed = time.monotonic() - self.start_time
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        await self.reevaluation_engine.stop()
        await self.graph_worker.stop()
        await self.stream_broker.close()
        self._persist_state("STOPPED", "Simulation stopped by operator")

    def _persist_state(self, status: str, event_msg: str):
        """Update DB record with current state and stats."""
        db = None
        try:
            db = SessionLocal()
            sim = db.query(Simulation).filter(Simulation.id == self.simulation_id).first()
            if sim:
                sim.status = status
                sim.stats = jsonable_encoder(self.get_stats())
                if status in ("STOPPED", "COMPLETED"):
                    sim.stopped_at = datetime.now(timezone.utc)
                db.add(sim)
                db.add(SimulationEvent(
                    simulation_id=self.simulation_id,
                    event_type="STATE_CHANGE",
                    message=event_msg,
                    details=jsonable_encoder({"status": status, "total_generated": self.total_generated}),
                ))
                db.commit()
        except Exception as e:
            if db:
                db.rollback()
            logger.error("Error persisting state for sim %d: %s", self.simulation_id, e)
        finally:
            if db:
                db.close()

    async def _run_loop(self):
        """Main async rate-regulated generation, screening, and decision worker."""
        logger.info("Starting simulation %d at target TPS %s", self.simulation_id, self.target_tps)
        self._persist_state("RUNNING", f"Simulation started at {self.target_tps} TPS in mode '{self.detection_mode}'")
        
        batch_txns: List[Dict[str, Any]] = []
        batch_decisions: List[Dict[str, Any]] = []
        last_db_flush = time.monotonic()
        last_tps_measure = time.monotonic()
        txns_since_measure = 0

        selected_scenarios = self.config.get("selected_scenarios", ["F01", "F02", "F03", "F04", "F05", "F06"])
        if self.config.get("scenarios"):
            selected_scenarios = [s["scenario_id"] for s in self.config["scenarios"] if s.get("enabled", True)]
        if not selected_scenarios:
            selected_scenarios = ["F01", "F02", "F03", "F04"]

        try:
            while not self._is_stopped:
                # 1. Handle Pause
                if self._is_paused:
                    await asyncio.sleep(0.2)
                    continue

                # 2. Check Termination Limits
                now_mono = time.monotonic()
                elapsed = (now_mono - self.start_time) if self.start_time else 0.0
                if not self.unlimited and self.total_transactions and self.total_generated >= self.total_transactions:
                    self.status = "COMPLETED"
                    self.final_elapsed = elapsed
                    break
                if self.duration_seconds and elapsed >= self.duration_seconds:
                    self.status = "COMPLETED"
                    self.final_elapsed = elapsed
                    break

                # 3. Rate regulation
                current_tps = self.scheduler.get_current_instantaneous_tps(elapsed)
                delay_per_txn = 1.0 / max(1.0, current_tps)

                # 4. Generate or Stream transaction
                if self.uploaded_transactions_queue:
                    raw_txn = self.uploaded_transactions_queue.pop(0)
                    txn_id = raw_txn.get("transaction_id") or raw_txn.get("id") or f"TXN-UP-{self.simulation_id}-{self.total_generated+1:06d}"
                    sender = str(raw_txn.get("sender_account") or raw_txn.get("sender") or raw_txn.get("sender_id") or "").strip()
                    receiver = str(raw_txn.get("receiver_account") or raw_txn.get("receiver") or raw_txn.get("receiver_id") or "").strip()
                    amt = float(raw_txn.get("amount", 100.0))
                    gt = raw_txn.get("synthetic_ground_truth") or ("fraudulent" if raw_txn.get("is_fraud") else "legitimate")
                    
                    txn = {
                        "simulation_id": self.simulation_id,
                        "transaction_id": txn_id,
                        "sequence_id": raw_txn.get("sequence_id") or f"SEQ-{(self.total_generated // 50) + 1:04d}",
                        "step_index": self.total_generated,
                        "sender_account": sender,
                        "receiver_account": receiver,
                        "amount": amt,
                        "currency": raw_txn.get("currency", self.currency),
                        "transaction_type": raw_txn.get("transaction_type", "TRANSFER"),
                        "channel": raw_txn.get("channel", "ONLINE"),
                        "timestamp": raw_txn.get("timestamp") or datetime.now(timezone.utc).isoformat(),
                        "source_country": raw_txn.get("source_country", "US"),
                        "dest_country": raw_txn.get("dest_country", "US"),
                        "device_id": raw_txn.get("device_id"),
                        "merchant_id": raw_txn.get("merchant_id"),
                        "scenario_id": raw_txn.get("scenario_id") or raw_txn.get("pattern_type") or raw_txn.get("pattern"),
                        "synthetic_ground_truth": gt,
                        "account_ground_truth": raw_txn.get("account_ground_truth"),
                        "sequence_ground_truth": raw_txn.get("sequence_ground_truth"),
                        "scenario_metadata": raw_txn.get("scenario_metadata", {}),
                    }
                else:
                    due_seq_txns = self.scheduler.pop_due_sequence_items(now_mono)
                    
                    if due_seq_txns:
                        txn = due_seq_txns[0]
                    else:
                        is_fraud = False
                        if self.traffic_comp == "fraudulent_only":
                            is_fraud = True
                        elif self.traffic_comp == "mixed":
                            is_fraud = (self.rng.random() * 100.0) < self.fraud_pct

                        if is_fraud:
                            scen_id = self.rng.choice(selected_scenarios)
                            syndicate_pop = self.population.get_syndicate_population()
                            seq_txns, self.counter = scenario_registry.generate_sequence(
                                scenario_id=scen_id,
                                population=syndicate_pop,
                                base_time=datetime.now(timezone.utc),
                                txn_prefix=self.txn_prefix,
                                counter_start=self.counter,
                                rng=self.rng,
                            )
                            if seq_txns:
                                txn = seq_txns[0]
                                if len(seq_txns) > 1:
                                    self.scheduler.schedule_sequence_transactions(seq_txns[1:], now_mono)
                            else:
                                self.legit_gen.counter = self.counter
                                txn = self.legit_gen.generate_single_transaction()
                                self.counter = self.legit_gen.counter
                        else:
                            self.legit_gen.counter = self.counter
                            txn = self.legit_gen.generate_single_transaction()
                            self.counter = self.legit_gen.counter

                    txn["simulation_id"] = self.simulation_id
                t_ingested_iso = datetime.now(timezone.utc).isoformat()

                # 5. Fast Screening & Calibrated Decision Pipeline (<1ms)
                t_screen_start = time.perf_counter()
                
                sender_acc = txn.get("sender_account", "")
                receiver_acc = txn.get("receiver_account", "")
                
                cached_s = self.risk_cache.get_account_risk(sender_acc)
                cached_r = self.risk_cache.get_account_risk(receiver_acc)
                
                fast_score, fast_signals = self.screening_engine.screen_transaction(
                    txn=txn,
                    cached_sender_risk=cached_s,
                    cached_receiver_risk=cached_r,
                )
                t_screened_iso = datetime.now(timezone.utc).isoformat()
                screening_lat_ms = (time.perf_counter() - t_screen_start) * 1000.0

                s_prob = cached_s.get("illicit_prob", 0.0) if cached_s and not cached_s.get("is_stale") else 0.0
                r_prob = cached_r.get("illicit_prob", 0.0) if cached_r and not cached_r.get("is_stale") else 0.0
                dclcg_prob = max(s_prob, r_prob) if (cached_s or cached_r) else None

                decision_rec = self.decision_engine.evaluate_decision(
                    transaction=txn,
                    screening_result={"fast_score": fast_score, "signals": fast_signals},
                    dclcg_score=dclcg_prob,
                    dclcg_disguise=cached_s.get("disguise") if cached_s else None,
                    dclcg_top_paths=cached_s.get("top_paths") if cached_s else None,
                    cached_sender_risk=s_prob,
                    cached_receiver_risk=r_prob,
                    model_version=self.graph_worker.model_version_str,
                    graph_version=self.graph_worker.graph_version,
                    t_ingested_iso=t_ingested_iso,
                    t_screened_iso=t_screened_iso,
                    screening_latency_ms=screening_lat_ms,
                )

                # 6. Evaluation & Alert Bridge Integration
                self.evaluator.record_decision(decision_rec)
                
                if decision_rec.get("risk_tier") in ("HIGH", "CRITICAL") or decision_rec.get("final_decision") in ("FLAG", "HOLD", "REJECT"):
                    self.alert_bridge.create_alert_for_decision(decision_rec)

                # 6b. Phase 2.5 Continuous Risk Re-evaluation Ingestion & Counterparty Trigger
                risk_status = "HIGH_RISK" if decision_rec.get("risk_tier") in ("HIGH", "CRITICAL") else ("SUSPICIOUS" if decision_rec.get("final_decision") == "FLAG" else "LOW_RISK")
                await self.reevaluation_engine.trigger_new_transaction(
                    txn=txn,
                    initial_decision=decision_rec.get("final_decision", "APPROVE"),
                    risk_score=decision_rec.get("combined_risk_score", 0.0),
                    risk_status=risk_status,
                )

                # 6c. Graph-walk counterparty propagation: flag connected suspicious / de-flag cleared
                await self.reevaluation_engine.trigger_decision_propagation(
                    txn=txn,
                    final_decision=decision_rec.get("final_decision", "APPROVE"),
                    risk_tier=decision_rec.get("risk_tier", "LOW"),
                    combined_risk_score=float(decision_rec.get("combined_risk_score", 0.0)),
                )

                # 7. Publish to decoupled graph inference queue
                await self.stream_broker.publish_transaction(txn)

                # Update telemetry counters
                self.total_generated += 1
                txns_since_measure += 1
                self.total_volume += Decimal(str(txn["amount"]))
                if txn["synthetic_ground_truth"] == "fraudulent":
                    self.total_fraudulent += 1
                    sc_id = txn.get("scenario_id") or "UNKNOWN"
                    self.scenario_counts[sc_id] = self.scenario_counts.get(sc_id, 0) + 1
                else:
                    self.total_legitimate += 1

                batch_txns.append(txn)
                batch_decisions.append(decision_rec)

                if self.on_transaction:
                    self.on_transaction(txn)
                if self.on_decision:
                    self.on_decision(decision_rec)

                # Measure published TPS
                if now_mono - last_tps_measure >= 1.0:
                    self.published_tps = txns_since_measure / (now_mono - last_tps_measure)
                    last_tps_measure = now_mono
                    txns_since_measure = 0
                    if self.on_event:
                        self.on_event(self.get_stats())

                # Adaptive Batch persist to DB: size scales with TPS (e.g. 50-250 txns or 1.0s interval)
                batch_limit = max(50, min(250, int(float(self.target_tps) * 0.5)))
                if len(batch_txns) >= batch_limit or (now_mono - last_db_flush >= 1.0 and batch_txns):
                    self._flush_batch_to_db(batch_txns, batch_decisions)
                    batch_txns.clear()
                    batch_decisions.clear()
                    last_db_flush = now_mono

                await asyncio.sleep(delay_per_txn)

        except asyncio.CancelledError:
            logger.info("Simulation %d loop cancelled", self.simulation_id)
        except Exception as e:
            logger.error("Simulation %d encountered error: %s", self.simulation_id, e, exc_info=True)
            self.status = "FAILED"
            self._persist_state("FAILED", f"Error: {str(e)}")
        finally:
            if batch_txns or batch_decisions:
                self._flush_batch_to_db(batch_txns, batch_decisions)
            await self.graph_worker.stop()
            if self.status == "COMPLETED":
                self._persist_state("COMPLETED", f"Simulation completed successfully with {self.total_generated} txns")
                if getattr(self, "broadcast_callback", None):
                    try:
                        await self.broadcast_callback(self.simulation_id, {
                            "type": "stats",
                            "data": self.get_stats(),
                        })
                    except Exception:
                        pass

    def _safe_dt(self, val):
        """Safely parse timestamps into datetime objects supporting ISO-8601 with Z."""
        if val is None:
            return None
        if isinstance(val, datetime):
            return val
        s = str(val).strip()
        if not s or s.lower() == 'nan':
            return None
        try:
            return datetime.fromisoformat(s.replace('Z', '+00:00'))
        except Exception:
            for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d"):
                try:
                    return datetime.strptime(s, fmt)
                except Exception:
                    pass
        return None

    def _flush_batch_to_db(self, batch_txns: List[Dict[str, Any]], batch_decisions: List[Dict[str, Any]]):
        """Batch insert generated transactions and decision records into PostgreSQL/SQLite."""
        db = None
        try:
            db = SessionLocal()
            
            # 1. Transactions
            if batch_txns:
                txn_models = [
                    SimulationTransaction(
                        simulation_id=self.simulation_id,
                        sequence_id=t.get("sequence_id"),
                        step_index=t.get("step_index", 0),
                        transaction_id=t["transaction_id"],
                        sender_account=t["sender_account"],
                        receiver_account=t["receiver_account"],
                        amount=Decimal(str(t["amount"])),
                        currency=t.get("currency", "USD"),
                        transaction_type=t.get("transaction_type", "TRANSFER"),
                        channel=t.get("channel", "ONLINE"),
                        timestamp=self._safe_dt(t.get("timestamp")) or datetime.now(timezone.utc),
                        scheduled_timestamp=self._safe_dt(t.get("scheduled_timestamp")),
                        source_country=t.get("source_country", "US"),
                        dest_country=t.get("dest_country", "US"),
                        device_id=t.get("device_id"),
                        merchant_id=t.get("merchant_id"),
                        scenario_id=t.get("scenario_id"),
                        synthetic_ground_truth=t.get("synthetic_ground_truth", "legitimate"),
                        account_ground_truth=t.get("account_ground_truth"),
                        sequence_ground_truth=t.get("sequence_ground_truth"),
                        scenario_metadata=jsonable_encoder(t.get("scenario_metadata", {})),
                        is_synthetic=True,
                    )
                    for t in batch_txns
                ]
                db.bulk_save_objects(txn_models)

            # 2. Decision Records
            if batch_decisions:
                dec_models = [
                    SimulationDecisionRecord(
                        simulation_id=self.simulation_id,
                        transaction_id=d["transaction_id"],
                        sequence_id=d.get("sequence_id"),
                        step_index=d.get("step_index", 0),
                        sender_account=d["sender_account"],
                        receiver_account=d["receiver_account"],
                        amount=Decimal(str(d["amount"])),
                        timestamp=self._safe_dt(d.get("timestamp")) or datetime.now(timezone.utc),
                        detection_mode=d.get("detection_mode", "shadow"),
                        initial_decision=d.get("initial_decision", "APPROVE"),
                        final_decision=d.get("final_decision", "APPROVE"),
                        decision_reason=d.get("decision_reason"),
                        fast_screening_score=d.get("fast_screening_score", 0.0),
                        fast_screening_signals=jsonable_encoder(d.get("fast_screening_signals", [])),
                        dclcg_score=d.get("dclcg_score"),
                        dclcg_disguise_score=d.get("dclcg_disguise_score"),
                        dclcg_top_paths=jsonable_encoder(d.get("dclcg_top_paths", [])),
                        model_version=d.get("model_version"),
                        graph_version=d.get("graph_version"),
                        combined_risk_score=d.get("combined_risk_score", 0.0),
                        risk_tier=d.get("risk_tier", "LOW"),
                        t_generated=self._safe_dt(d.get("t_generated")),
                        t_ingested=self._safe_dt(d.get("t_ingested")),
                        t_screened=self._safe_dt(d.get("t_screened")),
                        t_decided=self._safe_dt(d.get("t_decided")),
                        t_graph_inferred=self._safe_dt(d.get("t_graph_inferred")),
                        latency_screening_ms=d.get("latency_screening_ms"),
                        latency_model_ms=d.get("latency_model_ms"),
                        latency_total_ms=d.get("latency_total_ms"),
                        operator_action=d.get("operator_action"),
                        operator_notes=d.get("operator_notes"),
                        operator_user_id=d.get("operator_user_id"),
                        synthetic_ground_truth=d.get("synthetic_ground_truth", "legitimate"),
                        scenario_id=d.get("scenario_id"),
                        evaluation_label=d.get("evaluation_label"),
                    )
                    for d in batch_decisions
                ]
                db.bulk_save_objects(dec_models)
            
            # 3. Update simulation stats snapshot & evaluation in DB
            sim = db.query(Simulation).filter(Simulation.id == self.simulation_id).first()
            if sim:
                sim.stats = jsonable_encoder(self.get_stats())
                db.add(sim)

            db.commit()
        except Exception as e:
            if db:
                db.rollback()
            logger.error("Database batch insert failed for sim %d: %s", self.simulation_id, e, exc_info=True)
        finally:
            if db:
                db.close()
