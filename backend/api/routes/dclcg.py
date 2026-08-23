"""
dclcg.py — DC-LCG model registry + training API.

Endpoints (TRACE_LAB_ANALYST / ADMIN):
    GET  /dclcg/models            list registered model artifacts
    GET  /dclcg/models/{name}     one artifact's config + metrics
    POST /dclcg/train             train on an uploaded LABELED CSV
                                  (sender, receiver, amount, timestamp, label)

Training is synchronous and capped at 8,000 nodes / 200k rows — sized for
the project's demo + benchmark workflows, not cluster-scale runs.
"""
from __future__ import annotations

import io
import os

import pandas as pd
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session

from api.deps import get_current_user, RoleChecker
from db.database import get_db
from models.user import User
from models.role import Role
from detectors.dclcg import (
    train_dclcg,
    save_artifact,
    list_models,
    load_artifact,
)
from utils.graph import TransactionGraph

router = APIRouter(prefix="/dclcg", tags=["dclcg"])

MAX_TRAIN_NODES = 8000
MAX_TRAIN_ROWS = 200_000


def _graph_from_labeled_csv(content: str):
    """
    Parse a labeled transaction CSV into (TransactionGraph, labels).

    Recognized label values: 1/0, true/false, illicit/licit, yes/no,
    fraud/normal (case-insensitive). Rows without a parsable label are
    treated as licit.
    """
    df = pd.read_csv(io.StringIO(content), low_memory=False)
    df.columns = [c.strip().lower() for c in df.columns]

    def find(*keys):
        for k in keys:
            for c in df.columns:
                if c == k:
                    return c
        for k in keys:
            for c in df.columns:
                if k in c:
                    return c
        return None

    sender_col = find("sender", "src", "origin", "from")
    recv_col = find("receiver", "dest", "target", "to")
    amount_col = find("amount", "value", "amt")
    time_col = find("timestamp", "datetime", "date", "step")
    label_col = find("label", "class", "is_fraud", "illicit")

    if not sender_col or not recv_col:
        raise HTTPException(
            status_code=400,
            detail=f"CSV needs sender/receiver columns. Found: {list(df.columns)}",
        )
    if not amount_col:
        raise HTTPException(
            status_code=400,
            detail=f"CSV needs an amount column. Found: {list(df.columns)}",
        )

    if len(df) > MAX_TRAIN_ROWS:
        raise HTTPException(
            status_code=400,
            detail=f"Training CSV too large ({len(df)} rows; cap {MAX_TRAIN_ROWS}).",
        )

    from datetime import datetime

    graph = TransactionGraph()
    labels: dict = {}
    base = datetime(2025, 1, 1)

    for i, row in df.iterrows():
        try:
            amount = float(row[amount_col])
        except (TypeError, ValueError):
            continue
        sender = str(row[sender_col]).strip()
        receiver = str(row[recv_col]).strip()
        if sender == receiver:
            continue
        ts = row[time_col] if time_col else None
        try:
            parsed_ts = pd.to_datetime(ts) if ts is not None else None
        except Exception:
            parsed_ts = None
        timestamp = parsed_ts.to_pydatetime() if parsed_ts is not None else (
            base + __import__("datetime").timedelta(minutes=i)
        )
        graph.add_transaction(
            sender=sender, receiver=receiver, amount=amount, timestamp=timestamp
        )

        if label_col is not None:
            raw = str(row[label_col]).strip().lower()
            labels[sender] = 1 if raw in {
                "1", "true", "illicit", "fraud", "yes", "bad"} else 0
            labels[receiver] = labels.get(receiver, 0) or (
                1 if raw in {"1", "true", "illicit", "fraud", "yes", "bad"} else 0
            )

    if len(graph.nodes) > MAX_TRAIN_NODES:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Graph too large for inline training "
                f"({len(graph.nodes)} nodes; cap {MAX_TRAIN_NODES})."
            ),
        )
    return graph, labels


@router.get("/models")
def list_dclcg_models(
    current_user: User = Depends(RoleChecker([
        Role.TRACE_LAB_ANALYST.value, Role.ADMIN.value,
    ])),
):
    """All DC-LCG artifacts in the registry (newest first)."""
    models = list_models()
    latest = models[0]["name"] if models else None
    for m in models:
        m["is_latest"] = m["name"] == latest
    return {"total": len(models), "items": models}


@router.get("/models/{name}")
def get_dclcg_model(
    name: str,
    current_user: User = Depends(RoleChecker([
        Role.TRACE_LAB_ANALYST.value, Role.ADMIN.value,
    ])),
):
    models = {m["name"]: m for m in list_models()}
    if name not in models:
        raise HTTPException(status_code=404, detail="Model artifact not found.")
    entry = models[name]
    bundle = load_artifact(entry["file"])
    accounts = bundle.get("accounts", [])
    return {
        **entry,
        "sample_accounts": accounts[:20],
        "config": bundle.get("config", {}),
    }


@router.post("/train")
async def train_dclcg_model(
    request_file: UploadFile = File(...),
    model_name: str = Form(...),
    epochs: int = Form(20),
    current_user: User = Depends(RoleChecker([
        Role.TRACE_LAB_ANALYST.value, Role.ADMIN.value,
    ])),
    db: Session = Depends(get_db),
):
    """
    Train a DC-LCG dual-view model on a labeled CSV.

    Label column (any of: label/class/is_fraud/illicit) marks illicit rows.
    Without a recognizable label column the run falls back to weak
    supervision bootstrapped from the heuristic engine.
    """
    if not request_file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are accepted.")
    epochs = max(2, min(int(epochs), 100))

    contents = await request_file.read()
    try:
        text = contents.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="CSV must be UTF-8 encoded.")

    graph, labels = _graph_from_labeled_csv(text)
    supervised = bool(labels)

    try:
        model, info = train_dclcg(
            graph,
            labels=labels or None,
            epochs=epochs,
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=500, detail=f"DC-LCG training failed: {exc}"
        )

    safe_name = "".join(c for c in model_name if c.isalnum() or c in "-_")[:60]
    path = save_artifact(model, info, safe_name or "adhoc")

    return {
        "status": "trained",
        "model": os.path.basename(path)[len("dclcg_"):-3],
        "supervised": supervised,
        "n_accounts": info["n_accounts"],
        "n_transactions": info["n_transactions"],
        "epochs": epochs,
        "metrics": info["metrics"],
        "loss_history_tail": info["loss_history"],
    }
