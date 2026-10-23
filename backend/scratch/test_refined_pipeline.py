import sys
from pathlib import Path
backend_path = Path(r"c:\traceacc\TraceAcc1\backend")
sys.path.insert(0, str(backend_path))

import random
from datetime import datetime, timezone
from decimal import Decimal
import numpy as np
import os

from services.liveshield.accounts import AccountPopulation
from services.liveshield.legitimate import LegitimateTransactionGenerator
from services.liveshield.registry import scenario_registry
from utils.graph import TransactionGraph
from detectors.dclcg.inference import load_artifact, predict_graph
from detectors.dclcg.train import ARTIFACT_DIR

# Let's test refined screening and decision engine
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any, Tuple

@dataclass
class RefinedScreeningSignal:
    rule_id: str
    rule_name: str
    severity: float
    reason: str
    metadata: Dict[str, Any] = field(default_factory=dict)

class RefinedAccountRollingStats:
    def __init__(self, account_id: str):
        self.account_id = account_id
        self.history: List[Tuple[float, float, str, str, str]] = []  # (epoch, amt, dir, cp, txn_type)
        self.consumed_inflow_epochs = set()
        self.last_activity_time: Optional[float] = None
        self.known_counterparties = set()
        self.total_sent_volume: float = 0.0
        self.total_received_volume: float = 0.0
        self.total_txn_count: int = 0

    def record_transaction(self, epoch_sec: float, amount: float, direction: str, counterparty: str, txn_type: str):
        self.history.append((epoch_sec, amount, direction, counterparty, txn_type))
        self.last_activity_time = epoch_sec
        self.known_counterparties.add(counterparty)
        self.total_txn_count += 1
        if direction == "OUT":
            self.total_sent_volume += amount
        else:
            self.total_received_volume += amount
            
        cutoff = epoch_sec - 86400.0
        while self.history and self.history[0][0] < cutoff:
            popped = self.history.pop(0)
            self.consumed_inflow_epochs.discard(popped[0])

    def get_velocity_stats(self, current_epoch: float) -> Dict[str, Any]:
        c_1m = sum(1 for t, _, _, _, _ in self.history if t >= current_epoch - 60.0)
        c_5m = sum(1 for t, _, _, _, _ in self.history if t >= current_epoch - 300.0)
        v_1m = sum(a for t, a, _, _, _ in self.history if t >= current_epoch - 60.0)
        v_5m = sum(a for t, a, _, _, _ in self.history if t >= current_epoch - 300.0)
        
        recent_inflows = [
            (t, a, cp, tt) for t, a, d, cp, tt in self.history
            if d == "IN" and t >= current_epoch - 180.0 and t not in self.consumed_inflow_epochs
        ]
        return {
            "count_1m": c_1m,
            "count_5m": c_5m,
            "volume_1m": v_1m,
            "volume_5m": v_5m,
            "recent_inflows": recent_inflows,
        }

