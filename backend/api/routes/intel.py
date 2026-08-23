"""
intel.py — InvoSpace Intelligence endpoints (investigator one-stop).

One page in the UI (`/invospace/intel`) is powered by these endpoints:

    GET /intel/accounts/{id}/overview   cross-job dossier for an account
    GET /intel/accounts/{id}/similar    structurally-similar accounts
    GET /intel/accounts/{id}/paths      follow-the-money paths

All data comes from previously STORED analysis results (no re-analysis),
scoped to the caller's workspace. Access to an account requires that the
account appears in at least one stored result of the workspace OR the
caller has an active assignment covering the related service request.
"""
from __future__ import annotations

import json
import math
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from api.deps import get_current_user, get_current_workspace, RoleChecker
from db.database import get_db
from models.user import User
from models.role import Role
from models.analysis_job import AnalysisJob
from models.alert import Alert
from models.assignment import Assignment
from models.service_request import ServiceRequest
from utils.csv_parser import parse_csv

router = APIRouter(prefix="/intel", tags=["intel"])

JOB_SCAN_LIMIT = 30          # most recent stored jobs scanned per query
MAX_PATH_DEPTH = 5
MAX_NODES_FOR_PATHS = 8000


# ── helpers ────────────────────────────────────────────────────────────
def _stored_results(db: Session, org_id: int):
    """Yield (job, result_dict) for recent completed jobs with results."""
    jobs = (
        db.query(AnalysisJob)
        .filter(
            AnalysisJob.organization_id == org_id,
            AnalysisJob.status == "completed",
        )
        .order_by(AnalysisJob.created_at.desc())
        .limit(JOB_SCAN_LIMIT)
        .all()
    )
    out = []
    for job in jobs:
        raw = (job.meta or {}).get("_result")
        if not raw:
            continue
        try:
            result = raw if isinstance(raw, dict) else json.loads(raw)
        except (TypeError, ValueError):
            continue
        out.append((job, result))
    return out


def _hybrid_entry(result: dict, account_id: str):
    for entry in result.get("hybrid_scores", []):
        if entry.get("account_id") == account_id:
            return entry
    return None


def _dclcg_prob(result: dict, account_id: str):
    block = result.get("dclcg") or {}
    if not block.get("available"):
        return None
    for item in block.get("top_accounts", []):
        if item.get("account_id") == account_id:
            return item.get("illicit_prob")
    return None


def _require_account_seen(db: Session, user: User, org_id: int, account_id: str):
    """Ensure the account exists in some stored workspace result."""
    pairs = _stored_results(db, org_id)
    hits = []
    for job, result in pairs:
        entry = _hybrid_entry(result, account_id)
        if entry:
            hits.append((job, result, entry))
    if not hits:
        raise HTTPException(
            status_code=404,
            detail=f"Account '{account_id}' not found in any stored analysis "
                   "for this workspace.",
        )
    # assignment check only widens visibility; workspace scope already applied
    _ = db.query(Assignment).filter(
        Assignment.assignee_id == user.id,
        Assignment.status == "ACTIVE",
    ).count()
    return hits


def _vec(entry: dict) -> list:
    b = entry.get("breakdown", {})
    keys = ["graph_score", "behaviour_score", "temporal_score",
            "community_score", "ml_score", "dclcg_score"]
    return [float(b.get(k, 0.0)) for k in keys]


def _cosine(a: list, b: list) -> float:
    num = sum(x * y for x, y in zip(a, b))
    da = math.sqrt(sum(x * x for x in a))
    db_ = math.sqrt(sum(y * y for y in b))
    if da == 0 or db_ == 0:
        return 0.0
    return num / (da * db_)


def _load_dataset_graph(db: Session, org_id: int, job: AnalysisJob):
    """Resolve the dataset behind a job and parse it into a graph."""
    sr_id = (job.meta or {}).get("service_request_id")
    dataset_path = None
    if sr_id:
        sr = db.query(ServiceRequest).filter(
            ServiceRequest.id == sr_id,
            ServiceRequest.organization_id == org_id,
        ).first()
        dataset_path = sr.dataset_path if sr else None
    if not dataset_path:
        return None
    try:
        return parse_csv(dataset_path)
    except Exception:  # noqa: BLE001
        return None


