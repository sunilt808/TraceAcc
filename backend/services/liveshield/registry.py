"""
registry.py — Comprehensive registry and sequence generation engine for all 18 Fraud Scenarios (F01–F18).

Each scenario produces a deterministic, ordered list of sequence transactions with:
- Explicit sequence_id
- Step indices (step_index: 0, 1, 2...)
- Configured time offsets (timedelta)
- Exact Decimal financial values
- Synthetic ground-truth metadata
- Account balance reconciliation
"""
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
import random
from typing import Dict, List, Any, Optional, Callable
from services.liveshield.accounts import AccountPopulation


@dataclass
class ScenarioMetadata:
    scenario_id: str
    name: str
    category: str
    description: str
    default_params: Dict[str, Any]
    param_schema: Dict[str, Any]


class FraudScenarioRegistry:
    def __init__(self):
        self._registry: Dict[str, ScenarioMetadata] = {}
        self._generators: Dict[str, Callable] = {}
        self._register_all()

    def _register_all(self):
        # F01: Structuring ($8k–$9.9k)
        self.register(
            ScenarioMetadata(
                scenario_id="F01",
                name="Structuring / Smurfing",
                category="EVASION",
                description="Repeated sub-threshold deposits/transfers ($8,000–$9,950) to evade the $10,000 CTR limit.",
                default_params={"num_transfers": 4, "interval_minutes": 45, "min_amount": 8200.0, "max_amount": 9900.0},
                param_schema={"num_transfers": "int", "interval_minutes": "int", "min_amount": "float", "max_amount": "float"},
            ),
            self._gen_f01_structuring,
        )

        # F02: Rapid Pass-Through
        self.register(
            ScenarioMetadata(
                scenario_id="F02",
                name="Rapid Pass-Through Velocity",
                category="VELOCITY",
                description="Funds received into a mule intermediary and evacuated to a 3rd party within seconds/minutes.",
                default_params={"amount": 15000.0, "delay_seconds": 60, "fee_cut_percent": 3.0},
                param_schema={"amount": "float", "delay_seconds": "int", "fee_cut_percent": "float"},
            ),
            self._gen_f02_passthrough,
        )

        # F03: Fan-In Aggregation
        self.register(
            ScenarioMetadata(
                scenario_id="F03",
                name="Fan-In Aggregation (Many-to-One)",
                category="STRUCTURAL",
                description="Multiple feeder smurf accounts funnel small sums into a central aggregator mule account.",
                default_params={"feeder_count": 6, "amount_per_feeder": 2500.0, "spread_minutes": 30},
                param_schema={"feeder_count": "int", "amount_per_feeder": "float", "spread_minutes": "int"},
            ),
            self._gen_f03_fan_in,
        )

        # F04: Fan-Out Dispersion
        self.register(
            ScenarioMetadata(
                scenario_id="F04",
                name="Fan-Out Dispersion (One-to-Many)",
                category="STRUCTURAL",
                description="A master source account rapidly disperses large capital into multiple receiver mule accounts.",
                default_params={"receiver_count": 6, "amount_per_receiver": 2500.0, "spread_minutes": 30},
                param_schema={"receiver_count": "int", "amount_per_receiver": "float", "spread_minutes": "int"},
            ),
            self._gen_f04_fan_out,
        )

        # F05: Money-Mule Chain
        self.register(
            ScenarioMetadata(
                scenario_id="F05",
                name="Money-Mule Multi-Hop Chain",
                category="STRUCTURAL",
                description="Funds traverse a serial sequence of 3 to 6 intermediary mule accounts (A → B → C → D → E).",
                default_params={"hop_count": 4, "initial_amount": 25000.0, "hop_delay_minutes": 20, "hop_fee_percent": 2.0},
                param_schema={"hop_count": "int", "initial_amount": "float", "hop_delay_minutes": "int", "hop_fee_percent": "float"},
            ),
            self._gen_f05_mule_chain,
        )

        # F06: Circular Transfers
        self.register(
            ScenarioMetadata(
                scenario_id="F06",
                name="Circular Transfers (Cycle Ring)",
                category="STRUCTURAL",
                description="Closed loop transaction flow (A → B → C → A) designed to generate wash volume or obscure fund origin.",
                default_params={"cycle_length": 3, "amount": 18000.0, "step_delay_minutes": 15},
                param_schema={"cycle_length": "int", "amount": "float", "step_delay_minutes": "int"},
            ),
            self._gen_f06_circular,
        )

        # F07: Multi-Stage Layering
        self.register(
            ScenarioMetadata(
                scenario_id="F07",
                name="Multi-Stage Layering Shells",
                category="STRUCTURAL",
                description="Complex multi-tiered layering combining splitting, intermediary holding, and reconvergence.",
                default_params={"layer_stages": 3, "total_amount": 50000.0, "stage_delay_minutes": 45},
                param_schema={"layer_stages": "int", "total_amount": "float", "stage_delay_minutes": "int"},
            ),
            self._gen_f07_layering,
        )

        # F08: High-Frequency Transaction Bursts
        self.register(
            ScenarioMetadata(
                scenario_id="F08",
                name="High-Frequency Transaction Bursts",
                category="VELOCITY",
                description="Sudden eruption of 8 to 20 transactions executed within a tight window of minutes.",
                default_params={"burst_count": 10, "burst_window_seconds": 120, "amount_per_txn": 850.0},
                param_schema={"burst_count": "int", "burst_window_seconds": "int", "amount_per_txn": "float"},
            ),
            self._gen_f08_bursts,
        )

        # F09: Unusual Amount Spikes
        self.register(
            ScenarioMetadata(
                scenario_id="F09",
                name="Unusual Amount Spikes",
                category="BEHAVIORAL",
                description="Anomalous transaction that is 20x–50x greater than the sending account's historical baseline.",
                default_params={"amount_multiplier": 30.0, "round_amount": True},
                param_schema={"amount_multiplier": "float", "round_amount": "bool"},
            ),
            self._gen_f09_unusual_amount,
        )

        # F10: Account Takeover (ATO)
        self.register(
            ScenarioMetadata(
                scenario_id="F10",
                name="Account Takeover (ATO)",
                category="BEHAVIORAL",
                description="Sudden change in device ID, country, and high-value drain transfer to an unfamiliar destination.",
                default_params={"drain_percentage": 90.0, "foreign_country": "RU"},
                param_schema={"drain_percentage": "float", "foreign_country": "str"},
            ),
            self._gen_f10_takeover,
        )

        # F11: New High-Risk Beneficiary
        self.register(
            ScenarioMetadata(
                scenario_id="F11",
                name="New High-Risk Beneficiary",
                category="BEHAVIORAL",
                description="Immediate high-value transfer sent to a newly added, previously unseen overseas beneficiary.",
                default_params={"amount": 22000.0, "destination_country": "AE"},
                param_schema={"amount": "float", "destination_country": "str"},
            ),
            self._gen_f11_new_beneficiary,
        )

        # F12: Geographic Anomaly
        self.register(
            ScenarioMetadata(
                scenario_id="F12",
                name="Geographic Anomaly / Jurisdiction Shift",
                category="BEHAVIORAL",
                description="Transactions routed across high-risk or conflicting foreign jurisdictions within impossible travel times.",
                default_params={"source_country": "SG", "dest_country": "PA", "amount": 35000.0},
                param_schema={"source_country": "str", "dest_country": "str", "amount": "float"},
            ),
            self._gen_f12_geo_anomaly,
        )

        # F13: Dormant Account Reactivation
        self.register(
            ScenarioMetadata(
                scenario_id="F13",
                name="Dormant Account Reactivation",
                category="BEHAVIORAL",
                description="An account silent for months suddenly executes rapid high-volume outflow transactions.",
                default_params={"reactivation_amount": 40000.0, "subsequent_transfers": 3},
                param_schema={"reactivation_amount": "float", "subsequent_transfers": "int"},
            ),
            self._gen_f13_dormant,
        )

        # F14: Velocity Anomaly
        self.register(
            ScenarioMetadata(
                scenario_id="F14",
                name="Extreme Velocity Anomaly",
                category="VELOCITY",
                description="Unusually high frequency transactions generated per minute from a single retail account.",
                default_params={"txns_per_minute": 15, "duration_minutes": 2, "avg_amount": 300.0},
                param_schema={"txns_per_minute": "int", "duration_minutes": "int", "avg_amount": "float"},
            ),
            self._gen_f14_velocity,
        )

        # F15: Coordinated Network
        self.register(
            ScenarioMetadata(
                scenario_id="F15",
                name="Coordinated Network Swarm",
                category="STRUCTURAL",
                description="Synchronized transfers from multiple distinct source accounts executed within the same second.",
                default_params={"network_size": 5, "common_receiver": True, "amount": 4800.0},
                param_schema={"network_size": "int", "common_receiver": "bool", "amount": "float"},
            ),
            self._gen_f15_coordinated,
        )

        # F16: Repeated Failed Attempts
        self.register(
            ScenarioMetadata(
                scenario_id="F16",
                name="Repeated Failed Attempts (Brute Trial)",
                category="BEHAVIORAL",
                description="Series of failed authorization attempts followed immediately by a successful drainage payment.",
                default_params={"failed_count": 4, "final_amount": 7500.0},
                param_schema={"failed_count": "int", "final_amount": "float"},
            ),
            self._gen_f16_failed_attempts,
        )

        # F17: Duplicate / Idempotency Collision
        self.register(
            ScenarioMetadata(
                scenario_id="F17",
                name="Duplicate Transaction / Double Spend",
                category="EVASION",
                description="Multiple identical transaction amounts and reference keys submitted within milliseconds.",
                default_params={"duplicate_count": 3, "amount": 1250.0, "interval_ms": 200},
                param_schema={"duplicate_count": "int", "amount": "float", "interval_ms": "int"},
            ),
            self._gen_f17_duplicate,
        )

        # F18: Synthetic Identity Cluster
        self.register(
            ScenarioMetadata(
                scenario_id="F18",
                name="Synthetic Identity Cluster",
                category="IDENTITY",
                description="Multiple accounts sharing identical fabricated device IDs, routing patterns, and clustered timing.",
                default_params={"cluster_size": 4, "amount_per_account": 3200.0},
                param_schema={"cluster_size": "int", "amount_per_account": "float"},
            ),
            self._gen_f18_synthetic_id,
        )

    def register(self, metadata: ScenarioMetadata, generator: Callable):
        self._registry[metadata.scenario_id] = metadata
        self._generators[metadata.scenario_id] = generator

    def get_metadata(self, scenario_id: str) -> Optional[ScenarioMetadata]:
        return self._registry.get(scenario_id)

    def list_scenarios(self) -> List[ScenarioMetadata]:
        return list(self._registry.values())

    def generate_sequence(
        self,
        scenario_id: str,
        population: AccountPopulation,
        base_time: datetime,
        txn_prefix: str,
        counter_start: int,
        params: Optional[Dict[str, Any]] = None,
        rng: Optional[random.Random] = None,
    ) -> tuple[List[Dict[str, Any]], int]:
        """Generate a complete ordered sequence for the given scenario."""
        alias_map = {
            "structuring": "F01",
            "rapid_movement": "F02",
            "fan_in": "F03",
            "fan_out": "F04",
            "layering_shells": "F05",
            "circular_transaction": "F06",
            "cycle": "F06",
            "bipartite_bridge": "F07",
            "round_amount_spikes": "F08",
            "high_risk_jurisdiction": "F09",
            "periodic_transfers": "F10",
            "night_activity": "F11",
            "burst_activity": "F12",
            "burst": "F12",
            "dormant_activation": "F13",
            "velocity_anomaly": "F14",
            "dclcg_gnn": "F15",
            "isolation_forest": "F16",
            "lof_density": "F17",
            "dbscan_noise": "F18",
            "risk_propagation": "F05",
            "community_mule_core": "F06",
            "temporal_burst_cascade": "F05",
        }
        resolved_id = alias_map.get(scenario_id, scenario_id)
        if resolved_id not in self._generators:
            # Fallback to random valid generator if unknown
            resolved_id = "F01"
        
        meta = self._registry[resolved_id]
        merged_params = dict(meta.default_params)
        if params:
            merged_params.update(params)

        generator = self._generators[resolved_id]
        r = rng or random.Random()
        return generator(population, base_time, txn_prefix, counter_start, merged_params, r)

    # ------------------------------------------------------------
    # GENERATOR IMPLEMENTATIONS (F01 to F18)
    # ------------------------------------------------------------

    def _gen_f01_structuring(self, pop: AccountPopulation, base_time: datetime, prefix: str, c: int, p: dict, rng: random.Random):
        num_txns = int(p.get("num_transfers", 4))
        interval_min = int(p.get("interval_minutes", 45))
        min_amt = Decimal(str(p.get("min_amount", 8200.0)))
        max_amt = Decimal(str(p.get("max_amount", 9900.0)))

        sender, receiver = pop.sample_pair("p2p")
        seq_id = f"SEQ-F01-{c}"
        txns = []

        for i in range(num_txns):
            amt = (min_amt + Decimal(str(rng.random())) * (max_amt - min_amt)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            t_time = base_time + timedelta(minutes=i * interval_min)
            sender.debit(amt)
            receiver.credit(amt)

            txns.append({
                "transaction_id": f"{prefix}{c:08d}",
                "sequence_id": seq_id,
                "step_index": i,
                "sender_account": sender.account_id,
                "receiver_account": receiver.account_id,
                "amount": amt,
                "currency": pop.currency,
                "transaction_type": "STRUCTURING",
                "channel": "BRANCH" if i % 2 == 0 else "ONLINE",
                "timestamp": t_time,
                "scheduled_timestamp": t_time,
                "generated_timestamp": datetime.now(timezone.utc),
                "source_country": sender.country,
                "dest_country": receiver.country,
                "device_id": sender.device_id,
                "merchant_id": None,
                "scenario_id": "F01",
                "synthetic_ground_truth": "fraudulent",
                "account_ground_truth": "smurf",
                "sequence_ground_truth": "structuring_scheme",
                "scenario_metadata": {"step": i + 1, "total_steps": num_txns, "sub_threshold_target": 10000.0},
                "is_synthetic": True,
            })
            c += 1

        return txns, c

    def _gen_f02_passthrough(self, pop: AccountPopulation, base_time: datetime, prefix: str, c: int, p: dict, rng: random.Random):
        amt = Decimal(str(p.get("amount", 15000.0))).quantize(Decimal("0.01"))
        delay_sec = int(p.get("delay_seconds", 60))
        fee_cut = Decimal(str(p.get("fee_cut_percent", 3.0)))

        # 3 entities: Originator -> Intermediary Mule -> Destination
        if len(pop.account_ids) < 3:
            s1, r1 = pop.sample_pair()
            r2 = s1
        else:
            s1, r1, r2 = pop.rng.sample(pop.account_ids, 3)
            s1, r1, r2 = pop.accounts[s1], pop.accounts[r1], pop.accounts[r2]

        seq_id = f"SEQ-F02-{c}"
        txns = []

        # Step 1: Inflow to intermediary
        s1.debit(amt)
        r1.credit(amt)
        txns.append({
            "transaction_id": f"{prefix}{c:08d}",
            "sequence_id": seq_id,
            "step_index": 0,
            "sender_account": s1.account_id,
            "receiver_account": r1.account_id,
            "amount": amt,
            "currency": pop.currency,
            "transaction_type": "PASS_THROUGH_IN",
            "channel": "WIRE",
            "timestamp": base_time,
            "scheduled_timestamp": base_time,
            "generated_timestamp": datetime.now(timezone.utc),
            "source_country": s1.country,
            "dest_country": r1.country,
            "device_id": s1.device_id,
            "scenario_id": "F02",
            "synthetic_ground_truth": "fraudulent",
            "account_ground_truth": "intermediary_mule",
            "sequence_ground_truth": "rapid_passthrough",
            "scenario_metadata": {"step": "inflow", "intermediary": r1.account_id},
            "is_synthetic": True,
        })
        c += 1

        # Step 2: Rapid Outflow (minus fee cut)
        out_amt = (amt * (Decimal("100.0") - fee_cut) / Decimal("100.0")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        t_out = base_time + timedelta(seconds=delay_sec)
        r1.debit(out_amt)
        r2.credit(out_amt)
        txns.append({
            "transaction_id": f"{prefix}{c:08d}",
            "sequence_id": seq_id,
            "step_index": 1,
            "sender_account": r1.account_id,
            "receiver_account": r2.account_id,
            "amount": out_amt,
            "currency": pop.currency,
            "transaction_type": "PASS_THROUGH_OUT",
            "channel": "WIRE",
            "timestamp": t_out,
            "scheduled_timestamp": t_out,
            "generated_timestamp": datetime.now(timezone.utc),
            "source_country": r1.country,
            "dest_country": r2.country,
            "device_id": r1.device_id,
            "scenario_id": "F02",
            "synthetic_ground_truth": "fraudulent",
            "account_ground_truth": "intermediary_mule",
            "sequence_ground_truth": "rapid_passthrough",
            "scenario_metadata": {"step": "outflow", "intermediary": r1.account_id, "delay_seconds": delay_sec},
            "is_synthetic": True,
        })
        c += 1

        return txns, c

    def _gen_f03_fan_in(self, pop: AccountPopulation, base_time: datetime, prefix: str, c: int, p: dict, rng: random.Random):
        feeders = int(p.get("feeder_count", 6))
        base_amt = Decimal(str(p.get("amount_per_feeder", 2500.0)))
        spread_min = int(p.get("spread_minutes", 30))

        collector_id = rng.choice(pop.account_ids)
        collector = pop.accounts[collector_id]
        feeder_candidates = [a for a in pop.account_ids if a != collector_id]
        selected_feeders = rng.sample(feeder_candidates, min(feeders, len(feeder_candidates)))

        seq_id = f"SEQ-F03-{c}"
        txns = []

        for i, f_id in enumerate(selected_feeders):
            feeder = pop.accounts[f_id]
            amt = (base_amt * (Decimal("0.85") + Decimal(str(rng.random() * 0.3)))).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            t_time = base_time + timedelta(minutes=int(i * (spread_min / max(1, len(selected_feeders)))) )
            feeder.debit(amt)
            collector.credit(amt)

            txns.append({
                "transaction_id": f"{prefix}{c:08d}",
                "sequence_id": seq_id,
                "step_index": i,
                "sender_account": feeder.account_id,
                "receiver_account": collector.account_id,
                "amount": amt,
                "currency": pop.currency,
                "transaction_type": "FAN_IN_FEED",
                "channel": "MOBILE",
                "timestamp": t_time,
                "scheduled_timestamp": t_time,
                "generated_timestamp": datetime.now(timezone.utc),
                "source_country": feeder.country,
                "dest_country": collector.country,
                "device_id": feeder.device_id,
                "scenario_id": "F03",
                "synthetic_ground_truth": "fraudulent",
                "account_ground_truth": "collector_hub" if i == 0 else "feeder_mule",
                "sequence_ground_truth": "fan_in_aggregation",
                "scenario_metadata": {"collector": collector.account_id, "feeder_index": i + 1},
                "is_synthetic": True,
            })
            c += 1

        return txns, c

    def _gen_f04_fan_out(self, pop: AccountPopulation, base_time: datetime, prefix: str, c: int, p: dict, rng: random.Random):
        receivers = int(p.get("receiver_count", 6))
        base_amt = Decimal(str(p.get("amount_per_receiver", 2500.0)))
        spread_min = int(p.get("spread_minutes", 30))

        master_id = rng.choice(pop.account_ids)
        master = pop.accounts[master_id]
        receiver_candidates = [a for a in pop.account_ids if a != master_id]
        selected_receivers = rng.sample(receiver_candidates, min(receivers, len(receiver_candidates)))

        seq_id = f"SEQ-F04-{c}"
        txns = []

        for i, r_id in enumerate(selected_receivers):
            recv = pop.accounts[r_id]
            amt = (base_amt * (Decimal("0.85") + Decimal(str(rng.random() * 0.3)))).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            t_time = base_time + timedelta(minutes=int(i * (spread_min / max(1, len(selected_receivers)))))
            master.debit(amt)
            recv.credit(amt)

            txns.append({
                "transaction_id": f"{prefix}{c:08d}",
                "sequence_id": seq_id,
                "step_index": i,
                "sender_account": master.account_id,
                "receiver_account": recv.account_id,
                "amount": amt,
                "currency": pop.currency,
                "transaction_type": "FAN_OUT_DISPERSE",
                "channel": "ONLINE",
                "timestamp": t_time,
                "scheduled_timestamp": t_time,
                "generated_timestamp": datetime.now(timezone.utc),
                "source_country": master.country,
                "dest_country": recv.country,
                "device_id": master.device_id,
                "scenario_id": "F04",
                "synthetic_ground_truth": "fraudulent",
                "account_ground_truth": "master_dispenser" if i == 0 else "smurf_mule",
                "sequence_ground_truth": "fan_out_dispersion",
                "scenario_metadata": {"master": master.account_id, "receiver_index": i + 1},
                "is_synthetic": True,
            })
            c += 1

        return txns, c

    def _gen_f05_mule_chain(self, pop: AccountPopulation, base_time: datetime, prefix: str, c: int, p: dict, rng: random.Random):
        hops = max(3, min(6, int(p.get("hop_count", 4))))
        init_amt = Decimal(str(p.get("initial_amount", 25000.0)))
        hop_delay = int(p.get("hop_delay_minutes", 20))
        fee_pct = Decimal(str(p.get("hop_fee_percent", 2.0)))

        chain_ids = rng.sample(pop.account_ids, min(hops + 1, len(pop.account_ids)))
        chain = [pop.accounts[cid] for cid in chain_ids]

        seq_id = f"SEQ-F05-{c}"
        txns = []
        current_amt = init_amt

        for i in range(len(chain) - 1):
            s = chain[i]
            r = chain[i + 1]
            t_time = base_time + timedelta(minutes=i * hop_delay)
            
            s.debit(current_amt)
            r.credit(current_amt)

            txns.append({
                "transaction_id": f"{prefix}{c:08d}",
                "sequence_id": seq_id,
                "step_index": i,
                "sender_account": s.account_id,
                "receiver_account": r.account_id,
                "amount": current_amt.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
                "currency": pop.currency,
                "transaction_type": "MULE_HOP",
                "channel": "WIRE",
                "timestamp": t_time,
                "scheduled_timestamp": t_time,
                "generated_timestamp": datetime.now(timezone.utc),
                "source_country": s.country,
                "dest_country": r.country,
                "device_id": s.device_id,
                "scenario_id": "F05",
                "synthetic_ground_truth": "fraudulent",
                "account_ground_truth": "mule_chain_node",
                "sequence_ground_truth": "mule_chain",
                "scenario_metadata": {"hop_number": i + 1, "total_hops": len(chain) - 1},
                "is_synthetic": True,
            })
            c += 1
            current_amt = (current_amt * (Decimal("100.0") - fee_pct) / Decimal("100.0")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        return txns, c

    def _gen_f06_circular(self, pop: AccountPopulation, base_time: datetime, prefix: str, c: int, p: dict, rng: random.Random):
        cycle_len = max(3, min(5, int(p.get("cycle_length", 3))))
        amt = Decimal(str(p.get("amount", 18000.0))).quantize(Decimal("0.01"))
        delay_min = int(p.get("step_delay_minutes", 15))

        nodes_ids = rng.sample(pop.account_ids, min(cycle_len, len(pop.account_ids)))
        nodes = [pop.accounts[nid] for nid in nodes_ids]
        
        seq_id = f"SEQ-F06-{c}"
        txns = []

        for i in range(len(nodes)):
            s = nodes[i]
            r = nodes[(i + 1) % len(nodes)]
            t_time = base_time + timedelta(minutes=i * delay_min)

            s.debit(amt)
            r.credit(amt)

            txns.append({
                "transaction_id": f"{prefix}{c:08d}",
                "sequence_id": seq_id,
                "step_index": i,
                "sender_account": s.account_id,
                "receiver_account": r.account_id,
                "amount": amt,
                "currency": pop.currency,
                "transaction_type": "CIRCULAR_WASH",
                "channel": "WIRE",
                "timestamp": t_time,
                "scheduled_timestamp": t_time,
                "generated_timestamp": datetime.now(timezone.utc),
                "source_country": s.country,
                "dest_country": r.country,
                "device_id": s.device_id,
                "scenario_id": "F06",
                "synthetic_ground_truth": "fraudulent",
                "account_ground_truth": "circular_ring_node",
                "sequence_ground_truth": "cycle_ring",
                "scenario_metadata": {"cycle_position": i + 1, "cycle_size": len(nodes)},
                "is_synthetic": True,
            })
            c += 1

        return txns, c

    def _gen_f07_layering(self, pop: AccountPopulation, base_time: datetime, prefix: str, c: int, p: dict, rng: random.Random):
        total_amt = Decimal(str(p.get("total_amount", 50000.0)))
        delay_min = int(p.get("stage_delay_minutes", 45))

        if len(pop.account_ids) < 5:
            nodes = [pop.accounts[pop.account_ids[0]], pop.accounts[pop.account_ids[1]]]
        else:
            nodes = [pop.accounts[aid] for aid in rng.sample(pop.account_ids, 5)]

        seq_id = f"SEQ-F07-{c}"
        txns = []

        # Origin -> Shell 1 & Shell 2 -> Shell 3 -> Exit
        origin, s1, s2, s3, exit_acc = nodes[0], nodes[1], nodes[2], nodes[3], nodes[4]
        half_amt = (total_amt / Decimal("2.0")).quantize(Decimal("0.01"))

        # Stage 1: Split
        origin.debit(total_amt)
        s1.credit(half_amt)
        s2.credit(half_amt)
        txns.append({
            "transaction_id": f"{prefix}{c:08d}", "sequence_id": seq_id, "step_index": 0,
            "sender_account": origin.account_id, "receiver_account": s1.account_id, "amount": half_amt,
            "currency": pop.currency, "transaction_type": "LAYERING_SPLIT", "channel": "WIRE",
            "timestamp": base_time, "scheduled_timestamp": base_time, "generated_timestamp": datetime.now(timezone.utc),
            "source_country": origin.country, "dest_country": s1.country, "device_id": origin.device_id,
            "scenario_id": "F07", "synthetic_ground_truth": "fraudulent", "account_ground_truth": "shell_company",
            "sequence_ground_truth": "multi_stage_layering", "scenario_metadata": {"stage": "split_1"}, "is_synthetic": True
        })
        c += 1
        txns.append({
            "transaction_id": f"{prefix}{c:08d}", "sequence_id": seq_id, "step_index": 1,
            "sender_account": origin.account_id, "receiver_account": s2.account_id, "amount": half_amt,
            "currency": pop.currency, "transaction_type": "LAYERING_SPLIT", "channel": "WIRE",
            "timestamp": base_time + timedelta(minutes=5), "scheduled_timestamp": base_time + timedelta(minutes=5), "generated_timestamp": datetime.now(timezone.utc),
            "source_country": origin.country, "dest_country": s2.country, "device_id": origin.device_id,
            "scenario_id": "F07", "synthetic_ground_truth": "fraudulent", "account_ground_truth": "shell_company",
            "sequence_ground_truth": "multi_stage_layering", "scenario_metadata": {"stage": "split_2"}, "is_synthetic": True
        })
        c += 1

        # Stage 2: Funnel into Shell 3
        t2 = base_time + timedelta(minutes=delay_min)
        s1.debit(half_amt)
        s2.debit(half_amt)
        s3.credit(total_amt)
        txns.append({
            "transaction_id": f"{prefix}{c:08d}", "sequence_id": seq_id, "step_index": 2,
            "sender_account": s1.account_id, "receiver_account": s3.account_id, "amount": half_amt,
            "currency": pop.currency, "transaction_type": "LAYERING_MERGE", "channel": "WIRE",
            "timestamp": t2, "scheduled_timestamp": t2, "generated_timestamp": datetime.now(timezone.utc),
            "source_country": s1.country, "dest_country": s3.country, "device_id": s1.device_id,
            "scenario_id": "F07", "synthetic_ground_truth": "fraudulent", "account_ground_truth": "shell_company",
            "sequence_ground_truth": "multi_stage_layering", "scenario_metadata": {"stage": "merge_1"}, "is_synthetic": True
        })
        c += 1

        return txns, c

    def _gen_f08_bursts(self, pop: AccountPopulation, base_time: datetime, prefix: str, c: int, p: dict, rng: random.Random):
        count = int(p.get("burst_count", 10))
        window_sec = int(p.get("burst_window_seconds", 120))
        amt = Decimal(str(p.get("amount_per_txn", 850.0))).quantize(Decimal("0.01"))

        s, r = pop.sample_pair("p2p")
        seq_id = f"SEQ-F08-{c}"
        txns = []

        for i in range(count):
            t_time = base_time + timedelta(seconds=int(i * (window_sec / count)))
            s.debit(amt)
            r.credit(amt)

            txns.append({
                "transaction_id": f"{prefix}{c:08d}", "sequence_id": seq_id, "step_index": i,
                "sender_account": s.account_id, "receiver_account": r.account_id, "amount": amt,
                "currency": pop.currency, "transaction_type": "BURST_TRANSFER", "channel": "MOBILE",
                "timestamp": t_time, "scheduled_timestamp": t_time, "generated_timestamp": datetime.now(timezone.utc),
                "source_country": s.country, "dest_country": r.country, "device_id": s.device_id,
                "scenario_id": "F08", "synthetic_ground_truth": "fraudulent", "account_ground_truth": "burst_attacker",
                "sequence_ground_truth": "high_frequency_burst", "scenario_metadata": {"burst_index": i + 1, "burst_total": count}, "is_synthetic": True
            })
            c += 1

        return txns, c

    def _gen_f09_unusual_amount(self, pop: AccountPopulation, base_time: datetime, prefix: str, c: int, p: dict, rng: random.Random):
        mult = Decimal(str(p.get("amount_multiplier", 30.0)))
        s, r = pop.sample_pair("p2p")
        amt = (s.typical_amount_mean * mult).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        if p.get("round_amount", True):
            amt = Decimal(str(round(float(amt) / 1000.0) * 1000))
        if amt < Decimal("1000.00"):
            amt = Decimal("25000.00")

        s.debit(amt)
        r.credit(amt)

        txns = [{
            "transaction_id": f"{prefix}{c:08d}", "sequence_id": f"SEQ-F09-{c}", "step_index": 0,
            "sender_account": s.account_id, "receiver_account": r.account_id, "amount": amt,
            "currency": pop.currency, "transaction_type": "UNUSUAL_AMOUNT_SPIKE", "channel": "ONLINE",
            "timestamp": base_time, "scheduled_timestamp": base_time, "generated_timestamp": datetime.now(timezone.utc),
            "source_country": s.country, "dest_country": r.country, "device_id": s.device_id,
            "scenario_id": "F09", "synthetic_ground_truth": "fraudulent", "account_ground_truth": "compromised_baseline",
            "sequence_ground_truth": "amount_anomaly", "scenario_metadata": {"baseline_mean": float(s.typical_amount_mean), "multiplier": float(mult)}, "is_synthetic": True
        }]
        return txns, c + 1

    def _gen_f10_takeover(self, pop: AccountPopulation, base_time: datetime, prefix: str, c: int, p: dict, rng: random.Random):
        pct = Decimal(str(p.get("drain_percentage", 90.0)))
        foreign_country = str(p.get("foreign_country", "RU"))
        victim, mule = pop.sample_pair("p2p")

        amt = (victim.balance * pct / Decimal("100.0")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        if amt <= Decimal("0.00"):
            amt = Decimal("8500.00")

        victim.debit(amt)
        mule.credit(amt)
        hijacked_device = f"DEV-SUSP-{rng.randint(100000, 999999)}"

        txns = [{
            "transaction_id": f"{prefix}{c:08d}", "sequence_id": f"SEQ-F10-{c}", "step_index": 0,
            "sender_account": victim.account_id, "receiver_account": mule.account_id, "amount": amt,
            "currency": pop.currency, "transaction_type": "ATO_DRAIN", "channel": "WEB",
            "timestamp": base_time, "scheduled_timestamp": base_time, "generated_timestamp": datetime.now(timezone.utc),
            "source_country": foreign_country, "dest_country": mule.country, "device_id": hijacked_device,
            "scenario_id": "F10", "synthetic_ground_truth": "fraudulent", "account_ground_truth": "account_takeover_victim",
            "sequence_ground_truth": "account_takeover", "scenario_metadata": {"hijacked_device": hijacked_device, "foreign_ip": True}, "is_synthetic": True
        }]
        return txns, c + 1

    def _gen_f11_new_beneficiary(self, pop: AccountPopulation, base_time: datetime, prefix: str, c: int, p: dict, rng: random.Random):
        amt = Decimal(str(p.get("amount", 22000.0))).quantize(Decimal("0.01"))
        dest_country = str(p.get("destination_country", "AE"))
        s, r = pop.sample_pair("p2p")

        s.debit(amt)
        r.credit(amt)

        txns = [{
            "transaction_id": f"{prefix}{c:08d}", "sequence_id": f"SEQ-F11-{c}", "step_index": 0,
            "sender_account": s.account_id, "receiver_account": r.account_id, "amount": amt,
            "currency": pop.currency, "transaction_type": "NEW_BENEFICIARY_TRANSFER", "channel": "ONLINE",
            "timestamp": base_time, "scheduled_timestamp": base_time, "generated_timestamp": datetime.now(timezone.utc),
            "source_country": s.country, "dest_country": dest_country, "device_id": s.device_id,
            "scenario_id": "F11", "synthetic_ground_truth": "fraudulent", "account_ground_truth": "unseen_destination_sender",
            "sequence_ground_truth": "new_beneficiary_drain", "scenario_metadata": {"beneficiary_age_hours": 1}, "is_synthetic": True
        }]
        return txns, c + 1

    def _gen_f12_geo_anomaly(self, pop: AccountPopulation, base_time: datetime, prefix: str, c: int, p: dict, rng: random.Random):
        amt = Decimal(str(p.get("amount", 35000.0))).quantize(Decimal("0.01"))
        src = str(p.get("source_country", "SG"))
        dst = str(p.get("dest_country", "PA"))
        s, r = pop.sample_pair("b2b")

        s.debit(amt)
        r.credit(amt)

        txns = [{
            "transaction_id": f"{prefix}{c:08d}", "sequence_id": f"SEQ-F12-{c}", "step_index": 0,
            "sender_account": s.account_id, "receiver_account": r.account_id, "amount": amt,
            "currency": pop.currency, "transaction_type": "CROSS_BORDER_HIGH_RISK", "channel": "SWIFT",
            "timestamp": base_time, "scheduled_timestamp": base_time, "generated_timestamp": datetime.now(timezone.utc),
            "source_country": src, "dest_country": dst, "device_id": s.device_id,
            "scenario_id": "F12", "synthetic_ground_truth": "fraudulent", "account_ground_truth": "high_risk_jurisdiction_node",
            "sequence_ground_truth": "geo_anomaly", "scenario_metadata": {"sanction_jurisdiction_flag": True}, "is_synthetic": True
        }]
        return txns, c + 1

    def _gen_f13_dormant(self, pop: AccountPopulation, base_time: datetime, prefix: str, c: int, p: dict, rng: random.Random):
        amt = Decimal(str(p.get("reactivation_amount", 40000.0))).quantize(Decimal("0.01"))
        dormant_acc = pop.accounts[pop.dormant_ids[0]] if pop.dormant_ids else pop.accounts[pop.account_ids[0]]
        mule = pop.accounts[pop.account_ids[-1]]

        dormant_acc.debit(amt)
        mule.credit(amt)

        txns = [{
            "transaction_id": f"{prefix}{c:08d}", "sequence_id": f"SEQ-F13-{c}", "step_index": 0,
            "sender_account": dormant_acc.account_id, "receiver_account": mule.account_id, "amount": amt,
            "currency": pop.currency, "transaction_type": "DORMANT_REACTIVATION_OUT", "channel": "WIRE",
            "timestamp": base_time, "scheduled_timestamp": base_time, "generated_timestamp": datetime.now(timezone.utc),
            "source_country": dormant_acc.country, "dest_country": mule.country, "device_id": dormant_acc.device_id,
            "scenario_id": "F13", "synthetic_ground_truth": "fraudulent", "account_ground_truth": "dormant_sleeper",
            "sequence_ground_truth": "dormant_reactivation", "scenario_metadata": {"days_dormant": 210}, "is_synthetic": True
        }]
        return txns, c + 1

    def _gen_f14_velocity(self, pop: AccountPopulation, base_time: datetime, prefix: str, c: int, p: dict, rng: random.Random):
        tpm = int(p.get("txns_per_minute", 15))
        duration = int(p.get("duration_minutes", 2))
        avg_amt = Decimal(str(p.get("avg_amount", 300.0)))
        total_txns = tpm * duration

        s, r = pop.sample_pair("p2p")
        seq_id = f"SEQ-F14-{c}"
        txns = []

        for i in range(total_txns):
            amt = (avg_amt * (Decimal("0.8") + Decimal(str(rng.random() * 0.4)))).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            t_time = base_time + timedelta(seconds=int(i * (duration * 60 / total_txns)))
            s.debit(amt)
            r.credit(amt)

            txns.append({
                "transaction_id": f"{prefix}{c:08d}", "sequence_id": seq_id, "step_index": i,
                "sender_account": s.account_id, "receiver_account": r.account_id, "amount": amt,
                "currency": pop.currency, "transaction_type": "VELOCITY_SPIKE", "channel": "API",
                "timestamp": t_time, "scheduled_timestamp": t_time, "generated_timestamp": datetime.now(timezone.utc),
                "source_country": s.country, "dest_country": r.country, "device_id": s.device_id,
                "scenario_id": "F14", "synthetic_ground_truth": "fraudulent", "account_ground_truth": "scripted_bot_mule",
                "sequence_ground_truth": "velocity_anomaly", "scenario_metadata": {"velocity_tpm": tpm}, "is_synthetic": True
            })
            c += 1

        return txns, c

    def _gen_f15_coordinated(self, pop: AccountPopulation, base_time: datetime, prefix: str, c: int, p: dict, rng: random.Random):
        size = int(p.get("network_size", 5))
        amt = Decimal(str(p.get("amount", 4800.0))).quantize(Decimal("0.01"))
        
        hub = pop.accounts[pop.account_ids[0]]
        senders = [pop.accounts[aid] for aid in pop.account_ids[1:size+1]]
        seq_id = f"SEQ-F15-{c}"
        txns = []

        for i, s in enumerate(senders):
            s.debit(amt)
            hub.credit(amt)
            # Synchronized exact same second
            t_time = base_time + timedelta(seconds=i % 2)

            txns.append({
                "transaction_id": f"{prefix}{c:08d}", "sequence_id": seq_id, "step_index": i,
                "sender_account": s.account_id, "receiver_account": hub.account_id, "amount": amt,
                "currency": pop.currency, "transaction_type": "COORDINATED_SWARM", "channel": "ONLINE",
                "timestamp": t_time, "scheduled_timestamp": t_time, "generated_timestamp": datetime.now(timezone.utc),
                "source_country": s.country, "dest_country": hub.country, "device_id": s.device_id,
                "scenario_id": "F15", "synthetic_ground_truth": "fraudulent", "account_ground_truth": "swarm_bot",
                "sequence_ground_truth": "coordinated_network", "scenario_metadata": {"swarm_id": seq_id}, "is_synthetic": True
            })
            c += 1

        return txns, c

    def _gen_f16_failed_attempts(self, pop: AccountPopulation, base_time: datetime, prefix: str, c: int, p: dict, rng: random.Random):
        fails = int(p.get("failed_count", 4))
        final_amt = Decimal(str(p.get("final_amount", 7500.0))).quantize(Decimal("0.01"))
        s, r = pop.sample_pair("p2p")
        seq_id = f"SEQ-F16-{c}"
        txns = []

        for i in range(fails):
            t_time = base_time + timedelta(seconds=i * 10)
            txns.append({
                "transaction_id": f"{prefix}{c:08d}", "sequence_id": seq_id, "step_index": i,
                "sender_account": s.account_id, "receiver_account": r.account_id, "amount": final_amt,
                "currency": pop.currency, "transaction_type": "FAILED_AUTH_ATTEMPT", "channel": "POS",
                "timestamp": t_time, "scheduled_timestamp": t_time, "generated_timestamp": datetime.now(timezone.utc),
                "source_country": s.country, "dest_country": r.country, "device_id": s.device_id,
                "scenario_id": "F16", "synthetic_ground_truth": "fraudulent", "account_ground_truth": "brute_force_attacker",
                "sequence_ground_truth": "trial_failure_pattern", "scenario_metadata": {"auth_status": "DECLINED_PIN"}, "is_synthetic": True
            })
            c += 1

        # Final Success
        t_succ = base_time + timedelta(seconds=fails * 10 + 15)
        s.debit(final_amt)
        r.credit(final_amt)
        txns.append({
            "transaction_id": f"{prefix}{c:08d}", "sequence_id": seq_id, "step_index": fails,
            "sender_account": s.account_id, "receiver_account": r.account_id, "amount": final_amt,
            "currency": pop.currency, "transaction_type": "SUCCESS_AFTER_FAILED", "channel": "POS",
            "timestamp": t_succ, "scheduled_timestamp": t_succ, "generated_timestamp": datetime.now(timezone.utc),
            "source_country": s.country, "dest_country": r.country, "device_id": s.device_id,
            "scenario_id": "F16", "synthetic_ground_truth": "fraudulent", "account_ground_truth": "brute_force_attacker",
            "sequence_ground_truth": "trial_failure_pattern", "scenario_metadata": {"auth_status": "APPROVED"}, "is_synthetic": True
        })
        c += 1

        return txns, c

    def _gen_f17_duplicate(self, pop: AccountPopulation, base_time: datetime, prefix: str, c: int, p: dict, rng: random.Random):
        dupes = int(p.get("duplicate_count", 3))
        amt = Decimal(str(p.get("amount", 1250.0))).quantize(Decimal("0.01"))
        interval_ms = int(p.get("interval_ms", 200))
        s, r = pop.sample_pair("merchant")
        seq_id = f"SEQ-F17-{c}"
        txns = []

        for i in range(dupes):
            t_time = base_time + timedelta(milliseconds=i * interval_ms)
            s.debit(amt)
            r.credit(amt)

            txns.append({
                "transaction_id": f"{prefix}{c:08d}", "sequence_id": seq_id, "step_index": i,
                "sender_account": s.account_id, "receiver_account": r.account_id, "amount": amt,
                "currency": pop.currency, "transaction_type": "DUPLICATE_SUBMISSION", "channel": "WEB",
                "timestamp": t_time, "scheduled_timestamp": t_time, "generated_timestamp": datetime.now(timezone.utc),
                "source_country": s.country, "dest_country": r.country, "device_id": s.device_id,
                "scenario_id": "F17", "synthetic_ground_truth": "fraudulent", "account_ground_truth": "duplicate_spender",
                "sequence_ground_truth": "idempotency_collision", "scenario_metadata": {"duplicate_attempt": i + 1}, "is_synthetic": True
            })
            c += 1

        return txns, c

    def _gen_f18_synthetic_id(self, pop: AccountPopulation, base_time: datetime, prefix: str, c: int, p: dict, rng: random.Random):
        cluster_size = int(p.get("cluster_size", 4))
        amt = Decimal(str(p.get("amount_per_account", 3200.0))).quantize(Decimal("0.01"))
        shared_device = f"FABRICATED-F18-DEVICE-{rng.randint(1000, 9999)}"
        
        cluster_senders = [pop.accounts[aid] for aid in pop.account_ids[:cluster_size]]
        receiver = pop.accounts[pop.account_ids[-1]]
        seq_id = f"SEQ-F18-{c}"
        txns = []

        for i, s in enumerate(cluster_senders):
            s.debit(amt)
            receiver.credit(amt)
            t_time = base_time + timedelta(minutes=i * 10)

            txns.append({
                "transaction_id": f"{prefix}{c:08d}", "sequence_id": seq_id, "step_index": i,
                "sender_account": s.account_id, "receiver_account": receiver.account_id, "amount": amt,
                "currency": pop.currency, "transaction_type": "SYNTHETIC_ID_DRAIN", "channel": "MOBILE",
                "timestamp": t_time, "scheduled_timestamp": t_time, "generated_timestamp": datetime.now(timezone.utc),
                "source_country": s.country, "dest_country": receiver.country, "device_id": shared_device,
                "scenario_id": "F18", "synthetic_ground_truth": "fraudulent", "account_ground_truth": "synthetic_identity",
                "sequence_ground_truth": "synthetic_id_cluster", "scenario_metadata": {"shared_device": shared_device}, "is_synthetic": True
            })
            c += 1

        return txns, c


# Global singleton registry instance
scenario_registry = FraudScenarioRegistry()
