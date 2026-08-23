"""
patterns.py — 15-pattern detection suite API.

TRACE_LAB_ANALYST only (per product spec: patterns page lives in TraceLab).

    POST /patterns/analyze
        - multipart `file` (.csv or .xlsx)  → run on the upload, OR
        - form `job_id`                     → re-run on that job's stored dataset
        - form `use_dclcg` (default true)   → include DC-LCG GNN pattern
          when a trained artifact exists

Response: uniform 15-block list grouped by tier + summary counts.
"""
from __future__ import annotations

import io
import os

import pandas as pd
from fastapi import (
    APIRouter, Depends, UploadFile, File, Form, HTTPException,
)
from sqlalchemy.orm import Session

from api.deps import get_current_user, get_current_workspace, RoleChecker
from db.database import get_db
from models.user import User
from models.role import Role
from models.analysis_job import AnalysisJob
from models.service_request import ServiceRequest
from detectors.pattern_suite import detect_all_patterns
from utils.csv_parser import parse_csv
from utils.graph import TransactionGraph
from detectors.dclcg import get_latest_artifact, load_artifact, predict_graph

router = APIRouter(prefix="/patterns", tags=["patterns"])

MAX_PATTERN_NODES = 12000


def _df_to_graph(df: pd.DataFrame) -> TransactionGraph:
    df.columns = [str(c).strip().lower() for c in df.columns]

    def find(*keys):
        for k in keys:
            if k in df.columns:
                return k
        for k in keys:
            for c in df.columns:
                if k in c:
                    return c
        return None

    sender_col = find("sender", "src", "origin", "from")
    recv_col = find("receiver", "dest", "target", "to")
    amount_col = find("amount", "value", "amt")
    time_col = find("timestamp", "datetime", "date", "step")

    if not sender_col or not recv_col:
        raise HTTPException(
            status_code=400,
            detail=f"Dataset needs sender/receiver columns. Found: {list(df.columns)}",
        )
    if not amount_col:
        raise HTTPException(
            status_code=400,
            detail=f"Dataset needs an amount column. Found: {list(df.columns)}",
        )

    graph = TransactionGraph()
    skipped = 0
    for _, row in df.iterrows():
        try:
            amount = float(row[amount_col])
        except (TypeError, ValueError):
            skipped += 1
            continue
        sender = str(row[sender_col]).strip()
        receiver = str(row[recv_col]).strip()
        if sender == receiver:
            skipped += 1
            continue
        ts = row[time_col] if time_col else None
        try:
            parsed_ts = pd.to_datetime(ts) if ts is not None else None
        except Exception:
            parsed_ts = None
        timestamp = parsed_ts.to_pydatetime() if parsed_ts is not None else None
        graph.add_transaction(
            sender=sender, receiver=receiver, amount=amount,
            timestamp=timestamp,
        )
    return graph


def _graph_from_upload(contents: bytes, filename: str) -> TransactionGraph:
    ext = os.path.splitext(filename.lower())[1]
    try:
        if ext in {".xlsx", ".xls"}:
            df = pd.read_excel(io.BytesIO(contents))
            return _df_to_graph(df)
        text = contents.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="File must be UTF-8 CSV or Excel.")
    except ImportError:
        raise HTTPException(
            status_code=500,
            detail="Excel support missing on server (openpyxl).",
        )
    return parse_csv(text)


def _dataset_path_for_job(db: Session, org_id: int, job_id: int) -> str:
    job = db.query(AnalysisJob).filter(
        AnalysisJob.id == job_id,
        AnalysisJob.organization_id == org_id,
    ).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    sr_id = (job.meta or {}).get("service_request_id")
    if sr_id:
        sr = db.query(ServiceRequest).filter(
            ServiceRequest.id == sr_id,
            ServiceRequest.organization_id == org_id,
        ).first()
        if sr and sr.dataset_path and os.path.exists(sr.dataset_path):
            return sr.dataset_path
    raise HTTPException(
        status_code=400,
        detail="Stored dataset file unavailable; upload the CSV/Excel instead.",
    )


@router.post("/analyze")
async def run_pattern_suite(
    file: UploadFile | None = File(None),
    job_id: int | None = Form(None),
    use_dclcg: bool = Form(True),
    current_user: User = Depends(RoleChecker([Role.TRACE_LAB_ANALYST.value])),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """Run all 15 pattern detectors on an uploaded dataset or stored job."""
    if not file and not job_id:
        raise HTTPException(
            status_code=400,
            detail="Provide either a dataset file or a job_id.",
        )

    source_label: str
    if file:
        contents = await file.read()
        graph = _graph_from_upload(contents, file.filename)
        source_label = f"upload:{file.filename}"
    else:
        path = _dataset_path_for_job(db, org_id, int(job_id))
        graph = parse_csv(path)
        source_label = f"job:{job_id}"

    if len(graph.nodes) > MAX_PATTERN_NODES:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Dataset too large for pattern suite "
                f"({len(graph.nodes)} nodes; cap {MAX_PATTERN_NODES})."
            ),
        )
    if len(graph.transactions) == 0:
        raise HTTPException(status_code=400, detail="No parsable transactions found.")

    # Optional DC-LCG dimension (flagship ML pattern)
    dclcg_scores = None
    dclcg_meta = None
    dclcg_error = None
    if use_dclcg:
        try:
            artifact_path = get_latest_artifact()
            if artifact_path:
                bundle = load_artifact(artifact_path)
                out = predict_graph(graph, bundle)
                dclcg_scores = out["probs"]
                dclcg_meta = {
                    "model": os.path.basename(artifact_path)[len("dclcg_"):-3],
                }
        except Exception as exc:  # noqa: BLE001
            dclcg_error = str(exc)[:200]

    result = detect_all_patterns(graph, dclcg_scores, dclcg_meta)

    return {
        "source": source_label,
        "total_accounts": len(graph.nodes),
        "total_transactions": len(graph.transactions),
        "dclcg_available": bool(dclcg_scores),
        **({"dclcg_error": dclcg_error} if dclcg_error else {}),
        **result,
    }
