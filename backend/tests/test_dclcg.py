"""
test_dclcg.py — DC-LCG model, registry, API + intel/patterns integration.

Covers:
  - value encoder feature shape
  - WalkGraph pruning + walks
  - DCLCGModel forward (incl. isolated-node NaN regression)
  - weak-supervised train → save → load → predict roundtrip
  - /dclcg/models list
  - analyst-only access control on training
"""
import os
import sys

import numpy as np
import torch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient  # noqa: E402
import pytest  # noqa: E402

from main import app  # noqa: E402
from db.database import get_db  # noqa: E402
from utils.csv_parser import parse_csv  # noqa: E402
from detectors.dclcg.value_encoder import build_value_features  # noqa: E402
from detectors.dclcg.model import WalkGraph, DCLCGModel  # noqa: E402
from detectors.dclcg import train_dclcg, save_artifact, load_artifact, predict_graph  # noqa: E402


def _mule_graph():
    rows = ["sender,receiver,amount,timestamp"]
    i = 0

    def tx(s, r, amt):
        nonlocal i
        i += 1
        rows.append(f"{s},{r},{amt},2024-01-{(i % 28) + 1:02d} 10:00:00")

    for k in range(8):
        tx(f"SRC{k}", f"MULE{1 + k % 3}", 900 + k)
    for k in range(12):
        tx(f"MULE{1 + k % 3}", f"LAYER{1 + k % 3}", 890 - k)
    for k in range(10):
        tx(f"LAYER{1 + k % 3}", f"CASH{k}", 800 + k)
    for k in range(40):
        a, b = np.random.randint(0, 20), np.random.randint(0, 20)
        if a != b:
            tx(f"BGT{a}", f"BGT{b}", 10 + k * 3)
    return parse_csv("\n".join(rows))


# ── unit level ───────────────────────────────────────────────────────────
def test_value_encoder_shape():
    g = _mule_graph()
    accounts, X = build_value_features(g)
    assert X.shape == (len(accounts), 22)
    assert np.isfinite(X).all()


def test_model_forward_no_nan_with_isolated_nodes():
    g = _mule_graph()
    accounts, X = build_value_features(g)
    wg = WalkGraph(accounts, [(t["sender"], t["receiver"]) for t in g.transactions])
    model = DCLCGModel(X.shape[1])
    x = torch.tensor(X)
    soft = torch.rand(len(accounts))
    with torch.no_grad():
        probs, h, c = model(x, soft, wg.neighbors, wg.random_walks(soft.numpy()))
    assert torch.isfinite(probs).all(), "isolated nodes must not poison forward"
    assert ((probs >= 0) & (probs <= 1)).all()


def test_train_save_load_predict_roundtrip(tmp_path):
    g = _mule_graph()
    labels = {a: (1 if ("MULE" in a or "LAYER" in a) else 0) for a in g.nodes}
    model, info = train_dclcg(g, labels=labels, epochs=25)
    path = save_artifact(model, info, "_test_roundtrip")
    try:
        bundle = load_artifact(path)
        out = predict_graph(g, bundle)
        assert set(out["probs"].keys()) == set(g.nodes)
        probs = np.array(list(out["probs"].values()))
        assert np.isfinite(probs).all() and probs.min() >= 0 and probs.max() <= 1
        m = info["metrics"]
        if m.get("f1") is not None:
            assert m["f1"] > 0.5
            assert m["auc"] is None or m["auc"] > 0.5
    finally:
        if os.path.exists(path):
            os.remove(path)


# ── API level ────────────────────────────────────────────────────────────
@pytest.fixture
def client(setup_db):
    def override_get_db():
        yield setup_db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def _login(client, username, password):
    res = client.post("/auth/login", data={"username": username, "password": password})
    assert res.status_code == 200, res.text
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


def test_dclcg_models_requires_auth(client):
    res = client.get("/dclcg/models")
    assert res.status_code in (401, 403)


def test_client_cannot_list_dclcg_models(client):
    headers = _login(client, "client1", "client123")
    res = client.get("/dclcg/models", headers=headers)
    assert res.status_code == 403


def test_analyst_lists_models(client):
    headers = _login(client, "analyst", "analyst123")
    res = client.get("/dclcg/models", headers=headers)
    assert res.status_code == 200
    body = res.json()
    assert "items" in body and "total" in body


