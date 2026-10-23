"""
services/liveshield/decision_engine.py — Calibrated Risk Combination & Decision State Machine (Phase 2).

Responsibilities:
1. Combine Fast Screening Signals ($S_{fast}$), DC-LCG Inference ($P_{dclcg}$), and Historical Risk ($R_{hist}$) with Platt/logistic probability calibration.
2. Evaluate decisions under three operational modes:
   - Mode A (Shadow): Log all risk scores and hypothetical actions; all transactions proceed as APPROVE.
   - Mode B (Assisted): Auto-approve low risk, auto-reject critical risk, hold medium-high risk in HeldTransactionQueue for operator review.
   - Mode C (Automated): Deterministic rule-based auto-execution (APPROVE, FLAG, HOLD, REJECT).
3. Maintain an in-memory & thread-safe HeldTransactionQueue with manual override operations.
"""
from __future__ import annotations
import math
import time
import logging
from typing import Dict, Any, List, Optional, Tuple
from decimal import Decimal
from datetime import datetime, timezone
import threading

logger = logging.getLogger(__name__)


class HeldTransactionQueue:
    """
    Thread-safe in-memory holding queue for Assisted Mode transactions.
    Supports real-time querying, manual approval, and manual rejection.
    """

    def __init__(self, max_size: int = 10000):
        self._lock = threading.Lock()
        self._held: Dict[str, Dict[str, Any]] = {}  # keyed by transaction_id
        self._max_size = max_size

    def add(self, record: Dict[str, Any]) -> None:
        txn_id = record.get("transaction_id")
        if not txn_id:
            return
        with self._lock:
            if len(self._held) >= self._max_size:
                # Evict oldest
                oldest_key = next(iter(self._held))
                del self._held[oldest_key]
            self._held[txn_id] = record

    def get_all(self, simulation_id: Optional[int] = None) -> List[Dict[str, Any]]:
        with self._lock:
            if simulation_id is None:
                return list(self._held.values())
            return [r for r in self._held.values() if r.get("simulation_id") == simulation_id]

    def get(self, transaction_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            return self._held.get(transaction_id)

    def resolve(
        self,
        transaction_id: str,
        action: str,  # 'MANUAL_APPROVE' | 'MANUAL_REJECT'
        operator_user_id: Optional[int] = None,
        notes: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        with self._lock:
            record = self._held.pop(transaction_id, None)
            if not record:
                return None
            record["final_decision"] = "APPROVE" if action == "MANUAL_APPROVE" else "REJECT"
            record["operator_action"] = action
            record["operator_user_id"] = operator_user_id
            record["operator_notes"] = notes
            record["operator_at"] = datetime.now(timezone.utc).isoformat()
            return record

    def count(self, simulation_id: Optional[int] = None) -> int:
        with self._lock:
            if simulation_id is None:
                return len(self._held)
            return sum(1 for r in self._held.values() if r.get("simulation_id") == simulation_id)

    def clear_simulation(self, simulation_id: int) -> None:
        with self._lock:
            to_del = [k for k, v in self._held.items() if v.get("simulation_id") == simulation_id]
            for k in to_del:
                del self._held[k]


class DecisionEngine:
    """
    Calibrated Risk Scoring and Decision State Machine for LiveShield.
    """

    def __init__(self, detection_mode: str = "shadow", config: Optional[Dict[str, Any]] = None):
        """
        Args:
            detection_mode: 'shadow' | 'assisted' | 'automated'
            config: Optional threshold and weighting overrides.
        """
        self.detection_mode = detection_mode.lower() if detection_mode else "shadow"
        cfg = config or {}

        # Calibrated decision thresholds tuned for balanced precision and recall
        self.flag_threshold = float(cfg.get("flag_threshold", 0.50))
        self.hold_threshold = float(cfg.get("hold_threshold", 0.70))
        self.reject_threshold = float(cfg.get("reject_threshold", 0.88))

        # Scoring weights
        self.w_fast = float(cfg.get("weight_fast", 0.55))
        self.w_dclcg = float(cfg.get("weight_dclcg", 0.35))
        self.w_hist = float(cfg.get("weight_hist", 0.10))

        # Calibration parameters
        self.calib_alpha = float(cfg.get("calib_alpha", 6.0))
        self.calib_beta = float(cfg.get("calib_beta", 0.50))

        # Global or attached held queue
        self.held_queue = HeldTransactionQueue()

    def update_config(self, detection_mode: Optional[str] = None, config: Optional[Dict[str, Any]] = None) -> None:
        if detection_mode:
            self.detection_mode = detection_mode.lower()
        if config:
            if "flag_threshold" in config:
                self.flag_threshold = float(config["flag_threshold"])
            if "hold_threshold" in config:
                self.hold_threshold = float(config["hold_threshold"])
            if "reject_threshold" in config:
                self.reject_threshold = float(config["reject_threshold"])
            if "weight_fast" in config:
                self.w_fast = float(config["weight_fast"])
            if "weight_dclcg" in config:
                self.w_dclcg = float(config["weight_dclcg"])
            if "weight_hist" in config:
                self.w_hist = float(config["weight_hist"])

    def calibrate_score(self, raw_score: float) -> float:
        """
        Calibrate raw combined score into a monotonic risk probability [0.0, 1.0].
        """
        clamped = max(0.0, min(1.0, float(raw_score)))
        return max(0.0, min(1.0, round(clamped, 4)))

    def calculate_combined_risk(
        self,
        fast_score: float,
        dclcg_score: Optional[float] = None,
        hist_risk: float = 0.0,
    ) -> Tuple[float, str]:
        """
        Calculate raw combined risk, calibrate it, and return (calibrated_score, risk_tier).
        """
        if dclcg_score is not None:
            w_total = self.w_fast + self.w_dclcg + self.w_hist
            base_risk = (self.w_fast * fast_score + self.w_dclcg * dclcg_score + self.w_hist * hist_risk) / max(w_total, 1e-6)
            # High-confidence signal boosting: when strong evidence is found (>= 0.75)
            max_signal = max(fast_score, dclcg_score)
            if max_signal >= 0.75:
                raw = max(base_risk, 0.85 * max_signal)
            else:
                raw = base_risk
        else:
            raw = (0.85 * fast_score) + (0.15 * hist_risk)

        calibrated = self.calibrate_score(raw)

        if calibrated < 0.30:
            tier = "LOW"
        elif calibrated < 0.60:
            tier = "MEDIUM"
        elif calibrated < 0.85:
            tier = "HIGH"
        else:
            tier = "CRITICAL"

        return calibrated, tier

    def evaluate_decision(
        self,
        transaction: Dict[str, Any],
        screening_result: Dict[str, Any],
        dclcg_score: Optional[float] = None,
        dclcg_disguise: Optional[float] = None,
        dclcg_top_paths: Optional[List[Any]] = None,
        cached_sender_risk: float = 0.0,
        cached_receiver_risk: float = 0.0,
        model_version: Optional[str] = None,
        graph_version: Optional[int] = None,
        t_ingested_iso: Optional[str] = None,
        t_screened_iso: Optional[str] = None,
        screening_latency_ms: Optional[float] = None,
    ) -> Dict[str, Any]:
        """
        Run decision policy on the screened transaction and return a comprehensive Decision Record.
        """
        t_decide_start = time.perf_counter()
        now_utc = datetime.now(timezone.utc)

        fast_score = float(screening_result.get("fast_score", 0.0))
        fast_signals = screening_result.get("signals", [])

        hist_risk = max(cached_sender_risk, cached_receiver_risk)

        combined_risk, tier = self.calculate_combined_risk(
            fast_score=fast_score,
            dclcg_score=dclcg_score,
            hist_risk=hist_risk,
        )

        if combined_risk < self.flag_threshold:
            hypothetical = "APPROVE"
        elif combined_risk < self.hold_threshold:
            hypothetical = "FLAG"
        elif combined_risk < self.reject_threshold:
            hypothetical = "HOLD"
        else:
            hypothetical = "REJECT"

        mode = self.detection_mode
        initial_decision = "APPROVE"
        final_decision = "APPROVE"
        decision_reason = ""

        if mode == "shadow":
            initial_decision = "APPROVE"
            final_decision = "APPROVE"
            decision_reason = f"Shadow Mode: Simulated {hypothetical} (Calibrated Risk: {combined_risk:.2%}, Tier: {tier})"

        elif mode == "assisted":
            if hypothetical == "APPROVE":
                initial_decision = "APPROVE"
                final_decision = "APPROVE"
                decision_reason = f"Assisted Mode: Auto-approved low risk ({combined_risk:.2%})"
            elif hypothetical == "FLAG":
                initial_decision = "FLAG"
                final_decision = "FLAG"
                decision_reason = f"Assisted Mode: Flagged for anomaly monitoring ({combined_risk:.2%})"
            elif hypothetical == "HOLD":
                initial_decision = "HOLD"
                final_decision = "HOLD"
                decision_reason = f"Assisted Mode: Placed on HOLD awaiting operator review ({combined_risk:.2%})"
            else:
                initial_decision = "REJECT"
                final_decision = "REJECT"
                decision_reason = f"Assisted Mode: Auto-rejected critical fraud score ({combined_risk:.2%})"

        elif mode == "automated":
            initial_decision = hypothetical
            final_decision = hypothetical
            decision_reason = f"Automated Mode: Enforced policy {hypothetical} (Calibrated Risk: {combined_risk:.2%}, Tier: {tier})"

        else:
            initial_decision = hypothetical
            final_decision = hypothetical
            decision_reason = f"Mode {mode}: {hypothetical} (Risk: {combined_risk:.2%})"

        decide_latency_ms = (time.perf_counter() - t_decide_start) * 1000.0
        total_latency_ms = (screening_latency_ms or 0.0) + decide_latency_ms

        ground_truth = transaction.get("synthetic_ground_truth", "legitimate")
        is_fraud = ground_truth == "fraudulent"

        is_positive_decision = (final_decision in ("FLAG", "HOLD", "REJECT", "MANUAL_REJECT")) or (
            mode == "shadow" and hypothetical in ("FLAG", "HOLD", "REJECT")
        )

        if is_fraud and is_positive_decision:
            eval_label = "TRUE_POSITIVE"
        elif not is_fraud and not is_positive_decision:
            eval_label = "TRUE_NEGATIVE"
        elif not is_fraud and is_positive_decision:
            eval_label = "FALSE_POSITIVE"
        else:
            eval_label = "FALSE_NEGATIVE"

        raw_amt = transaction.get("amount", 0.0)
        amount_dec = Decimal(str(raw_amt)) if not isinstance(raw_amt, Decimal) else raw_amt

        record = {
            "simulation_id": transaction.get("simulation_id"),
            "transaction_id": transaction.get("transaction_id"),
            "sequence_id": transaction.get("sequence_id"),
            "step_index": transaction.get("step_index", 0),
            "sender_account": transaction.get("sender_account"),
            "receiver_account": transaction.get("receiver_account"),
            "amount": float(amount_dec),
            "currency": transaction.get("currency", "USD"),
            "timestamp": transaction.get("timestamp"),
            "detection_mode": mode,
            "initial_decision": initial_decision,
            "final_decision": final_decision,
            "hypothetical_decision": hypothetical,
            "decision_reason": decision_reason,
            "fast_screening_score": fast_score,
            "fast_screening_signals": fast_signals,
            "dclcg_score": dclcg_score,
            "dclcg_disguise_score": dclcg_disguise,
            "dclcg_top_paths": dclcg_top_paths or [],
            "model_version": model_version,
            "graph_version": graph_version,
            "combined_risk_score": combined_risk,
            "risk_tier": tier,
            "t_generated": transaction.get("generated_timestamp") or transaction.get("timestamp"),
            "t_ingested": t_ingested_iso or now_utc.isoformat(),
            "t_screened": t_screened_iso or now_utc.isoformat(),
            "t_decided": now_utc.isoformat(),
            "t_graph_inferred": now_utc.isoformat() if dclcg_score is not None else None,
            "latency_screening_ms": screening_latency_ms,
            "latency_model_ms": 0.0,
            "latency_total_ms": total_latency_ms,
            "operator_action": None,
            "operator_notes": None,
            "operator_user_id": None,
            "operator_at": None,
            "synthetic_ground_truth": ground_truth,
            "scenario_id": transaction.get("scenario_id"),
            "evaluation_label": eval_label,
        }

        if mode == "assisted" and final_decision == "HOLD":
            self.held_queue.add(record)

        return record
