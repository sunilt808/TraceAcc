"""
presets.py — Built-in configuration presets for TraceAcc LiveShield.
"""
from typing import List, Dict, Any

BUILTIN_PRESETS: List[Dict[str, Any]] = [
    {
        "name": "Normal Banking Day",
        "description": "Predominantly legitimate retail & business banking traffic with low baseline anomaly rate (95/5 mix).",
        "mode": "basic",
        "is_builtin": True,
        "config": {
            "mode": "basic",
            "total_transactions": 2000,
            "target_tps": 50.0,
            "traffic_composition": "mixed",
            "legitimate_percentage": 95.0,
            "fraudulent_percentage": 5.0,
            "fraud_selection_mode": "selected",
            "selected_scenarios": ["F01", "F08", "F09"],
            "min_amount": 5.0,
            "max_amount": 8000.0,
            "num_accounts": 100,
            "currency": "USD",
            "txn_prefix": "NBD",
        }
    },
    {
        "name": "100-TPS Balanced Benchmark (80/20 Split)",
        "description": "Standard compliance evaluation run generating 100 TPS with an 80% legitimate / 20% fraudulent distribution across core typologies.",
        "mode": "basic",
        "is_builtin": True,
        "config": {
            "mode": "basic",
            "total_transactions": 3000,
            "target_tps": 100.0,
            "traffic_composition": "mixed",
            "legitimate_percentage": 80.0,
            "fraudulent_percentage": 20.0,
            "fraud_selection_mode": "all",
            "selected_scenarios": ["F01", "F02", "F03", "F04", "F05", "F06"],
            "min_amount": 10.0,
            "max_amount": 25000.0,
            "num_accounts": 150,
            "currency": "USD",
            "txn_prefix": "BMK",
        }
    },
    {
        "name": "Fraud-Only Typology Stress Run",
        "description": "100% fraudulent synthetic traffic spanning all 18 typologies (F01–F18) to test detector sensitivity.",
        "mode": "advanced",
        "is_builtin": True,
        "config": {
            "mode": "advanced",
            "total_transactions": 2500,
            "target_tps": 75.0,
            "traffic_pattern": "constant",
            "traffic_composition": "fraudulent_only",
            "legitimate_percentage": 0.0,
            "fraudulent_percentage": 100.0,
            "composition_mode": "exact",
            "scenarios": [
                {"scenario_id": f"F{i:02d}", "enabled": True, "weight": 5.5} for i in range(1, 19)
            ],
            "num_accounts": 120,
            "currency": "USD",
            "txn_prefix": "FRD",
        }
    },
    {
        "name": "High-Volume Burst & Stress Test",
        "description": "500 TPS enterprise volume with periodic 2.5x burst spikes and high velocity account transfers.",
        "mode": "advanced",
        "is_builtin": True,
        "config": {
            "mode": "advanced",
            "total_transactions": 10000,
            "target_tps": 500.0,
            "traffic_pattern": "burst",
            "burst_size": 100,
            "burst_interval_seconds": 20,
            "traffic_composition": "mixed",
            "legitimate_percentage": 85.0,
            "fraudulent_percentage": 15.0,
            "composition_mode": "exact",
            "scenarios": [
                {"scenario_id": "F08", "enabled": True, "weight": 40.0},
                {"scenario_id": "F14", "enabled": True, "weight": 30.0},
                {"scenario_id": "F15", "enabled": True, "weight": 30.0},
            ],
            "num_accounts": 500,
            "currency": "USD",
            "txn_prefix": "STR",
        }
    },
    {
        "name": "Mule-Network & Multi-Hop Ring Suite",
        "description": "Focuses on complex network structures including cycles, 5-hop chains, multi-stage layering, and fan hubs.",
        "mode": "advanced",
        "is_builtin": True,
        "config": {
            "mode": "advanced",
            "total_transactions": 3500,
            "target_tps": 60.0,
            "traffic_pattern": "constant",
            "traffic_composition": "mixed",
            "legitimate_percentage": 70.0,
            "fraudulent_percentage": 30.0,
            "composition_mode": "exact",
            "scenarios": [
                {"scenario_id": "F03", "enabled": True, "weight": 20.0},
                {"scenario_id": "F04", "enabled": True, "weight": 20.0},
                {"scenario_id": "F05", "enabled": True, "weight": 25.0},
                {"scenario_id": "F06", "enabled": True, "weight": 20.0},
                {"scenario_id": "F07", "enabled": True, "weight": 15.0},
            ],
            "num_accounts": 200,
            "currency": "USD",
            "txn_prefix": "NET",
        }
    },
    {
        "name": "Custom Blank Canvas",
        "description": "Clean template with default settings ready for customized parameter tuning and schedule definition.",
        "mode": "basic",
        "is_builtin": True,
        "config": {
            "mode": "basic",
            "total_transactions": 1000,
            "target_tps": 50.0,
            "traffic_composition": "mixed",
            "legitimate_percentage": 80.0,
            "fraudulent_percentage": 20.0,
            "fraud_selection_mode": "all",
            "selected_scenarios": ["F01", "F02", "F03", "F04", "F05", "F06"],
            "min_amount": 10.0,
            "max_amount": 10000.0,
            "num_accounts": 60,
            "currency": "USD",
            "txn_prefix": "TXN",
        }
    }
]
