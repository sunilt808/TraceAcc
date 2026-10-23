"""
test_ml_audit_and_optimization.py — Test suite verifying ML pipeline fixes and enhancements.

Covers:
1. FeatureScaler fit/transform, serialization (to_dict/from_dict) and transform invariance.
2. Label ingestion policy: no label flipping/overwriting on senders, explicit counterparty rules.
3. Screening engine precision: paired amount pass-through matching and single-use consumption.
4. DecisionEngine synergistic risk scoring and monotonic calibration.
5. End-to-end model training, artifact bundle persistence with scaler, and predict_graph roundtrip.
"""
import os
import sys
from datetime import datetime, timezone, timedelta
import numpy as np
import pytest
import torch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from utils.graph import TransactionGraph
from utils.csv_parser import parse_csv
from detectors.dclcg.value_encoder import build_value_features, FeatureScaler
from detectors.dclcg.model import WalkGraph, DCLCGModel
from detectors.dclcg import train_dclcg, save_artifact, load_artifact, predict_graph
from services.liveshield.screening import FastScreeningEngine, AccountRollingStats
from services.liveshield.decision_engine import DecisionEngine
from api.routes.dclcg import _graph_from_labeled_csv
import pandas as pd


def test_feature_scaler_fit_transform_and_serialization():
    X_train = np.array([
        [1.0, 100.0, 5.0] + [0.0] * 19,
        [2.0, 500.0, 10.0] + [1.0] * 19,
        [3.0, 10000.0, 25.0] + [0.5] * 19,
    ], dtype=np.float32)

    scaler = FeatureScaler()
    X_scaled = scaler.fit_transform(X_train)

    assert X_scaled.shape == X_train.shape
    assert np.allclose(X_scaled.mean(axis=0), 0.0, atol=1e-5)
    assert np.all(np.isfinite(X_scaled))

    state = scaler.to_dict()
    assert "mean" in state
    assert "scale" in state

    restored_scaler = FeatureScaler.from_dict(state)
    X_test = np.array([[2.0, 500.0, 10.0] + [1.0] * 19], dtype=np.float32)
    t1 = scaler.transform(X_test)
    t2 = restored_scaler.transform(X_test)
    assert np.allclose(t1, t2)


def test_label_ingestion_policy():
    data = [
        {"sender": "ACC1", "receiver": "MULE1", "amount": 9000.0, "timestamp": "2026-09-25 10:00:00", "is_fraud": 1, "scenario_type": "mule_pass_through"},
        {"sender": "ACC1", "receiver": "LEGIT1", "amount": 50.0, "timestamp": "2026-09-25 10:05:00", "is_fraud": 0, "scenario_type": "legitimate"},
        {"sender": "LEGIT2", "receiver": "ACC1", "amount": 100.0, "timestamp": "2026-09-25 10:10:00", "is_fraud": 0, "scenario_type": "legitimate"},
    ]
    df = pd.DataFrame(data)
    graph, labels = _graph_from_labeled_csv(df)

    assert labels["ACC1"] == 1
    assert labels["MULE1"] == 1
    assert labels["LEGIT1"] == 0
    assert labels["LEGIT2"] == 0


def test_screening_precision_and_passthrough():
    screening = FastScreeningEngine({
        "velocity_1m_limit": 15,
        "passthrough_window_sec": 120.0,
    })

    txn_in = {
        "sender_account": "SOURCE_1",
        "receiver_account": "MULE_A",
        "amount": 5000.0,
        "timestamp": datetime(2026, 9, 25, 12, 0, 0, tzinfo=timezone.utc),
    }
    s_score_in, signals_in = screening.screen_transaction(txn_in)

    txn_out1 = {
        "sender_account": "MULE_A",
        "receiver_account": "CASH_OUT",
        "amount": 4800.0,
        "timestamp": datetime(2026, 9, 25, 12, 0, 30, tzinfo=timezone.utc),
    }
    s_score_out1, signals_out1 = screening.screen_transaction(txn_out1)
    pass_through_signals = [s for s in signals_out1 if s["rule_id"] == "R03_RAPID_PASSTHROUGH"]
    assert len(pass_through_signals) == 1
    assert s_score_out1 >= 0.70

    txn_out2 = {
        "sender_account": "MULE_A",
        "receiver_account": "MERCHANT",
        "amount": 50.0,
        "timestamp": datetime(2026, 9, 25, 12, 1, 0, tzinfo=timezone.utc),
    }
    s_score_out2, signals_out2 = screening.screen_transaction(txn_out2)
    pt2 = [s for s in signals_out2 if s["rule_id"] == "R03_RAPID_PASSTHROUGH"]
    assert len(pt2) == 0


def test_decision_engine_synergistic_risk():
    engine = DecisionEngine(detection_mode="automated", config={
        "flag_threshold": 0.35,
        "hold_threshold": 0.65,
        "reject_threshold": 0.85,
    })

    risk_score, tier = engine.calculate_combined_risk(fast_score=0.20, dclcg_score=0.80, hist_risk=0.10)
    assert risk_score >= 0.65
    assert tier in ["HIGH", "CRITICAL"]

    clean_score, clean_tier = engine.calculate_combined_risk(fast_score=0.05, dclcg_score=0.05, hist_risk=0.0)
    assert clean_score <= 0.15
    assert clean_tier == "LOW"


def test_dclcg_train_artifact_save_and_inference():
    g = TransactionGraph()
    for i in range(10):
        g.add_transaction(f"USER_{i}", f"USER_{(i+1)%10}", 100.0 + i * 50, datetime(2026, 9, 25, 10, i, 0, tzinfo=timezone.utc))
    g.add_transaction("FRAUD_1", "FRAUD_2", 9500.0, datetime(2026, 9, 25, 10, 15, 0, tzinfo=timezone.utc))

    labels = {f"USER_{i}": 0 for i in range(10)}
    labels["FRAUD_1"] = 1
    labels["FRAUD_2"] = 1

    model, info = train_dclcg(g, labels, epochs=5, seed=42)
    assert "scaler" in info
    assert info["scaler"]["mean"] is not None

    path = save_artifact(model, info, "test_roundtrip")
    assert os.path.exists(path)

    bundle = load_artifact(path)
    assert "scaler" in bundle
    assert bundle["scaler"] is not None

    results = predict_graph(g, bundle)
    assert "probs" in results
    assert "disguise" in results
    assert len(results["probs"]) == len(g.nodes)

    try:
        os.remove(path)
    except Exception:
        pass
