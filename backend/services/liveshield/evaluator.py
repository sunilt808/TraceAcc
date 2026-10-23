"""
services/liveshield/evaluator.py — Real-Time Dual Evaluation Engine (Phase 2 & Phase 2.5 Multi-Horizon Reassessment).

Computes:
1. Initial Decision Metrics: TP, FP, TN, FN, Precision, Recall, F1, Accuracy, FPR, FNR at initial transaction ingestion.
2. Retrospective / Post-Reassessment Metrics: Evaluated after continuous graph inference and CRRE updates.
3. Transition Impact Metrics: False Positive Reversals, Late Fraud Discoveries, Incorrect De-escalations, Classification Stability.
4. Network / Sequence-Level Metrics: Sequence Detection Rate, Multi-Hop Sequence TP/FN, Network Precision & Recall.
5. Per-Scenario Matrix Breakdown (F01–F18 Ground Truth Analysis).
6. Monotonic Latency Percentiles (p50, p95, p99).
"""
from __future__ import annotations
import math
import logging
from typing import Dict, Any, List, Optional, Set
import numpy as np

logger = logging.getLogger(__name__)


def _percentile(values: List[float], q: float) -> float:
    if not values:
        return 0.0
    return float(np.percentile(values, q))


class DualEvaluationEngine:
    """
    In-memory streaming and batch evaluator for LiveShield simulations.
    Supports multi-horizon evaluation, initial vs retrospective comparison, and transition metrics.
    """

    def __init__(self, simulation_id: int):
        self.simulation_id = simulation_id
        
        # Total counts
        self.total_transactions: int = 0
        self.total_legitimate: int = 0
        self.total_fraudulent: int = 0
        
        self.approved_count: int = 0
        self.flagged_count: int = 0
        self.held_count: int = 0
        self.rejected_count: int = 0
        
        # Initial decision confusion matrix (strictly immutable once recorded)
        self.initial_tp: int = 0
        self.initial_fp: int = 0
        self.initial_tn: int = 0
        self.initial_fn: int = 0

        # Transaction assessment state map: txn_id -> { ground_truth, is_fraud, initial_positive, current_positive, status }
        self._txn_states: Dict[str, Dict[str, Any]] = {}
        
        # Sequence-level tracking: sequence_id -> { scenario_id, total_steps, detected_steps: int }
        self.sequences: Dict[str, Dict[str, Any]] = {}
        
        # Per-scenario breakdown: scenario_id -> { total, tp, fn, fp, tn, scores: list, latencies: list }
        self.scenario_stats: Dict[str, Dict[str, Any]] = {}
        
        # Latency samples (bounded to last 10,000 for memory safety)
        self.screening_latencies: List[float] = []
        self.model_latencies: List[float] = []
        self.total_latencies: List[float] = []
        self._max_latency_samples = 10000

        # Phase 2.5 Transition counters
        self.false_positive_reversals: int = 0
        self.late_fraud_discoveries: int = 0
        self.incorrect_deescalations: int = 0

    def record_decision(self, decision_record: Dict[str, Any]) -> None:
        """
        Ingest an initial payment decision record and register initial evaluation baseline.
        """
        self.total_transactions += 1
        txn_id = decision_record.get("transaction_id", f"TXN_{self.total_transactions}")
        ground_truth = decision_record.get("synthetic_ground_truth", "legitimate")
        is_fraud = (ground_truth == "fraudulent")
        scenario_id = decision_record.get("scenario_id") or "LEGITIMATE"
        sequence_id = decision_record.get("sequence_id")
        
        decision = decision_record.get("final_decision", "APPROVE")
        hypothetical = decision_record.get("hypothetical_decision", "APPROVE")
        mode = decision_record.get("detection_mode", "shadow")
        
        # Decision distribution counts
        if decision == "APPROVE" or (mode == "shadow" and hypothetical == "APPROVE"):
            self.approved_count += 1
        elif decision == "FLAG" or (mode == "shadow" and hypothetical == "FLAG"):
            self.flagged_count += 1
        elif decision == "HOLD" or (mode == "shadow" and hypothetical == "HOLD"):
            self.held_count += 1
        elif decision in ("REJECT", "MANUAL_REJECT") or (mode == "shadow" and hypothetical == "REJECT"):
            self.rejected_count += 1

        # Positive action definition at ingestion: Flagged, Held, or Rejected
        is_detected = (decision in ("FLAG", "HOLD", "REJECT", "MANUAL_REJECT")) or (
            mode == "shadow" and hypothetical in ("FLAG", "HOLD", "REJECT")
        )

        if is_fraud:
            self.total_fraudulent += 1
            if is_detected:
                self.initial_tp += 1
            else:
                self.initial_fn += 1
        else:
            self.total_legitimate += 1
            if is_detected:
                self.initial_fp += 1
            else:
                self.initial_tn += 1

        # Store in state map for retrospective transition tracking
        self._txn_states[txn_id] = {
            "ground_truth": ground_truth,
            "is_fraud": is_fraud,
            "scenario_id": scenario_id,
            "sequence_id": sequence_id,
            "initial_detected": is_detected,
            "current_detected": is_detected,
            "current_risk_status": "HIGH_RISK" if is_detected else "LOW_RISK",
        }

        # Sequence-level tracking
        if sequence_id:
            if sequence_id not in self.sequences:
                self.sequences[sequence_id] = {
                    "scenario_id": scenario_id,
                    "is_fraud": is_fraud,
                    "total_steps": 0,
                    "detected_steps": 0,
                }
            self.sequences[sequence_id]["total_steps"] += 1
            if is_detected:
                self.sequences[sequence_id]["detected_steps"] += 1

        # Per-scenario breakdown
        if scenario_id not in self.scenario_stats:
            self.scenario_stats[scenario_id] = {
                "total": 0,
                "tp": 0,
                "fn": 0,
                "fp": 0,
                "tn": 0,
                "combined_scores": [],
                "latencies": [],
            }
        
        sc_stat = self.scenario_stats[scenario_id]
        sc_stat["total"] += 1
        if is_fraud:
            if is_detected:
                sc_stat["tp"] += 1
            else:
                sc_stat["fn"] += 1
        else:
            if is_detected:
                sc_stat["fp"] += 1
            else:
                sc_stat["tn"] += 1
        
        combined_risk = decision_record.get("combined_risk_score", 0.0)
        sc_stat["combined_scores"].append(combined_risk)
        if len(sc_stat["combined_scores"]) > 2000:
            sc_stat["combined_scores"] = sc_stat["combined_scores"][-2000:]

        # Latency records
        lat_screen = decision_record.get("latency_screening_ms")
        lat_model = decision_record.get("latency_model_ms")
        lat_total = decision_record.get("latency_total_ms")

        if lat_screen is not None:
            if len(self.screening_latencies) < self._max_latency_samples:
                self.screening_latencies.append(lat_screen)
            else:
                self.screening_latencies[np.random.randint(0, self._max_latency_samples)] = lat_screen

        if lat_model is not None and lat_model > 0.0:
            if len(self.model_latencies) < self._max_latency_samples:
                self.model_latencies.append(lat_model)
            else:
                self.model_latencies[np.random.randint(0, self._max_latency_samples)] = lat_model

        if lat_total is not None:
            if len(self.total_latencies) < self._max_latency_samples:
                self.total_latencies.append(lat_total)
            else:
                self.total_latencies[np.random.randint(0, self._max_latency_samples)] = lat_total
            sc_stat["latencies"].append(lat_total)
            if len(sc_stat["latencies"]) > 2000:
                sc_stat["latencies"] = sc_stat["latencies"][-2000:]

    def record_reassessment(self, reassessment_dict: Dict[str, Any]) -> None:
        """
        Ingest a Continuous Risk Re-evaluation event and update retrospective metrics.
        """
        txn_id = reassessment_dict.get("transaction_id", "")
        if txn_id not in self._txn_states:
            return

        state = self._txn_states[txn_id]
        is_fraud = state["is_fraud"]
        init_det = state["initial_detected"]
        prev_det = state["current_detected"]
        
        new_status = reassessment_dict.get("current_risk_status", "LOW_RISK")
        new_det = new_status in ("HIGH_RISK", "SUSPICIOUS", "UNDER_REVIEW")
        
        state["current_detected"] = new_det
        state["current_risk_status"] = new_status

        # Transition Impact Auditing
        # 1. False Positive Reversal (Initial FP -> Cleared / Low Risk)
        if not is_fraud and init_det and not new_det:
            self.false_positive_reversals += 1

        # 2. Late Fraud Discovery (Initial FN -> Escalated TP)
        elif is_fraud and not init_det and new_det:
            self.late_fraud_discoveries += 1

        # 3. Incorrect De-escalation (Initial TP -> Mistakenly Cleared)
        elif is_fraud and init_det and not new_det:
            self.incorrect_deescalations += 1

        # Update sequence detection step if escalated
        seq_id = state.get("sequence_id")
        if seq_id and seq_id in self.sequences and new_det and not prev_det:
            self.sequences[seq_id]["detected_steps"] += 1

    def get_summary(self) -> Dict[str, Any]:
        """
        Generate a comprehensive evaluation summary comparing initial vs retrospective detection.
        """
        # Compute Retrospective Confusion Matrix from current state
        curr_tp = 0
        curr_fp = 0
        curr_tn = 0
        curr_fn = 0
        unchanged_count = 0

        for state in self._txn_states.values():
            is_fraud = state["is_fraud"]
            is_det = state["current_detected"]
            init_det = state["initial_detected"]

            if is_det == init_det:
                unchanged_count += 1

            if is_fraud:
                if is_det:
                    curr_tp += 1
                else:
                    curr_fn += 1
            else:
                if is_det:
                    curr_fp += 1
                else:
                    curr_tn += 1

        # Fallback to initial if no transactions recorded yet
        tp = curr_tp if self._txn_states else self.initial_tp
        fp = curr_fp if self._txn_states else self.initial_fp
        tn = curr_tn if self._txn_states else self.initial_tn
        fn = curr_fn if self._txn_states else self.initial_fn

        # Initial metrics
        init_prec = self.initial_tp / (self.initial_tp + self.initial_fp) if (self.initial_tp + self.initial_fp) > 0 else 0.0
        init_rec = self.initial_tp / (self.initial_tp + self.initial_fn) if (self.initial_tp + self.initial_fn) > 0 else 0.0
        init_f1 = (2.0 * init_prec * init_rec) / (init_prec + init_rec) if (init_prec + init_rec) > 0 else 0.0
        init_fpr = self.initial_fp / (self.initial_fp + self.initial_tn) if (self.initial_fp + self.initial_tn) > 0 else 0.0

        # Retrospective metrics
        prec = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        rec = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = (2.0 * prec * rec) / (prec + rec) if (prec + rec) > 0 else 0.0
        acc = (tp + tn) / self.total_transactions if self.total_transactions > 0 else 0.0
        fpr = fp / (fp + tn) if (fp + tn) > 0 else 0.0
        fnr = fn / (fn + tp) if (fn + tp) > 0 else 0.0

        stability = (unchanged_count / len(self._txn_states)) if self._txn_states else 1.0

        # Network/Sequence metrics
        fraud_seqs = [s for s in self.sequences.values() if s.get("is_fraud")]
        total_seqs = len(fraud_seqs)
        net_tp = sum(1 for s in fraud_seqs if s.get("detected_steps", 0) > 0)
        net_fn = total_seqs - net_tp
        net_fp = 0
        
        net_prec = net_tp / (net_tp + net_fp) if (net_tp + net_fp) > 0 else 0.0
        net_rec = net_tp / (net_tp + net_fn) if (net_tp + net_fn) > 0 else 0.0
        net_f1 = (2.0 * net_prec * net_rec) / (net_prec + net_rec) if (net_prec + net_rec) > 0 else 0.0

        # Scenario breakdown
        scenario_breakdown = {}
        for sc_id, data in self.scenario_stats.items():
            tot = data["total"]
            s_tp = data["tp"]
            s_fn = data["fn"]
            det_rate = s_tp / (s_tp + s_fn) if (s_tp + s_fn) > 0 else 0.0
            avg_risk = float(np.mean(data["combined_scores"])) if data["combined_scores"] else 0.0
            avg_lat = float(np.mean(data["latencies"])) if data["latencies"] else 0.0
            scenario_breakdown[sc_id] = {
                "total": tot,
                "tp": s_tp,
                "fn": s_fn,
                "fp": data["fp"],
                "tn": data["tn"],
                "detection_rate": round(det_rate, 4),
                "avg_risk_score": round(avg_risk, 4),
                "avg_latency_ms": round(avg_lat, 2),
            }

        return {
            "simulation_id": self.simulation_id,
            "total_transactions": self.total_transactions,
            "total_legitimate": self.total_legitimate,
            "total_fraudulent": self.total_fraudulent,
            "approved_count": self.approved_count,
            "flagged_count": self.flagged_count,
            "held_count": self.held_count,
            "rejected_count": self.rejected_count,
            # Current / Retrospective Confusion Matrix
            "true_positives": tp,
            "true_negatives": tn,
            "false_positives": fp,
            "false_negatives": fn,
            "precision": round(prec, 4),
            "recall": round(rec, 4),
            "f1_score": round(f1, 4),
            "accuracy": round(acc, 4),
            "false_positive_rate": round(fpr, 4),
            "false_negative_rate": round(fnr, 4),
            # Initial Baseline Metrics (Before Reassessment)
            "initial_metrics": {
                "true_positives": self.initial_tp,
                "false_positives": self.initial_fp,
                "true_negatives": self.initial_tn,
                "false_negatives": self.initial_fn,
                "precision": round(init_prec, 4),
                "recall": round(init_rec, 4),
                "f1_score": round(init_f1, 4),
                "false_positive_rate": round(init_fpr, 4),
            },
            # Reassessment Impact & Evolution
            "reassessment_impact": {
                "false_positive_reversals": self.false_positive_reversals,
                "late_fraud_discoveries": self.late_fraud_discoveries,
                "incorrect_deescalations": self.incorrect_deescalations,
                "classification_stability": round(stability, 4),
            },
            # Network Metrics
            "total_sequences": total_seqs,
            "network_true_positives": net_tp,
            "network_false_positives": net_fp,
            "network_false_negatives": net_fn,
            "network_precision": round(net_prec, 4),
            "network_recall": round(net_rec, 4),
            "network_f1": round(net_f1, 4),
            # Latency Percentiles
            "latency_screening_p50": round(_percentile(self.screening_latencies, 50), 2),
            "latency_screening_p95": round(_percentile(self.screening_latencies, 95), 2),
            "latency_screening_p99": round(_percentile(self.screening_latencies, 99), 2),
            "latency_model_p50": round(_percentile(self.model_latencies, 50), 2),
            "latency_model_p95": round(_percentile(self.model_latencies, 95), 2),
            "latency_model_p99": round(_percentile(self.model_latencies, 99), 2),
            "latency_total_p50": round(_percentile(self.total_latencies, 50), 2),
            "latency_total_p95": round(_percentile(self.total_latencies, 95), 2),
            "latency_total_p99": round(_percentile(self.total_latencies, 99), 2),
            "scenario_metrics": scenario_breakdown,
        }
