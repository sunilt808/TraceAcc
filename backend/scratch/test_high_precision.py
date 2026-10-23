import sys
from pathlib import Path
backend_path = Path(r"c:\traceacc\TraceAcc1\backend")
sys.path.insert(0, str(backend_path))

import random
from datetime import datetime, timezone
from decimal import Decimal
import numpy as np

from services.liveshield.accounts import AccountPopulation
from services.liveshield.legitimate import LegitimateTransactionGenerator
from services.liveshield.registry import scenario_registry
from services.liveshield.evaluator import DualEvaluationEngine
from services.liveshield.decision_engine import DecisionEngine

class PrecisionAccountRollingStats:
    def __init__(self, account_id: str):
        self.account_id = account_id
        # (epoch_sec, amount, direction, counterparty, txn_type)
        self.history = []
        self.consumed_inflow_epochs = set()
        self.last_activity_time = None
        self.known_counterparties = set()
        self.total_sent_volume = 0.0
        self.total_received_volume = 0.0
        self.total_txn_count = 0

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

    def get_precision_stats(self, current_epoch: float):
        out_10s = [(t, a, cp) for t, a, d, cp, _ in self.history if d == "OUT" and t >= current_epoch - 10.0]
        out_1m = [(t, a, cp) for t, a, d, cp, _ in self.history if d == "OUT" and t >= current_epoch - 60.0]
        
        recent_inflows = [
            (t, a, cp, tt) for t, a, d, cp, tt in self.history
            if d == "IN" and t >= current_epoch - 180.0 and a >= 1000.0 and t not in self.consumed_inflow_epochs
        ]
        return {
            "out_count_10s": len(out_10s),
            "out_vol_10s": sum(a for _, a, _ in out_10s),
            "distinct_cp_10s": len(set(cp for _, _, cp in out_10s)),
            "out_count_1m": len(out_1m),
            "out_vol_1m": sum(a for _, a, _ in out_1m),
            "distinct_cp_1m": len(set(cp for _, _, cp in out_1m)),
            "recent_inflows": recent_inflows,
        }

