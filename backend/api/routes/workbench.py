"""
workbench.py — Role-aware workbench aggregation API.

One call per workspace returns everything its overview page needs:

  GET /workbench/analyst       (TRACE_LAB_ANALYST / ADMIN)
      - my assigned service requests (stage + status)
      - alert queue grouped by status
      - recent analysis jobs
      - risk trend across last jobs
      - KPI counters

  GET /workbench/investigator  (INVESTIGATOR / ADMIN)
      - alerts routed to me awaiting case conversion
      - my open cases with artifact progress
      - task board summary
      - decision pipeline stats
"""
from fastapi import APIRouter, Depends
from sqlalchemy import func as sa_func
from sqlalchemy.orm import Session

from api.deps import get_current_user, get_current_workspace
from db.database import get_db
from models.user import User
from models.role import Role
from core.permissions import require_any_permission
from models.service_request import ServiceRequest
from models.workflow_instance import WorkflowInstance
from models.alert import Alert
from models.case import Case
from models.analysis_job import AnalysisJob
from models.investigation_task import InvestigationTask
from models.investigation_finding import InvestigationFinding
from models.investigation_hypothesis import InvestigationHypothesis
from models.evidence import Evidence

router = APIRouter(prefix="/workbench", tags=["workbench"])


# ============================================================
# SHARED HELPERS
# ============================================================

def _request_stage(db: Session, request_id: int, org_id: int) -> dict:
    wf = (
        db.query(WorkflowInstance)
        .filter(
            WorkflowInstance.service_request_id == request_id,
            WorkflowInstance.organization_id == org_id,
        )
        .order_by(WorkflowInstance.created_at.desc())
        .first()
    )
    return {
        "workflow_instance_id": wf.id if wf else None,
        "current_status": wf.current_status if wf else None,
        "current_stage": wf.current_stage if wf else None,
    }


def _serialize_assigned_request(db: Session, sr: ServiceRequest) -> dict:
    stage = _request_stage(db, sr.id, sr.organization_id)
    return {
        "id": sr.id,
        "title": sr.title,
        "description": sr.description,
        "request_type": sr.request_type,
        "status": sr.status,
        "dataset_filename": sr.dataset_filename,
        "has_dataset": bool(sr.dataset_path),
        "created_at": sr.created_at.isoformat() if sr.created_at else None,
        **stage,
    }


def _case_progress(db: Session, case: Case) -> dict:
    """Artifact completeness for one case."""
    tasks = (
        db.query(InvestigationTask)
        .filter(InvestigationTask.case_id == case.id)
        .all()
    )
    tasks_done = sum(1 for t in tasks if t.status in ("COMPLETED", "SKIPPED"))
    findings = (
        db.query(InvestigationFinding)
        .filter(InvestigationFinding.case_id == case.id)
        .count()
    )
    hypotheses = (
        db.query(InvestigationHypothesis)
        .filter(InvestigationHypothesis.case_id == case.id)
        .count()
    )
    evidence_count = (
        db.query(Evidence)
        .filter(Evidence.case_id == case.id)
        .count()
    )

    # Weighted completeness: evidence 20%, hypotheses 15%, tasks 35%, findings 20%, decision 10%
    score = 0.0
    score += min(evidence_count, 3) / 3 * 20
    score += min(hypotheses, 2) / 2 * 15
    score += (tasks_done / len(tasks)) * 35 if tasks else 0
    score += min(findings, 3) / 3 * 20
    score += 10 if case.decision else 0

    return {
        "evidence_count": evidence_count,
        "hypotheses_count": hypotheses,
        "tasks_total": len(tasks),
        "tasks_done": tasks_done,
        "findings_count": findings,
        "completeness": round(score),
    }


def _serialize_case(db: Session, case: Case) -> dict:
    return {
        "id": case.id,
        "title": case.title,
        "status": case.status,
        "priority": case.priority,
        "decision": case.decision,
        "tracelab_risk_score": case.tracelab_risk_score,
        "investigation_risk_score": case.investigation_risk_score,
        "alert_id": case.alert_id,
        "service_request_id": case.service_request_id,
        "created_at": case.created_at.isoformat() if case.created_at else None,
        **_case_progress(db, case),
    }