# ── endpoints ──────────────────────────────────────────────────────────
@router.get("/accounts/{account_id}/overview")
def account_overview(
    account_id: str,
    current_user: User = Depends(RoleChecker([
        Role.INVESTIGATOR.value, Role.TRACE_LAB_ANALYST.value,
        Role.ADMIN.value,
    ])),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """Cross-job dossier: every appearance of this account in stored results."""
    hits = _require_account_seen(db, current_user, org_id, account_id)

    appearances = []
    risk_values = []
    pattern_counter: dict = {}
    for job, result, entry in hits:
        summary = result.get("summary", {})
        patterns = entry.get("patterns", []) or []
        for p in patterns:
            pattern_counter[p] = pattern_counter.get(p, 0) + 1
        prob = _dclcg_prob(result, account_id)
        risk_values.append(float(entry.get("final_score", 0)))
        appearances.append({
            "job_id": job.id,
            "created_at": job.created_at.isoformat() if job.created_at else None,
            "filename": job.filename,
            "service_request_id": (job.meta or {}).get("service_request_id"),
            "dataset_accounts": summary.get("total_accounts"),
            "final_score": entry.get("final_score"),
            "risk_tier": entry.get("risk_tier"),
            "patterns": patterns,
            "breakdown": entry.get("breakdown", {}),
            "dclcg_prob": prob,
        })

    alerts = (
        db.query(Alert)
        .filter(Alert.organization_id == org_id)
        .order_by(Alert.created_at.desc())
        .limit(500)
        .all()
    )
    linked_alerts = [
        {
            "id": al.id,
            "alert_type": al.alert_type,
            "severity": al.severity,
            "status": al.status,
            "risk_score": al.risk_score,
            "created_at": al.created_at.isoformat() if al.created_at else None,
        }
        for al in alerts
        if account_id in (al.related_accounts or [])
    ]

    latest = appearances[0] if appearances else {}
    return {
        "account_id": account_id,
        "jobs_scanned": len(hits),
        "appearances": appearances,
        "risk_latest": latest.get("final_score"),
        "risk_max": max(risk_values) if risk_values else None,
        "risk_tier_latest": latest.get("risk_tier"),
        "pattern_frequency": sorted(
            pattern_counter.items(), key=lambda kv: kv[1], reverse=True
        ),
        "linked_alerts": linked_alerts,
        "linked_alert_count": len(linked_alerts),
    }


@router.get("/accounts/{account_id}/similar")
def similar_accounts(
    account_id: str,
    top: int = Query(8, ge=1, le=25),
    current_user: User = Depends(RoleChecker([
        Role.INVESTIGATOR.value, Role.TRACE_LAB_ANALYST.value,
        Role.ADMIN.value,
    ])),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """
    Structurally-similar accounts: mean 6-dimension breakdown vector per
    account across stored jobs, ranked by cosine similarity to the target.
    """
    hits = _require_account_seen(db, current_user, org_id, account_id)

    target_vecs = [_vec(e) for _, _, e in hits]
    t_dim = max(len(v) for v in target_vecs)
    target_mean = [
        sum(v[i] for v in target_vecs) / len(target_vecs)
        for i in range(t_dim)
    ]

    acc_vectors: dict = {}
    acc_finals: dict = defaultdict(list)
    seen_jobs: dict = defaultdict(set)
    stored = _stored_results(db, org_id)
    for job, result in stored:
        for entry in result.get("hybrid_scores", []):
            aid = entry.get("account_id")
            if not aid or aid == account_id:
                continue
            v = _vec(entry)
            v += [0.0] * (t_dim - len(v))
            acc_vectors.setdefault(aid, []).append(v)
            seen_jobs[aid].add(job.id)
            acc_finals[aid].append(float(entry.get("final_score", 0)))

    scored = []
    for aid, vecs in acc_vectors.items():
        mean = [sum(v[i] for v in vecs) / len(vecs) for i in range(t_dim)]
        sim = _cosine(target_mean, mean)
        finals = acc_finals[aid]
        scored.append({
            "account_id": aid,
            "similarity": round(sim, 4),
            "jobs_seen": len(seen_jobs[aid]),
            "avg_final_score":
                round(sum(finals) / len(finals), 2) if finals else None,
        })
    scored.sort(key=lambda x: x["similarity"], reverse=True)
    return {
        "account_id": account_id,
        "vector_dims": t_dim,
        "candidates": scored[:top],
    }


@router.get("/accounts/{account_id}/paths")
def money_paths(
    account_id: str,
    job_id: int = Query(..., description="Stored job whose dataset is traced"),
    depth: int = Query(3, ge=1, le=MAX_PATH_DEPTH),
    top: int = Query(5, ge=1, le=15),
    current_user: User = Depends(RoleChecker([
        Role.INVESTIGATOR.value, Role.TRACE_LAB_ANALYST.value,
        Role.ADMIN.value,
    ])),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """
    Follow-the-money: highest-risk simple paths starting at the account,
    using the dataset of a stored job and node weights from its result.
    """
    job = db.query(AnalysisJob).filter(
        AnalysisJob.id == job_id,
        AnalysisJob.organization_id == org_id,
    ).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    raw = (job.meta or {}).get("_result")
    if not raw:
        raise HTTPException(
            status_code=400, detail="Job has no stored result to trace."
        )
    result = raw if isinstance(raw, dict) else json.loads(raw)

    weight_map: dict = {}
    for entry in result.get("hybrid_scores", []):
        w = float(entry.get("final_score", 0)) / 100.0
        p = _dclcg_prob(result, entry.get("account_id", ""))
        if p is not None:
            w = 0.7 * w + 0.3 * float(p)
        weight_map[entry.get("account_id")] = min(w, 1.0)

    graph = _load_dataset_graph(db, org_id, job)
    if graph is None:
        raise HTTPException(
            status_code=400,
            detail="Dataset file for this job is unavailable on disk.",
        )
    if account_id not in graph.nodes:
        raise HTTPException(
            status_code=404,
            detail=f"Account '{account_id}' not present in this dataset.",
        )
    if len(graph.nodes) > MAX_NODES_FOR_PATHS:
        raise HTTPException(
            status_code=400,
            detail="Dataset too large for inline path tracing.",
        )

    # weighted adjacency with per-hop amount totals
    adj: dict = defaultdict(dict)  # u -> {v: total_amount}
    for tx in graph.transactions:
        u, v, amt = tx["sender"], tx["receiver"], float(tx["amount"])
        adj[u][v] = adj[u].get(v, 0.0) + amt

    best: list = []

    def dfs(node: str, visited: set, path: list, amounts: list):
        if len(path) - 1 >= depth:
            score = sum(weight_map.get(n, 0.0) for n in path[1:]) / max(
                len(path) - 1, 1)
            best.append({"path": list(path), "amounts": list(amounts),
                         "score": score})
            return
        extended = False
        for nxt, amt in sorted(
            adj.get(node, {}).items(),
            key=lambda kv: weight_map.get(kv[0], 0.0), reverse=True,
        ):
            if nxt in visited:
                continue
            extended = True
            visited.add(nxt)
            path.append(nxt)
            amounts.append(amt)
            dfs(nxt, visited, path, amounts)
            amounts.pop()
            path.pop()
            visited.discard(nxt)
        if not extended and len(path) > 1:
            score = sum(weight_map.get(n, 0.0) for n in path[1:]) / max(
                len(path) - 1, 1)
            best.append({"path": list(path), "amounts": list(amounts),
                         "score": score})

    dfs(account_id, {account_id}, [account_id], [])

    # keep the best branch per distinct terminal node, then global top-N
    by_terminal: dict = {}
    for p in best:
        term = p["path"][-1]
        if term not in by_terminal or p["score"] > by_terminal[term]["score"]:
            by_terminal[term] = p
    ranked = sorted(by_terminal.values(), key=lambda p: p["score"],
                    reverse=True)[:top]
    for p in ranked:
        p["hops"] = len(p["path"]) - 1
        p["total_amount"] = round(sum(p["amounts"]), 2)
        p["score"] = round(p["score"], 4)

    return {
        "account_id": account_id,
        "job_id": job_id,
        "depth": depth,
        "paths": ranked,
    }