class PrecisionFastScreeningEngine:
    def __init__(self, config=None):
        self.config = config or {}
        self.account_stats = {}
        self.ctr_lower = float(self.config.get("ctr_lower_bound", 8000.0))
        self.ctr_upper = float(self.config.get("ctr_upper_bound", 9999.0))
        self.passthrough_window_sec = float(self.config.get("passthrough_window_sec", 120.0))
        self.high_amount_threshold = float(self.config.get("high_amount_threshold", 35000.0))

    def _get_or_create_stats(self, account_id: str):
        if account_id not in self.account_stats:
            self.account_stats[account_id] = PrecisionAccountRollingStats(account_id)
        return self.account_stats[account_id]

    def screen_transaction(self, txn, cached_sender_risk=None, cached_receiver_risk=None):
        sender_id = txn["sender_account"]
        receiver_id = txn["receiver_account"]
        amount = float(txn["amount"])
        txn_type = str(txn.get("transaction_type", "P2P")).upper()
        
        ts = txn.get("timestamp")
        epoch_sec = ts.timestamp() if isinstance(ts, datetime) else 0.0

        s_stats = self._get_or_create_stats(sender_id)
        r_stats = self._get_or_create_stats(receiver_id)
        p_stats = s_stats.get_precision_stats(epoch_sec)
        signals = []

        # R01: CTR Structuring & Smurfing
        if self.ctr_lower <= amount <= self.ctr_upper:
            recent_struct_txns = sum(
                1 for t, a, d, _, _ in s_stats.history
                if d == "OUT" and self.ctr_lower <= a <= self.ctr_upper and t >= epoch_sec - 3600.0
            )
            if recent_struct_txns >= 1 or txn_type in ("SMURFING", "STRUCTURING", "CASH_DEPOSIT"):
                signals.append({
                    "rule_id": "R01_CTR_STRUCTURING",
                    "rule_name": "Currency Transaction Structuring Threshold",
                    "severity": 0.90 if recent_struct_txns >= 1 else 0.75,
                    "reason": f"Repeated sub-threshold structuring (${amount:,.2f})",
                    "metadata": {"amount": amount, "repeat_count": recent_struct_txns + 1}
                })

        # R02: High-Precision Velocity Spike (Multi-counterparty rapid burst or sudden high-volume drain)
        if p_stats["out_count_10s"] >= 3 and p_stats["distinct_cp_10s"] >= 3:
            signals.append({
                "rule_id": "R02_VELOCITY_SPIKE",
                "rule_name": "Rapid Fan-Out Burst Anomaly",
                "severity": 0.85,
                "reason": f"Account fanned out {p_stats['out_count_10s']} transfers to distinct recipients in 10s",
                "metadata": {"count_10s": p_stats["out_count_10s"], "recipients": p_stats["distinct_cp_10s"]}
            })
        elif p_stats["out_count_1m"] >= 4 and p_stats["out_vol_1m"] >= 20000.0:
            signals.append({
                "rule_id": "R02_VELOCITY_SPIKE",
                "rule_name": "High-Volume Velocity Burst",
                "severity": 0.80,
                "reason": f"Account evacuated ${p_stats['out_vol_1m']:,.2f} across {p_stats['out_count_1m']} transactions in 60s",
                "metadata": {"count_1m": p_stats["out_count_1m"], "volume_1m": p_stats["out_vol_1m"]}
            })

        # R03: Rapid Pass-Through Velocity (Mule account drain)
        if p_stats["recent_inflows"] and amount >= 1000.0:
            for in_t, in_amt, in_cp, in_tt in p_stats["recent_inflows"]:
                time_delta = epoch_sec - in_t
                if time_delta <= self.passthrough_window_sec and (0.88 * in_amt <= amount <= 1.02 * in_amt):
                    s_stats.consumed_inflow_epochs.add(in_t)
                    signals.append({
                        "rule_id": "R03_RAPID_PASSTHROUGH",
                        "rule_name": "Rapid Mule Pass-Through Flow",
                        "severity": 0.90,
                        "reason": f"Evacuating ${amount:,.2f} within {int(time_delta)}s of receiving ${in_amt:,.2f} from {in_cp}",
                        "metadata": {"inflow_amount": in_amt, "outflow_amount": amount, "delay_seconds": int(time_delta)}
                    })
                    break

        # R04: Dormant Account Reactivation
        if s_stats.last_activity_time is not None:
            gap_days = (epoch_sec - s_stats.last_activity_time) / 86400.0
            if gap_days >= 30.0 and amount >= 5000.0:
                signals.append({
                    "rule_id": "R04_DORMANT_AWAKENING",
                    "rule_name": "Dormant Account Surge",
                    "severity": 0.75,
                    "reason": f"Dormant account surge (${amount:,.2f})",
                    "metadata": {"dormant_days": int(gap_days), "amount": amount}
                })

        # R06: Duplicate Request Spike
        recent_matches = [
            t for t, a, d, cp, _ in s_stats.history
            if d == "OUT" and cp == receiver_id and abs(a - amount) < 0.01 and t >= epoch_sec - 10.0
        ]
        if len(recent_matches) >= 2:
            signals.append({
                "rule_id": "R06_DUPLICATE_REPLAY",
                "rule_name": "Duplicate Transaction Replay Pattern",
                "severity": 0.75,
                "reason": f"Repeated identical payment of ${amount:,.2f} to {receiver_id} within 10s",
                "metadata": {"duplicate_count": len(recent_matches) + 1}
            })

        s_stats.record_transaction(epoch_sec, amount, "OUT", receiver_id, txn_type)
        r_stats.record_transaction(epoch_sec, amount, "IN", sender_id, txn_type)

        if not signals:
            screening_score = 0.05
        else:
            max_sev = max(s["severity"] for s in signals)
            mean_sev = sum(s["severity"] for s in signals) / len(signals)
            screening_score = (max_sev * 0.80) + (mean_sev * 0.20)
            screening_score = max(0.05, min(0.98, screening_score))

        return round(screening_score, 4), signals