# ============================================================
# ANALYST WORKBENCH
# ============================================================

@router.get("/analyst")
def analyst_workbench(
    current_user: User = Depends(require_any_permission("request.view_assigned", "request.view_all")),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """Everything the TraceLab overview needs, in one response."""

    is_admin = current_user.role in (Role.ADMIN.value, Role.SUPER_ADMIN.value)

    # ---- Assigned requests ---------------------------------
    req_q = db.query(ServiceRequest).filter(
        ServiceRequest.organization_id == org_id
    )
    if not is_admin:
        req_q = req_q.filter(
            (ServiceRequest.assigned_to_id == current_user.id)
            | (ServiceRequest.assigned_analyst_id == current_user.id)
        )

    assigned_requests = (
        req_q.order_by(ServiceRequest.updated_at.desc()).limit(25).all()
    )

    # ---- Alert queue ---------------------------------------
    alert_q = db.query(Alert).filter(Alert.organization_id == org_id)
    if not is_admin:
        alert_q = alert_q.filter(
            (Alert.assignee_id == current_user.id)
            | (Alert.assignee_id.is_(None))
        )

    alert_counts: dict[str, int] = {}
    severity_counts: dict[str, int] = {}
    for status_val, cnt in (
        alert_q.with_entities(Alert.status, sa_func.count(Alert.id))
        .group_by(Alert.status)
        .all()
    ):
        alert_counts[status_val] = cnt
    for sev, cnt in (
        alert_q.with_entities(Alert.severity, sa_func.count(Alert.id))
        .group_by(Alert.severity)
        .all()
    ):
        severity_counts[sev] = cnt

    triage_queue = (
        alert_q.filter(Alert.status.in_(["NEW", "UNDER_REVIEW"]))
        .order_by(Alert.risk_score.desc())
        .limit(10)
        .all()
    )

    # ---- Analysis jobs + risk trend -------------------------
    jobs = (
        db.query(AnalysisJob)
        .filter(AnalysisJob.organization_id == org_id)
        .order_by(AnalysisJob.created_at.desc())
        .limit(12)
        .all()
    )
    risk_trend = [
        {
            "job_id": j.id,
            "created_at": j.created_at.isoformat() if j.created_at else None,
            "suspicious_accounts": j.suspicious_accounts or 0,
            "fraud_rings": j.fraud_rings or 0,
        }
        for j in reversed(jobs)
    ]

    total_alerts = sum(alert_counts.values())

    return {
        "kpis": {
            "assigned_requests": len(assigned_requests),
            "in_progress": sum(
                1 for r in assigned_requests if r.status == "IN_PROGRESS"
            ),
            "alerts_new": alert_counts.get("NEW", 0) + alert_counts.get("UNDER_REVIEW", 0),
            "alerts_escalated": alert_counts.get("ESCALATED", 0),
            "total_alerts": total_alerts,
            "critical_alerts": severity_counts.get("CRITICAL", 0),
            "jobs_run": len(jobs),
        },
        "assigned_requests": [
            _serialize_assigned_request(db, r) for r in assigned_requests
        ],
        "alert_counts": alert_counts,
        "severity_counts": severity_counts,
        "triage_queue": [
            {
                "id": a.id,
                "alert_type": a.alert_type,
                "risk_score": a.risk_score,
                "severity": a.severity,
                "status": a.status,
                "related_accounts": a.related_accounts or [],
                "created_at": a.created_at.isoformat() if a.created_at else None,
            }
            for a in triage_queue
        ],
        "recent_jobs": [
            {
                "id": j.id,
                "filename": j.filename,
                "status": j.status,
                "total_accounts": j.total_accounts,
                "fraud_rings": j.fraud_rings,
                "processing_time_seconds": j.processing_time_seconds,
                "created_at": j.created_at.isoformat() if j.created_at else None,
            }
            for j in jobs[:6]
        ],
        "risk_trend": risk_trend,
    }


# ============================================================
# INVESTIGATOR WORKBENCH
# ============================================================

@router.get("/investigator")
def investigator_workbench(
    current_user: User = Depends(require_any_permission("case.view_assigned", "request.view_all")),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """Everything the InvoSpace overview needs, in one response."""

    is_admin = current_user.role in (Role.ADMIN.value, Role.SUPER_ADMIN.value)

    # ---- Routed alerts awaiting conversion ------------------
    routed_q = db.query(Alert).filter(
        Alert.organization_id == org_id,
        Alert.status == "ESCALATED",
    )
    if not is_admin:
        routed_q = routed_q.filter(
            (Alert.routed_to_id == current_user.id)
            | (Alert.routed_to_id.is_(None))
            | (Alert.assignee_id == current_user.id)
        )

    routed_alerts = (
        routed_q.order_by(Alert.risk_score.desc()).limit(15).all()
    )

    # ---- My cases -------------------------------------------
    case_q = db.query(Case).filter(Case.organization_id == org_id)
    if not is_admin:
        case_q = case_q.filter(
            (Case.assigned_investigator_id == current_user.id)
            | (Case.assignee_id == current_user.id)
            | (Case.created_by_id == current_user.id)
        )

    cases = case_q.order_by(Case.updated_at.desc()).limit(30).all()

    status_counts: dict[str, int] = {}
    priority_counts: dict[str, int] = {}
    for s, c in (
        case_q.with_entities(Case.status, sa_func.count(Case.id))
        .group_by(Case.status)
        .all()
    ):
        status_counts[s] = c
    for p, c in (
        case_q.with_entities(Case.priority, sa_func.count(Case.id))
        .group_by(Case.priority)
        .all()
    ):
        priority_counts[p] = c

    # ---- Task board -----------------------------------------
    my_case_ids = [c.id for c in cases]
    task_stats = {"PENDING": 0, "IN_PROGRESS": 0, "COMPLETED": 0, "SKIPPED": 0}
    overdue_tasks = []
    if my_case_ids:
        from datetime import datetime, timezone

        tasks = (
            db.query(InvestigationTask)
            .filter(InvestigationTask.case_id.in_(my_case_ids))
            .all()
        )
        now = datetime.now(timezone.utc)
        for t in tasks:
            task_stats[t.status] = task_stats.get(t.status, 0) + 1
            if t.due_date and t.status not in ("COMPLETED", "SKIPPED"):
                due = t.due_date
                if due.tzinfo is None:
                    due = due.replace(tzinfo=timezone.utc)
                if due < now:
                    overdue_tasks.append(
                        {
                            "id": t.id,
                            "case_id": t.case_id,
                            "title": t.title,
                            "due_date": t.due_date.isoformat(),
                        }
                    )

    decisions_made = sum(1 for c in cases if c.decision)

    return {
        "kpis": {
            "routed_alerts": len(routed_alerts),
            "open_cases": status_counts.get("OPEN", 0)
            + status_counts.get("ASSIGNED", 0)
            + status_counts.get("INVESTIGATING", 0),
            "pending_review_cases": status_counts.get("REVIEW", 0)
            + status_counts.get("PENDING_REVIEW", 0),
            "closed_cases": status_counts.get("CLOSED", 0)
            + status_counts.get("RESOLVED", 0),
            "decisions_made": decisions_made,
            "overdue_tasks": len(overdue_tasks),
        },
        "routed_alerts": [
            {
                "id": a.id,
                "alert_type": a.alert_type,
                "risk_score": a.risk_score,
                "severity": a.severity,
                "detection_reason": a.detection_reason,
                "related_accounts": a.related_accounts or [],
                "analysis_job_id": a.analysis_job_id,
                "service_request_id": a.service_request_id,
                "created_at": a.created_at.isoformat() if a.created_at else None,
            }
            for a in routed_alerts
        ],
        "cases": [_serialize_case(db, c) for c in cases],
        "status_counts": status_counts,
        "priority_counts": priority_counts,
        "task_stats": task_stats,
        "overdue_tasks": overdue_tasks[:10],
    }
