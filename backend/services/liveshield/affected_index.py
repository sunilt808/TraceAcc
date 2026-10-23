"""
affected_index.py — Affected Transaction Index & Neighborhood Discovery for Continuous Risk Re-evaluation (CRRE).

Features:
- Fast in-memory bidirectional indexing by source account, destination account, sequence, scenario, and graph neighbors.
- Configurable neighborhood traversal with max_hops, lookback_sec, and max_affected_txns caps to prevent runaway graph propagation.
- Strict priority ranking: Direct sequence hops > 1-hop counterparties > 2-hop strong connections > active observation queue.
"""
from collections import defaultdict
from datetime import datetime, timezone
import logging
from typing import Dict, List, Optional, Set, Any, Tuple

logger = logging.getLogger("liveshield")


class AffectedTransactionIndex:
    def __init__(self, simulation_id: int, max_indexed_transactions: int = 10000):
        self.simulation_id = simulation_id
        self.max_indexed_transactions = max_indexed_transactions
        
        # Core metadata lookup: txn_id -> metadata dictionary
        self._txns: Dict[str, Dict[str, Any]] = {}
        
        # Account indices: account_id -> set of txn_ids
        self._account_to_txns: Dict[str, Set[str]] = defaultdict(set)
        
        # Graph adjacency: account_id -> set of connected counterparty account_ids
        self._adjacency: Dict[str, Set[str]] = defaultdict(set)
        
        # Sequence index: sequence_id -> list of txn_ids in chronological order
        self._sequence_to_txns: Dict[str, List[str]] = defaultdict(list)
        
        # Scenario index: scenario_id -> set of txn_ids
        self._scenario_to_txns: Dict[str, Set[str]] = defaultdict(set)
        
        # Status index: risk_status -> set of txn_ids
        self._status_to_txns: Dict[str, Set[str]] = defaultdict(set)
        
        # Chronological order list of txn_ids
        self._ordered_txn_ids: List[str] = []

    def index_transaction(
        self,
        txn: Dict[str, Any],
        initial_decision: str = "APPROVE",
        risk_score: float = 0.0,
        risk_status: str = "LOW_RISK",
        assessment_version: int = 1,
    ):
        """Register a new transaction and its initial assessment state into the index."""
        txn_id = txn.get("transaction_id", "")
        if not txn_id:
            return

        sender = txn.get("sender_account", "")
        receiver = txn.get("receiver_account", "")
        amount = float(txn.get("amount", 0.0))
        ts = txn.get("timestamp")
        if isinstance(ts, str):
            try:
                ts = datetime.fromisoformat(ts.replace("Z", "+00:00"))
            except Exception:
                ts = datetime.now(timezone.utc)
        elif not isinstance(ts, datetime):
            ts = datetime.now(timezone.utc)

        seq_id = txn.get("sequence_id")
        scen_id = txn.get("scenario_id")
        truth = txn.get("synthetic_ground_truth", "legitimate")

        meta = {
            "transaction_id": txn_id,
            "sender_account": sender,
            "receiver_account": receiver,
            "amount": amount,
            "timestamp": ts,
            "sequence_id": seq_id,
            "step_index": txn.get("step_index", 0),
            "scenario_id": scen_id,
            "synthetic_ground_truth": truth,
            "payment_status": initial_decision,
            "initial_decision": initial_decision,
            "initial_risk_score": risk_score,
            "current_risk_score": risk_score,
            "initial_risk_status": risk_status,
            "current_risk_status": risk_status,
            "assessment_version": assessment_version,
            "reassessment_count": 0,
            "last_reassessed_at": None,
        }

        self._txns[txn_id] = meta
        self._ordered_txn_ids.append(txn_id)

        if sender:
            self._account_to_txns[sender].add(txn_id)
        if receiver:
            self._account_to_txns[receiver].add(txn_id)
        if sender and receiver:
            self._adjacency[sender].add(receiver)
            self._adjacency[receiver].add(sender)
        if seq_id:
            self._sequence_to_txns[seq_id].append(txn_id)
        if scen_id:
            self._scenario_to_txns[scen_id].add(txn_id)
            
        self._status_to_txns[risk_status].add(txn_id)

        # Evict oldest if exceeding capacity
        if len(self._ordered_txn_ids) > self.max_indexed_transactions:
            oldest_id = self._ordered_txn_ids.pop(0)
            self._evict_transaction(oldest_id)

    def update_assessment(
        self,
        txn_id: str,
        new_risk_score: float,
        new_risk_status: str,
        new_version: int,
        reassessment_reason: Optional[str] = None,
    ):
        """Update indexed risk state and transition status sets atomically."""
        meta = self._txns.get(txn_id)
        if not meta:
            return

        old_status = meta.get("current_risk_status")
        if old_status and txn_id in self._status_to_txns[old_status]:
            self._status_to_txns[old_status].remove(txn_id)

        meta["current_risk_score"] = float(new_risk_score)
        meta["current_risk_status"] = new_risk_status
        meta["assessment_version"] = new_version
        meta["reassessment_count"] = meta.get("reassessment_count", 0) + 1
        meta["last_reassessed_at"] = datetime.now(timezone.utc)
        if reassessment_reason:
            meta["last_reassessment_reason"] = reassessment_reason

        self._status_to_txns[new_risk_status].add(txn_id)

    def get_transaction(self, txn_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve indexed metadata for a transaction."""
        meta = self._txns.get(txn_id)
        return dict(meta) if meta else None

    def find_affected_transactions(
        self,
        trigger_type: str,
        triggering_txn_id: Optional[str] = None,
        sender_account: Optional[str] = None,
        receiver_account: Optional[str] = None,
        participating_accounts: Optional[List[str]] = None,
        sequence_id: Optional[str] = None,
        max_hops: int = 2,
        max_affected_txns: int = 50,
        lookback_sec: float = 600.0,
        current_time: Optional[datetime] = None,
    ) -> List[Dict[str, Any]]:
        """
        Discover historical transactions affected by the triggering event.
        
        Prioritization tiers:
        1. Explicit sequence counterparties (e.g. F01 multi-hop chains).
        2. Direct 1-hop transactions involving trigger sender / receiver.
        3. 2-hop connected transactions within lookback window.
        4. Unresolved transactions in observation states.
        """
        if current_time is None:
            current_time = datetime.now(timezone.utc)

        candidate_ids: Set[str] = set()
        priorities: Dict[str, int] = {}  # txn_id -> priority score (higher = earlier)

        # Helper to check lookback
        def is_within_lookback(meta: Dict[str, Any]) -> bool:
            ts = meta.get("timestamp")
            if not ts:
                return True
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
            delta = (current_time - ts).total_seconds()
            return 0.0 <= delta <= lookback_sec or delta < 0  # allow slightly future scheduled events

        # Tier 1: Sequence matching (highest priority for multi-hop money muling)
        if sequence_id and sequence_id in self._sequence_to_txns:
            for tid in self._sequence_to_txns[sequence_id]:
                if tid != triggering_txn_id and tid in self._txns:
                    candidate_ids.add(tid)
                    priorities[tid] = 100

        # Tier 2: Participating accounts (from graph pattern or investigation evidence)
        seed_accounts: Set[str] = set()
        if participating_accounts:
            seed_accounts.update(participating_accounts)
        if sender_account:
            seed_accounts.add(sender_account)
        if receiver_account:
            seed_accounts.add(receiver_account)

        # Collect 1-hop transactions
        one_hop_accounts: Set[str] = set(seed_accounts)
        for acc in seed_accounts:
            for tid in self._account_to_txns.get(acc, set()):
                if tid != triggering_txn_id and tid in self._txns:
                    meta = self._txns[tid]
                    if is_within_lookback(meta):
                        candidate_ids.add(tid)
                        priorities[tid] = max(priorities.get(tid, 0), 80)
            
            # Expand to 1-hop counterparties
            one_hop_accounts.update(self._adjacency.get(acc, set()))

        # Tier 3: 2-hop transactions (if max_hops >= 2 and capacity remains)
        if max_hops >= 2 and len(candidate_ids) < max_affected_txns:
            for acc in one_hop_accounts:
                for tid in self._account_to_txns.get(acc, set()):
                    if tid != triggering_txn_id and tid not in candidate_ids and tid in self._txns:
                        meta = self._txns[tid]
                        if is_within_lookback(meta):
                            candidate_ids.add(tid)
                            priorities[tid] = max(priorities.get(tid, 0), 50)
                    if len(candidate_ids) >= max_affected_txns * 2:
                        break

        # Tier 4: Scheduled sweeps / Unresolved observation transactions
        if trigger_type == "SCHEDULED":
            for obs_tid in list(self._status_to_txns.get("UNDER_OBSERVATION", set())) + list(self._status_to_txns.get("UNDER_REVIEW", set())):
                if obs_tid in self._txns and obs_tid not in candidate_ids:
                    candidate_ids.add(obs_tid)
                    priorities[obs_tid] = max(priorities.get(obs_tid, 0), 30)

        # Sort candidate transactions by (Priority DESC, Timestamp DESC)
        sorted_candidates: List[Tuple[str, int, datetime]] = []
        for tid in candidate_ids:
            meta = self._txns.get(tid)
            if meta:
                prio = priorities.get(tid, 0)
                ts = meta.get("timestamp", current_time)
                if ts.tzinfo is None:
                    ts = ts.replace(tzinfo=timezone.utc)
                sorted_candidates.append((tid, prio, ts))

        sorted_candidates.sort(key=lambda x: (x[1], x[2]), reverse=True)

        # Return capped results
        result_metas = [
            dict(self._txns[tid])
            for tid, _, _ in sorted_candidates[:max_affected_txns]
        ]
        return result_metas

    def _evict_transaction(self, txn_id: str):
        """Remove an evicted transaction from indices."""
        meta = self._txns.pop(txn_id, None)
        if not meta:
            return
        sender = meta.get("sender_account")
        receiver = meta.get("receiver_account")
        seq_id = meta.get("sequence_id")
        scen_id = meta.get("scenario_id")
        status = meta.get("current_risk_status")

        if sender and txn_id in self._account_to_txns[sender]:
            self._account_to_txns[sender].remove(txn_id)
        if receiver and txn_id in self._account_to_txns[receiver]:
            self._account_to_txns[receiver].remove(txn_id)
        if seq_id and txn_id in self._sequence_to_txns[seq_id]:
            self._sequence_to_txns[seq_id].remove(txn_id)
        if scen_id and txn_id in self._scenario_to_txns[scen_id]:
            self._scenario_to_txns[scen_id].remove(txn_id)
        if status and txn_id in self._status_to_txns[status]:
            self._status_to_txns[status].remove(txn_id)

    def get_stats(self) -> Dict[str, Any]:
        """Summary index telemetry."""
        return {
            "indexed_transactions": len(self._txns),
            "indexed_accounts": len(self._account_to_txns),
            "indexed_sequences": len(self._sequence_to_txns),
            "status_distribution": {
                status: len(tids) for status, tids in self._status_to_txns.items()
            },
        }
