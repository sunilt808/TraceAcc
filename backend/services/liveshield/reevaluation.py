"""
reevaluation.py — Continuous Risk Re-evaluation Engine (CRRE) for TraceAcc LiveShield Phase 2.5.

Features:
- Event-driven, asynchronous background reassessment worker with priority scheduling.
- Supports 4 trigger categories:
  1. NEW_TRANSACTION: Real-time counterparty & sequence propagation.
  2. NEW_GRAPH_PATTERN: High-risk DC-LCG motif or cycle discovery.
  3. INVESTIGATION_EVIDENCE: Verified investigator confirmation / dismissal.
  4. SCHEDULED: Observation window sweeps.
- Decoupled state machines: Payment Status (Immutable) vs Risk Status (Evolving) vs Ground Truth (Strictly Separated).
- Configurable risk transition policies with threshold hysteresis to prevent boundary flapping.
- Retrospective fraud alerting & false-positive evidence-based clearance.
- Atomically versioned audit history persisted to database.
"""
import asyncio
from datetime import datetime, timezone
import logging
import time
from typing import Dict, List, Optional, Set, Any, Tuple, Callable

from models.liveshield import (
    TransactionRiskAssessment,
    RiskReevaluationEvent,
    SimulationDecisionRecord,
)
from services.liveshield.affected_index import AffectedTransactionIndex
from services.liveshield.graph_worker import AccountRiskCache
from services.liveshield.screening import FastScreeningEngine
from services.liveshield.alert_bridge import LiveShieldAlertBridge

logger = logging.getLogger("liveshield")