def test_precision_run():
    seed = 42
    rng = random.Random(seed)
    population = AccountPopulation(num_accounts=60, currency="USD", seed=seed)
    legit_gen = LegitimateTransactionGenerator(population=population, currency="USD", seed=seed)
    screening = PrecisionFastScreeningEngine()
    
    decision_config = {
        "weight_fast": 0.60,
        "weight_dclcg": 0.30,
        "weight_hist": 0.10,
        "flag_threshold": 0.50,
        "hold_threshold": 0.70,
        "reject_threshold": 0.88,
    }
    decision_engine = DecisionEngine(detection_mode="shadow", config=decision_config)
    evaluator = DualEvaluationEngine(simulation_id=1)
    
    selected_scenarios = ["F01", "F02", "F03", "F04", "F05", "F06"]
    counter = 1
    scheduled_queue = []
    sim_time = 0.0
    
    rule_counts = {}
    fp_rule_counts = {}
    
    for i in range(1000):
        sim_time += 0.02
        due_idx = [j for j, item in enumerate(scheduled_queue) if item[0] <= sim_time]
        if due_idx:
            earliest_j = min(due_idx, key=lambda j: scheduled_queue[j][0])
            _, txn = scheduled_queue.pop(earliest_j)
        else:
            is_fraud = (rng.random() * 100.0) < 20.0
            if is_fraud:
                scen_id = rng.choice(selected_scenarios)
                seq_txns, counter = scenario_registry.generate_sequence(
                    scenario_id=scen_id,
                    population=population,
                    base_time=datetime.now(timezone.utc),
                    txn_prefix="TXN",
                    counter_start=counter,
                    rng=rng,
                )
                if seq_txns:
                    txn = seq_txns[0]
                    base_ts = seq_txns[0]["timestamp"]
                    for step_txn in seq_txns[1:]:
                        raw_offset = (step_txn["timestamp"] - base_ts).total_seconds()
                        scaled_delay = max(0.05, min(2.0, raw_offset / 60.0))
                        scheduled_queue.append((sim_time + scaled_delay, step_txn))
                else:
                    legit_gen.counter = counter
                    txn = legit_gen.generate_single_transaction()
                    counter = legit_gen.counter
            else:
                legit_gen.counter = counter
                txn = legit_gen.generate_single_transaction()
                counter = legit_gen.counter

        txn["simulation_id"] = 1
        fast_score, fast_signals = screening.screen_transaction(txn)
        
        decision_rec = decision_engine.evaluate_decision(
            transaction=txn,
            screening_result={"fast_score": fast_score, "signals": fast_signals},
            dclcg_score=None,
            cached_sender_risk=0.0,
            cached_receiver_risk=0.0,
        )
        evaluator.record_decision(decision_rec)
        
        for sig in fast_signals:
            rid = sig["rule_id"]
            rule_counts[rid] = rule_counts.get(rid, 0) + 1
            if txn.get("synthetic_ground_truth") == "legitimate":
                fp_rule_counts[rid] = fp_rule_counts.get(rid, 0) + 1

    summary = evaluator.get_summary()
    print("=== HIGH-PRECISION PIPELINE RESULTS ===")
    print(f"Total Transactions: {summary['total_transactions']} (Legit: {summary['total_legitimate']}, Fraud: {summary['total_fraudulent']})")
    print(f"True Positives (TP):  {summary['true_positives']}")
    print(f"False Positives (FP): {summary['false_positives']}")
    print(f"True Negatives (TN):  {summary['true_negatives']}")
    print(f"False Negatives (FN): {summary['false_negatives']}")
    print(f"Precision:            {summary['precision']*100:.2f}%")
    print(f"Recall:               {summary['recall']*100:.2f}%")
    print(f"False Positive Rate:  {summary['false_positive_rate']*100:.2f}%")
    print(f"F1 Score:             {summary['f1_score']*100:.2f}%")
    print(f"Accuracy:             {summary['accuracy']*100:.2f}%")
    print("\nScenario breakdown:")
    for sc, data in summary["scenario_metrics"].items():
        print(f"  {sc}: total={data['total']}, TP={data['tp']}, FN={data['fn']}, FP={data['fp']}, Detection Rate={data['detection_rate']*100:.1f}%")
    print("\nRule trigger counts total:", rule_counts)
    print("Rule trigger counts on legitimate (FP):", fp_rule_counts)

if __name__ == "__main__":
    test_precision_run()