class RefinedFastScreeningEngine:
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        self.account_stats: Dict[str, RefinedAccountRollingStats] = {}
        self.ctr_lower = float(self.config.get("ctr_lower_bound", 8000.0))
        self.ctr_upper = float(self.config.get("ctr_upper_bound", 9999.0))
        self.velocity_1m_limit = int(self.config.get("velocity_1m_limit", 25))
        self.velocity_5m_limit = int(self.config.get("velocity_5m_limit", 60))
        self.passthrough_window_sec = float(self.config.get("passthrough_window_sec", 120.0))
        self.high_amount_threshold = float(self.config.get("high_amount_threshold", 30000.0))

    def _get_or_create_stats(self, account_id: str) -> RefinedAccountRollingStats:
        if account_id not in self.account_stats:
            self.account_stats[account_id] = RefinedAccountRollingStats(account_id)
        return self.account_stats[account_id]

    def screen_transaction(
        self,
        txn: Dict[str, Any],
        cached_sender_risk: Optional[Dict[str, Any]] = None,
        cached_receiver_risk: Optional[Dict[str, Any]] = None,
    ) -> Tuple[float, List[Dict[str, Any]]]:
        sender_id = txn["sender_account"]
        receiver_id = txn["receiver_account"]
        amount = float(txn["amount"])
        txn_type = str(txn.get("transaction_type", "P2P")).upper()
        
        ts = txn.get("timestamp")
        if isinstance(ts, datetime):
            epoch_sec = ts.timestamp()
        else:
            epoch_sec = time.time()

        s_stats = self._get_or_create_stats(sender_id)
        r_stats = self._get_or_create_stats(receiver_id)
        v_stats = s_stats.get_velocity_stats(epoch_sec)
        signals: List[RefinedScreeningSignal] = []

        # R01: CTR Smurfing & Structuring
        # If in structuring band ($8k-$9.99k)
        if self.ctr_lower <= amount <= self.ctr_upper:
            # Check if sender has multiple structuring band transactions recently
            recent_struct_txns = sum(
                1 for t, a, d, _, _ in s_stats.history
                if d == "OUT" and self.ctr_lower <= a <= self.ctr_upper and t >= epoch_sec - 3600.0
            )
            if recent_struct_txns >= 1 or txn_type in ("SMURFING", "STRUCTURING", "CASH_DEPOSIT", "P2P"):
                sev = 0.85 if recent_struct_txns >= 1 else 0.45
                signals.append(RefinedScreeningSignal(
                    rule_id="R01_CTR_STRUCTURING",
                    rule_name="Currency Transaction Structuring Threshold",
                    severity=sev,
                    reason=f"Transaction amount ${amount:,.2f} near $10k threshold with structuring indicators",
                    metadata={"amount": amount, "repeat_count": recent_struct_txns + 1}
                ))

        # R02: Velocity Spike Anomaly
        if v_stats["count_1m"] >= self.velocity_1m_limit:
            signals.append(RefinedScreeningSignal(
                rule_id="R02_VELOCITY_SPIKE",
                rule_name="Extreme Transaction Velocity Spike",
                severity=0.70,
                reason=f"Account initiated {v_stats['count_1m']} transactions in 60s (limit: {self.velocity_1m_limit})",
                metadata={"txns_1m": v_stats["count_1m"]}
            ))
        elif v_stats["count_5m"] >= self.velocity_5m_limit:
            signals.append(RefinedScreeningSignal(
                rule_id="R02_VELOCITY_SPIKE",
                rule_name="Elevated Transaction Velocity",
                severity=0.55,
                reason=f"Account initiated {v_stats['count_5m']} transactions in 5m (limit: {self.velocity_5m_limit})",
                metadata={"txns_5m": v_stats["count_5m"]}
            ))

        # R03: Rapid Mule Pass-Through Flow
        # Require substantial amount (e.g. >= $500) and tight ratio [0.85, 1.02]
        if v_stats["recent_inflows"] and amount >= 500.0:
            for in_t, in_amt, in_cp, in_tt in v_stats["recent_inflows"]:
                time_delta = epoch_sec - in_t
                if time_delta <= self.passthrough_window_sec and (0.85 * in_amt <= amount <= 1.02 * in_amt) and in_amt >= 500.0:
                    s_stats.consumed_inflow_epochs.add(in_t)
                    signals.append(RefinedScreeningSignal(
                        rule_id="R03_RAPID_PASSTHROUGH",
                        rule_name="Rapid Mule Pass-Through Flow",
                        severity=0.85,
                        reason=f"Evacuating ${amount:,.2f} within {int(time_delta)}s of receiving ${in_amt:,.2f} from {in_cp}",
                        metadata={"inflow_amount": in_amt, "outflow_amount": amount, "delay_seconds": int(time_delta)}
                    ))
                    break

        # R04: Dormant Account Sudden Reactivation
        if s_stats.last_activity_time is not None:
            gap_days = (epoch_sec - s_stats.last_activity_time) / 86400.0
            if gap_days >= 30.0 and amount >= 5000.0:
                signals.append(RefinedScreeningSignal(
                    rule_id="R04_DORMANT_AWAKENING",
                    rule_name="Dormant Account Surge",
                    severity=0.75,
                    reason=f"Account inactive for {int(gap_days)} days suddenly initiated a ${amount:,.2f} transfer",
                    metadata={"dormant_days": int(gap_days), "amount": amount}
                ))

        # R05: High-Value Anomaly
        if amount >= self.high_amount_threshold:
            signals.append(RefinedScreeningSignal(
                rule_id="R05_HIGH_VALUE",
                rule_name="High-Value Outlier Transfer",
                severity=0.25,
                reason=f"High single transfer volume: ${amount:,.2f}",
                metadata={"amount": amount}
            ))

        # R06: Duplicate Request Spike
        recent_matches = [
            t for t, a, d, cp, _ in s_stats.history
            if d == "OUT" and cp == receiver_id and abs(a - amount) < 0.01 and t >= epoch_sec - 10.0
        ]
        if len(recent_matches) >= 2:
            signals.append(RefinedScreeningSignal(
                rule_id="R06_DUPLICATE_REPLAY",
                rule_name="Duplicate Transaction Replay Pattern",
                severity=0.70,
                reason=f"Repeated identical payment of ${amount:,.2f} to {receiver_id} within 10 seconds",
                metadata={"duplicate_count": len(recent_matches) + 1}
            ))

        # R07: High-Risk DC-LCG Network Suspect
        if cached_sender_risk and cached_sender_risk.get("illicit_prob", 0.0) >= 0.75:
            prob = cached_sender_risk["illicit_prob"]
            signals.append(RefinedScreeningSignal(
                rule_id="R07_DC_LCG_NETWORK_SUSPECT",
                rule_name="Sender Flagged in High-Risk Graph Topology",
                severity=prob * 0.70,  # Scaled severity to prevent solo false-positive escalation
                reason=f"Sender account in high-risk graph topology ({prob*100:.1f}%)",
                metadata={"dclcg_prob": prob}
            ))

        # Record state
        s_stats.record_transaction(epoch_sec, amount, "OUT", receiver_id, txn_type)
        r_stats.record_transaction(epoch_sec, amount, "IN", sender_id, txn_type)

        if not signals:
            screening_score = 0.05
        else:
            max_sev = max(s.severity for s in signals)
            mean_sev = sum(s.severity for s in signals) / len(signals)
            # Calibrated blend
            screening_score = (max_sev * 0.70) + (mean_sev * 0.30)
            screening_score = max(0.05, min(0.98, screening_score))

        signal_dicts = [
            {
                "rule_id": s.rule_id,
                "rule_name": s.rule_name,
                "severity": round(s.severity, 2),
                "reason": s.reason,
                "metadata": s.metadata,
            }
            for s in signals
        ]
        return round(screening_score, 4), signal_dicts