class ContinuousRiskReevaluationEngine:
    def __init__(
        self,
        simulation_id: int,
        affected_index: AffectedTransactionIndex,
        risk_cache: AccountRiskCache,
        screening_engine: FastScreeningEngine,
        alert_bridge: LiveShieldAlertBridge,
        config: Optional[Dict[str, Any]] = None,
        db_session_factory: Optional[Callable] = None,
        on_reassessment: Optional[Callable[[Dict[str, Any]], None]] = None,
    ):
        self.simulation_id = simulation_id
        self.affected_index = affected_index
        self.risk_cache = risk_cache
        self.screening_engine = screening_engine
        self.alert_bridge = alert_bridge
        self.config = config or {}
        self.db_session_factory = db_session_factory
        self.on_reassessment = on_reassessment

        # Thresholds & Calibration with Hysteresis
        # Escalation: score >= 0.70 -> HIGH_RISK, score >= 0.50 -> SUSPICIOUS
        # De-escalation: score <= 0.35 -> LOW_RISK / CLEARED (0.15 hysteresis buffer)
        det_cfg = self.config.get("detection_config", {})
        self.escalate_high_threshold = float(det_cfg.get("hold_threshold", 0.70))
        self.escalate_suspicious_threshold = float(det_cfg.get("flag_threshold", 0.50))
        self.deescalate_clear_threshold = float(det_cfg.get("deescalate_threshold", 0.35))

        self.w_fast = float(det_cfg.get("weight_fast_screening", 0.55))
        self.w_dclcg = float(det_cfg.get("weight_dclcg", 0.35))
        self.w_hist = float(det_cfg.get("weight_historical_risk", 0.10))

        # Max queue bounds & concurrency
        self.max_queue_size = int(self.config.get("max_reassessment_queue", 5000))
        self.queue: asyncio.PriorityQueue = asyncio.PriorityQueue(maxsize=self.max_queue_size)
        # Monotonic counter: breaks heap ties so job dicts are never compared
        self._queue_counter: int = 0

        # Deduplication tracker: set of (transaction_id, graph_version)
        self._pending_reassessments: Set[Tuple[str, int]] = set()

        # Telemetry & Operational Metrics
        self.total_events_processed = 0
        self.total_reassessments = 0
        self.total_escalations = 0
        self.total_deescalations = 0
        self.total_retrospective_alerts = 0
        self.total_cleared = 0
        self.total_duplicates_prevented = 0
        self.avg_latency_ms = 0.0
        self.last_latency_ms = 0.0

        self._is_running = False
        self._worker_task: Optional[asyncio.Task] = None

    async def start(self):
        if self._is_running:
            return
        self._is_running = True
        self._worker_task = asyncio.create_task(self._worker_loop())
        logger.info("Continuous Risk Re-evaluation Engine started for sim %d", self.simulation_id)

    async def stop(self):
        self._is_running = False
        if self._worker_task and not self._worker_task.done():
            self._worker_task.cancel()
            try:
                await self._worker_task
            except asyncio.CancelledError:
                pass
        logger.info("Continuous Risk Re-evaluation Engine stopped for sim %d", self.simulation_id)

    # ============================================================
    # 4 REASSESSMENT TRIGGER DISPATCHERS
    # ============================================================

    async def trigger_new_transaction(self, txn: Dict[str, Any], initial_decision: str, risk_score: float, risk_status: str):
        """Trigger 1: New transaction arrived; index it and check for affected historical counterparties."""
        # 1. Index the new transaction
        self.affected_index.index_transaction(
            txn=txn,
            initial_decision=initial_decision,
            risk_score=risk_score,
            risk_status=risk_status,
            assessment_version=1,
        )

        # 2. Persist initial version 1 assessment record to DB
        self._persist_assessment_record({
            "simulation_id": self.simulation_id,
            "transaction_id": txn.get("transaction_id", ""),
            "assessment_version": 1,
            "payment_status": initial_decision,
            "previous_risk_score": None,
            "current_risk_score": float(risk_score),
            "previous_risk_status": None,
            "current_risk_status": risk_status,
            "assessment_type": "INITIAL",
            "triggering_event_id": None,
            "triggering_transaction_id": None,
            "model_version": self.config.get("model_version", "dclcg_prod_e2e"),
            "graph_version": 0,
            "evidence_references": {"signals": txn.get("screening_signals", [])},
            "assessment_reason": f"Initial fast screening decision: {initial_decision}",
            "synthetic_ground_truth": txn.get("synthetic_ground_truth", "legitimate"),
            "processing_latency_ms": txn.get("latency_screening_ms", 0.0),
        })

        # 3. Discover affected historical transactions (multi-hop / sequence)
        sender = txn.get("sender_account")
        receiver = txn.get("receiver_account")
        seq_id = txn.get("sequence_id")
        txn_id = txn.get("transaction_id")

        affected_txns = self.affected_index.find_affected_transactions(
            trigger_type="NEW_TRANSACTION",
            triggering_txn_id=txn_id,
            sender_account=sender,
            receiver_account=receiver,
            sequence_id=seq_id,
            max_hops=2,
            max_affected_txns=20,
            lookback_sec=600.0,
        )

        if affected_txns:
            await self._enqueue_reassessment_job(
                priority=2 if seq_id else 3,  # Priority 2 (HIGH) for sequence, 3 (MEDIUM) for 1-hop
                trigger_type="NEW_TRANSACTION",
                triggering_txn_id=txn_id,
                affected_txns=affected_txns,
                event_reason=f"New counterparty transfer from {sender} to {receiver}",
            )

    async def trigger_graph_pattern(
        self,
        pattern_type: str,
        participating_accounts: List[str],
        graph_version: int,
        motif_metrics: Optional[Dict[str, Any]] = None,
    ):
        """Trigger 2: Newly detected graph motif/pattern (Cycle, Mule Chain, Layered Shell)."""
        affected_txns = self.affected_index.find_affected_transactions(
            trigger_type="NEW_GRAPH_PATTERN",
            participating_accounts=participating_accounts,
            max_hops=2,
            max_affected_txns=50,
            lookback_sec=900.0,
        )

        if affected_txns:
            await self._enqueue_reassessment_job(
                priority=1,  # Priority 1 (CRITICAL)
                trigger_type="NEW_GRAPH_PATTERN",
                triggering_txn_id=None,
                affected_txns=affected_txns,
                event_reason=f"DC-LCG detected suspicious {pattern_type} across {len(participating_accounts)} accounts",
                details={"pattern_type": pattern_type, "motif_metrics": motif_metrics or {}},
            )

    async def trigger_investigation_evidence(
        self,
        account_id: str,
        evidence_type: str,
        verified_clean: bool,
        notes: str,
        investigator_id: Optional[int] = None,
    ):
        """Trigger 3: Verified investigator action / override."""
        affected_txns = self.affected_index.find_affected_transactions(
            trigger_type="INVESTIGATION_EVIDENCE",
            participating_accounts=[account_id],
            max_hops=1,
            max_affected_txns=50,
            lookback_sec=1800.0,
        )

        if affected_txns:
            await self._enqueue_reassessment_job(
                priority=2,  # Priority 2 (HIGH)
                trigger_type="INVESTIGATION_EVIDENCE",
                triggering_txn_id=None,
                affected_txns=affected_txns,
                event_reason=f"Investigator {investigator_id or 'admin'} updated evidence: verified_clean={verified_clean}",
                details={
                    "evidence_type": evidence_type,
                    "verified_clean": verified_clean,
                    "notes": notes,
                    "investigator_id": investigator_id,
                },
            )

    async def trigger_decision_propagation(
        self,
        txn: Dict[str, Any],
        final_decision: str,
        risk_tier: str,
        combined_risk_score: float,
    ):
        """Trigger 5: After a transaction decision, propagate risk state to all connected transactions.

        - If the decided transaction is HIGH/CRITICAL or FLAG/HOLD/REJECT →
          re-evaluate all counterparties; suspicious ones get escalated.
        - If the decided transaction is LOW risk (APPROVE with low score) →
          re-evaluate connected transactions; any previously flagged that now
          look safe get de-escalated.
        """
        sender = txn.get("sender_account", "")
        receiver = txn.get("receiver_account", "")
        txn_id = txn.get("transaction_id", "")
        seq_id = txn.get("sequence_id")

        is_high_risk = risk_tier in ("HIGH", "CRITICAL") or final_decision in ("FLAG", "HOLD", "REJECT")
        is_low_risk = final_decision == "APPROVE" and combined_risk_score <= self.deescalate_clear_threshold

        if not (is_high_risk or is_low_risk):
            return  # Medium risk — no propagation needed

        # Walk 1-hop counterparties (cap at 1 hop to prevent runaway at 900 TPS)
        affected_txns = self.affected_index.find_affected_transactions(
            trigger_type="NEW_TRANSACTION",
            triggering_txn_id=txn_id,
            sender_account=sender,
            receiver_account=receiver,
            sequence_id=seq_id,
            max_hops=1,
            max_affected_txns=30,
            lookback_sec=300.0,
        )

        if not affected_txns:
            return

        if is_high_risk:
            priority = 2  # HIGH priority
            reason = (
                f"Counterparty propagation: {txn_id} ({sender}→{receiver}) "
                f"was {final_decision} [{risk_tier}, score={combined_risk_score:.2f}]"
            )
        else:
            priority = 3  # MEDIUM priority
            reason = (
                f"Clearance propagation: {txn_id} ({sender}→{receiver}) "
                f"cleared (score={combined_risk_score:.2f})"
            )

        await self._enqueue_reassessment_job(
            priority=priority,
            trigger_type="NEW_TRANSACTION",
            triggering_txn_id=txn_id,
            affected_txns=affected_txns,
            event_reason=reason,
            details={
                "propagation_source_txn": txn_id,
                "propagation_type": "HIGH_RISK" if is_high_risk else "CLEARANCE",
                "original_decision": final_decision,
                "original_risk_tier": risk_tier,
                "original_score": combined_risk_score,
            },
        )

    async def trigger_scheduled_sweep(self):
        """Trigger 4: Periodic sweep of unresolved observation states."""
        affected_txns = self.affected_index.find_affected_transactions(
            trigger_type="SCHEDULED",
            max_hops=1,
            max_affected_txns=30,
            lookback_sec=1200.0,
        )

        if affected_txns:
            await self._enqueue_reassessment_job(
                priority=4,  # Priority 4 (LOW)
                trigger_type="SCHEDULED",
                triggering_txn_id=None,
                affected_txns=affected_txns,
                event_reason="Scheduled observation window sweep",
            )

    # ============================================================
    # QUEUE MANAGEMENT & DEDUPLICATION
    # ============================================================

    async def _enqueue_reassessment_job(
        self,
        priority: int,
        trigger_type: str,
        triggering_txn_id: Optional[str],
        affected_txns: List[Dict[str, Any]],
        event_reason: str,
        details: Optional[Dict[str, Any]] = None,
    ):
        """Deduplicate and push affected transactions to prioritized async queue."""
        sender_risk = self.risk_cache.get_account_risk(affected_txns[0]["sender_account"]) if affected_txns else None
        current_g_ver = sender_risk.get("graph_version", 0) if sender_risk else 0
        
        valid_txns: List[Dict[str, Any]] = []
        for meta in affected_txns:
            tid = meta["transaction_id"]
            dedup_key = (tid, current_g_ver)
            if dedup_key in self._pending_reassessments:
                self.total_duplicates_prevented += 1
                continue
            self._pending_reassessments.add(dedup_key)
            valid_txns.append(meta)

        if not valid_txns:
            return

        job = {
            "trigger_type": trigger_type,
            "triggering_txn_id": triggering_txn_id,
            "affected_txns": valid_txns,
            "event_reason": event_reason,
            "details": details or {},
            "enqueued_at": time.perf_counter(),
            "graph_version": current_g_ver,
        }

        try:
            self._queue_counter += 1
            self.queue.put_nowait((priority, self._queue_counter, job))
        except asyncio.QueueFull:
            logger.warning("CRRE queue full in sim %d; dropping low priority batch", self.simulation_id)

    # ============================================================
    # ASYNC WORKER EXECUTION LOOP
    # ============================================================

    async def _worker_loop(self):
        """Continuous micro-batched reassessment worker."""
        while self._is_running:
            try:
                priority, _seq, job = await self.queue.get()
            except asyncio.CancelledError:
                break

            t_start = time.perf_counter()
            try:
                await self._process_reassessment_job(job)

                latency_ms = (time.perf_counter() - t_start) * 1000.0
                self.last_latency_ms = round(latency_ms, 2)
                self.total_reassessments += len(job["affected_txns"])
                self.total_events_processed += 1

                # Rolling average latency
                self.avg_latency_ms = (
                    (self.avg_latency_ms * (self.total_events_processed - 1) + latency_ms)
                    / self.total_events_processed
                )
            except asyncio.CancelledError:
                self.queue.task_done()
                break
            except Exception as e:
                logger.error("Error in CRRE worker loop for sim %d: %s", self.simulation_id, e)
            finally:
                self.queue.task_done()

    async def _process_reassessment_job(self, job: Dict[str, Any]):
        """Execute risk recalculation and state transition policy on a batch of affected transactions."""
        trigger_type = job["trigger_type"]
        triggering_txn_id = job["triggering_txn_id"]
        affected_txns = job["affected_txns"]
        event_reason = job["event_reason"]
        details = job.get("details", {})
        graph_version = job.get("graph_version", 0)

        for meta in affected_txns:
            txn_id = meta["transaction_id"]
            sender = meta["sender_account"]
            receiver = meta["receiver_account"]
            prev_score = float(meta.get("current_risk_score", 0.0))
            prev_status = meta.get("current_risk_status", "LOW_RISK")
            prev_ver = int(meta.get("assessment_version", 1))
            payment_status = meta.get("payment_status", "APPROVED")

            # 1. Retrieve updated DC-LCG graph inference scores from cache
            cached_s = self.risk_cache.get_account_risk(sender)
            cached_r = self.risk_cache.get_account_risk(receiver)
            s_prob = cached_s.get("illicit_prob", 0.0) if cached_s and not cached_s.get("is_stale") else 0.0
            r_prob = cached_r.get("illicit_prob", 0.0) if cached_r and not cached_r.get("is_stale") else 0.0
            dclcg_prob = max(s_prob, r_prob)

            # 2. Re-screen fast signals
            fast_score, fast_signals = self.screening_engine.screen_transaction(
                txn=meta,
                cached_sender_risk=cached_s,
                cached_receiver_risk=cached_r,
            )

            # 3. Synergistic risk calculation
            base_risk = (self.w_fast * fast_score) + (self.w_dclcg * dclcg_prob) + (self.w_hist * 0.0)
            
            # Non-linear boost if high confidence graph structure exists
            max_sig = max(fast_score, dclcg_prob)
            if max_sig >= 0.75:
                combined_score = max(base_risk, 0.85 * max_sig)
            else:
                combined_score = base_risk
            
            combined_score = round(min(1.0, max(0.0, combined_score)), 4)

            # 4. Check for Investigator Verified Override
            is_investigator_override = (trigger_type == "INVESTIGATION_EVIDENCE")
            verified_clean = details.get("verified_clean", False) if is_investigator_override else False

            # 5. Apply Risk State Transition Policies (with Hysteresis)
            new_status = prev_status
            transition_type = "NO_CHANGE"
            reason = event_reason

            if is_investigator_override:
                if verified_clean:
                    new_status = "CLEARED"
                    combined_score = 0.05
                    transition_type = "CLEARED"
                    reason = f"Verified investigator clearance: {details.get('notes', '')}"
                else:
                    new_status = "HIGH_RISK"
                    combined_score = max(combined_score, 0.95)
                    transition_type = "ESCALATED"
                    reason = f"Investigator confirmed illicit transaction: {details.get('notes', '')}"

            elif combined_score >= self.escalate_high_threshold or dclcg_prob >= 0.80:
                # Escalation to HIGH_RISK
                if prev_status != "HIGH_RISK":
                    new_status = "HIGH_RISK"
                    transition_type = "ESCALATED"
                    reason = f"Subsequent graph structure revealed illicit flow (DC-LCG: {dclcg_prob*100:.1f}%)"
            
            elif combined_score >= self.escalate_suspicious_threshold:
                # Escalation to SUSPICIOUS
                if prev_status in ("LOW_RISK", "CLEARED"):
                    new_status = "SUSPICIOUS"
                    transition_type = "ESCALATED"
                    reason = f"Elevated counterparty risk detected (Risk: {combined_score:.2f})"

            elif combined_score <= self.deescalate_clear_threshold and dclcg_prob <= 0.20:
                # Evidence-based De-escalation to LOW_RISK / CLEARED
                # (Requires positive evidence of low graph risk, not mere inactivity)
                if prev_status in ("SUSPICIOUS", "HIGH_RISK", "UNDER_REVIEW", "UNDER_OBSERVATION"):
                    new_status = "LOW_RISK"
                    transition_type = "DEESCALATED"
                    reason = f"Subsequent network topology resolved benign context (DC-LCG: {dclcg_prob*100:.1f}%, Fast: {fast_score:.2f})"

            # 6. Apply state updates if changed
            new_ver = prev_ver + 1 if (new_status != prev_status or abs(combined_score - prev_score) >= 0.05) else prev_ver

            if new_ver > prev_ver:
                self.affected_index.update_assessment(
                    txn_id=txn_id,
                    new_risk_score=combined_score,
                    new_risk_status=new_status,
                    new_version=new_ver,
                    reassessment_reason=reason,
                )

                if transition_type == "ESCALATED":
                    self.total_escalations += 1
                    # Check for Retrospective Alert: Initially APPROVED, subsequently escalated
                    if payment_status in ("APPROVE", "APPROVED") and prev_status in ("LOW_RISK", "UNDER_OBSERVATION") and new_status == "HIGH_RISK":
                        self.total_retrospective_alerts += 1
                        self._emit_retrospective_alert(meta, combined_score, new_status, reason, graph_version)
                
                elif transition_type in ("DEESCALATED", "CLEARED"):
                    self.total_deescalations += 1
                    if new_status == "CLEARED":
                        self.total_cleared += 1

                # Persist versioned risk assessment record
                assessment_rec = {
                    "simulation_id": self.simulation_id,
                    "transaction_id": txn_id,
                    "assessment_version": new_ver,
                    "payment_status": payment_status,
                    "previous_risk_score": prev_score,
                    "current_risk_score": combined_score,
                    "previous_risk_status": prev_status,
                    "current_risk_status": new_status,
                    "assessment_type": "RETROSPECTIVE" if transition_type == "ESCALATED" else ("INVESTIGATION_OVERRIDE" if is_investigator_override else "ASYNC_GRAPH"),
                    "triggering_event_id": None,
                    "triggering_transaction_id": triggering_txn_id,
                    "model_version": cached_s.get("model_version") if cached_s else "dclcg_prod_e2e",
                    "graph_version": graph_version,
                    "evidence_references": {
                        "screening_signals": fast_signals,
                        "dclcg_prob": dclcg_prob,
                        "trigger_type": trigger_type,
                        "transition_type": transition_type,
                    },
                    "assessment_reason": reason,
                    "synthetic_ground_truth": meta.get("synthetic_ground_truth", "legitimate"),
                    "processing_latency_ms": self.last_latency_ms,
                }
                self._persist_assessment_record(assessment_rec)

                # Callback & WebSocket Broadcast
                if self.on_reassessment:
                    self.on_reassessment({
                        "event": "risk_reassessment_completed",
                        "simulation_id": self.simulation_id,
                        "transaction_id": txn_id,
                        "assessment_version": new_ver,
                        "payment_status": payment_status,
                        "previous_risk_status": prev_status,
                        "current_risk_status": new_status,
                        "previous_risk_score": prev_score,
                        "current_risk_score": combined_score,
                        "transition_type": transition_type,
                        "reason": reason,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    })

            # Clear deduplication key
            dedup_key = (txn_id, graph_version)
            self._pending_reassessments.discard(dedup_key)

    def _emit_retrospective_alert(
        self,
        meta: Dict[str, Any],
        risk_score: float,
        risk_status: str,
        reason: str,
        graph_version: int,
    ):
        """Create a retrospective fraud alert associated with the investigation workflow."""
        decision_rec = {
            "simulation_id": self.simulation_id,
            "transaction_id": meta["transaction_id"],
            "sender_account": meta["sender_account"],
            "receiver_account": meta["receiver_account"],
            "amount": meta["amount"],
            "combined_risk_score": risk_score,
            "risk_tier": "CRITICAL" if risk_score >= 0.88 else "HIGH",
            "final_decision": "FLAG",
            "decision_reason": f"[RETROSPECTIVE ALERT] {reason}",
            "model_version": "dclcg_prod_e2e",
            "graph_version": graph_version,
            "synthetic_ground_truth": meta.get("synthetic_ground_truth", "legitimate"),
            "scenario_id": meta.get("scenario_id"),
        }
        self.alert_bridge.create_alert_for_decision(decision_rec)

    def _persist_assessment_record(self, record_dict: Dict[str, Any]):
        """Write immutable versioned assessment row to SQLite/PostgreSQL."""
        if not self.db_session_factory:
            return
        db = None
        try:
            db = self.db_session_factory()
            
            # Set previous current flags to False
            db.query(TransactionRiskAssessment).filter(
                TransactionRiskAssessment.simulation_id == record_dict["simulation_id"],
                TransactionRiskAssessment.transaction_id == record_dict["transaction_id"],
            ).update({"is_current": False})
            
            assessment = TransactionRiskAssessment(
                simulation_id=record_dict["simulation_id"],
                transaction_id=record_dict["transaction_id"],
                assessment_version=record_dict["assessment_version"],
                payment_status=record_dict.get("payment_status", "APPROVED"),
                previous_risk_score=record_dict.get("previous_risk_score"),
                current_risk_score=record_dict.get("current_risk_score", 0.0),
                previous_risk_status=record_dict.get("previous_risk_status"),
                current_risk_status=record_dict.get("current_risk_status", "LOW_RISK"),
                assessment_type=record_dict.get("assessment_type", "INITIAL"),
                triggering_event_id=record_dict.get("triggering_event_id"),
                triggering_transaction_id=record_dict.get("triggering_transaction_id"),
                model_version=record_dict.get("model_version"),
                graph_version=record_dict.get("graph_version"),
                feature_schema_version=record_dict.get("feature_schema_version", "v2.5"),
                evidence_references=record_dict.get("evidence_references", {}),
                assessment_reason=record_dict.get("assessment_reason"),
                synthetic_ground_truth=record_dict.get("synthetic_ground_truth", "legitimate"),
                processing_latency_ms=record_dict.get("processing_latency_ms", 0.0),
                is_current=True,
            )
            db.add(assessment)
            db.commit()
        except Exception as e:
            if db:
                db.rollback()
            logger.error("Failed to persist TransactionRiskAssessment for %s: %s", record_dict.get("transaction_id"), e)
        finally:
            if db:
                db.close()

    def get_telemetry(self) -> Dict[str, Any]:
        """Telemetry snapshot for API and dashboards."""
        return {
            "total_events_processed": self.total_events_processed,
            "total_reassessments": self.total_reassessments,
            "total_escalations": self.total_escalations,
            "total_deescalations": self.total_deescalations,
            "total_retrospective_alerts": self.total_retrospective_alerts,
            "total_cleared": self.total_cleared,
            "total_duplicates_prevented": self.total_duplicates_prevented,
            "queue_backlog": self.queue.qsize(),
            "avg_latency_ms": round(self.avg_latency_ms, 2),
            "last_latency_ms": self.last_latency_ms,
            "is_running": self._is_running,
        }