def test_pattern_suite_endpoint(client):
    """Analyst runs the full 15-pattern suite on an uploaded CSV."""
    csv_content = (
        "sender,receiver,amount,timestamp\n"
        "A,B,8500,2024-01-01 10:00:00\n"
        "B,C,8500,2024-01-01 10:05:00\n"
        "C,A,8500,2024-01-01 10:10:00\n"
        "D,E,8700,2024-02-01 11:00:00\n"
        "E,D,8700,2024-02-01 11:05:00\n"
        "F,G,100,2024-03-01 09:00:00\n"
        "G,F,100,2024-03-01 09:30:00\n"
        "F,G,100,2024-03-01 10:00:00\n"
        "G,F,100,2024-03-01 10:30:00\n"
        "F,G,100,2024-03-01 11:00:00\n"
        "G,F,100,2024-03-01 11:30:00\n"
        "H,I,5000,2024-04-01 08:00:00\n"
    )
    headers = _login(client, "analyst", "analyst123")
    res = client.post(
        "/patterns/analyze",
        files={"file": ("mini.csv", csv_content.encode("utf-8"), "text/csv")},
        data={"use_dclcg": "false"},
        headers=headers,
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["total_patterns"] == 15
    assert body["tiers"]["basic"] == 5
    assert body["tiers"]["intermediate"] == 5
    assert body["tiers"]["advanced_ml"] == 5
    keys = {p["key"] for p in body["patterns"]}
    assert keys == {
        "circular_transaction", "fan_in", "fan_out", "burst_activity",
        "structuring", "layering_shells", "rapid_movement",
        "night_activity", "periodic_transfers", "dormant_activation",
        "dclcg_gnn", "isolation_forest", "lof", "dbscan_noise",
        "risk_propagation",
    }
    cyc = next(p for p in body["patterns"] if p["key"] == "circular_transaction")
    assert cyc["flagged_count"] >= 3


def test_pattern_suite_rejects_client(client):
    headers = _login(client, "client1", "client123")
    res = client.post(
        "/patterns/analyze",
        files={"file": ("x.csv", b"sender,receiver,amount\nA,B,1\n", "text/csv")},
        headers=headers,
    )
    assert res.status_code == 403


def test_pattern_suite_excel_upload(client):
    """Same suite must accept .xlsx uploads (openpyxl installed)."""
    import pandas as pd
    from io import BytesIO

    df = pd.DataFrame([
        {"sender": "S1", "receiver": "M1", "amount": 8900,
         "timestamp": "2024-01-01 10:00:00"},
        {"sender": "S2", "receiver": "M1", "amount": 8950,
         "timestamp": "2024-01-01 10:10:00"},
        {"sender": "M1", "receiver": "OUT1", "amount": 17800,
         "timestamp": "2024-01-01 10:20:00"},
    ])
    buf = BytesIO()
    df.to_excel(buf, index=False)
    buf.seek(0)

    headers = _login(client, "analyst", "analyst123")
    res = client.post(
        "/patterns/analyze",
        files={"file": ("sheet.xlsx", buf.getvalue(),
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        data={"use_dclcg": "false"},
        headers=headers,
    )
    assert res.status_code == 200, res.text
    assert res.json()["total_patterns"] == 15


def test_analysis_auto_stores_technical_report(client, setup_db):
    """
    Completed SR-linked analyses must automatically refresh a DRAFT
    TechnicalReport with the analysis findings (incl. DC-LCG block).
    Re-running analysis updates the SAME draft instead of duplicating.
    """
    from models.technical_report import TechnicalReport

    csv_content = (
        "sender,receiver,amount,timestamp\n"
        "A,B,8500,2024-01-01 10:00:00\n"
        "B,C,8500,2024-01-01 10:05:00\n"
        "C,A,8500,2024-01-01 10:10:00\n"
    )

    admin_h = _login(client, "admin", "admin123")
    res = client.post(
        "/service-requests",
        headers=admin_h,
        json={"title": "Auto-report test", "description": "x",
              "request_type": "ANALYSIS"},
    )
    assert res.status_code == 201, res.text
    sr_id = res.json()["id"]

    res = client.post(
        f"/service-requests/{sr_id}/upload",
        headers=admin_h,
        files={"file": ("auto.csv", csv_content.encode(), "text/csv")},
    )
    assert res.status_code == 200, res.text

    analyst_h = _login(client, "analyst", "analyst123")

    def run_analysis():
        return client.post(
            "/analyze/advanced",
            headers=analyst_h,
            files={"file": ("auto.csv", csv_content.encode(), "text/csv")},
            data={"use_dclcg": "false",
                  "service_request_id": str(sr_id)},
        )

    res = run_analysis()
    assert res.status_code == 200, res.text
    job_id_1 = res.json()["job_id"]

    reports = setup_db.query(TechnicalReport).all()
    assert len(reports) == 1
    rep = reports[0]
    assert rep.service_request_id == sr_id
    assert rep.analysis_job_id == job_id_1
    assert rep.status == "DRAFT"
    assert rep.dataset_summary["filename"] == "auto.csv"
    assert rep.risk_level in {"LOW", "MEDIUM", "HIGH", "CRITICAL"}
    assert rep.ml_findings["dclcg_dimension_used"] is False
    assert f"#{job_id_1}" in rep.conclusion

    # Second analysis refreshes the same DRAFT
    res = run_analysis()
    assert res.status_code == 200
    job_id_2 = res.json()["job_id"]

    setup_db.expire_all()
    reports = setup_db.query(TechnicalReport).all()
    assert len(reports) == 1, "draft must be refreshed, not duplicated"
    assert reports[0].analysis_job_id == job_id_2
    assert f"#{job_id_2}" in reports[0].conclusion