def test_refined_pipeline():
    from services.liveshield.evaluator import DualEvaluationEngine
    from services.liveshield.decision_engine import DecisionEngine
    from scratch.ablation_experiments import generate_deterministic_dataset
    
    txns, pop = generate_deterministic_dataset(seed=42, total_txns=1000, fraud_pct=20.0, num_accounts=60)
    
    screening = RefinedFastScreeningEngine()
    
    # Decision Engine with calibrated weights and thresholds
    cfg = {
        "weight_fast": 0.50,
        "weight_dclcg": 0.40,
        "weight_hist": 0.10,
        "flag_threshold": 0.50,
        "hold_threshold": 0.70,
        "reject_threshold": 0.88,
    }
    decision_engine = DecisionEngine(detection_mode="shadow", config=cfg)
    evaluator = DualEvaluationEngine(simulation_id=1)
    
    rule_counts = {}
    fp_rule_counts = {}
    
    for txn in txns:
        fast_score, fast_signals = screening.screen_transaction(txn)
        decision_rec = decision_engine.evaluate_decision(
            transaction=txn,
            screening_result={"fast_score": fast_score, "signals": fast_signals},
            dclcg_score=None,
            cached_sender_risk=0.0,
            cached_receiver_risk=0.0,
        )
        evaluator.record_decision(decision_rec)
        
        for s in fast_signals:
            rid = s["rule_id"]
            rule_counts[rid] = rule_counts.get(rid, 0) + 1
            if txn["synthetic_ground_truth"] == "legitimate":
                fp_rule_counts[rid] = fp_rule_counts.get(rid, 0) + 1
                
    summary = evaluator.get_summary()
    print("=== REFINED FAST SCREENING RESULTS ===")
    print(f"TP: {summary['true_positives']} | FP: {summary['false_positives']} | TN: {summary['true_negatives']} | FN: {summary['false_negatives']}")
    print(f"Precision: {summary['precision']*100:.2f}% | Recall: {summary['recall']*100:.2f}% | FPR: {summary['false_positive_rate']*100:.2f}% | F1: {summary['f1_score']*100:.2f}%")
    print("\nRule trigger counts total:", rule_counts)
    print("Rule trigger counts on legitimate (FP):", fp_rule_counts)

if __name__ == "__main__":
    test_refined_pipeline()
