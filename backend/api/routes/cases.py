"""
cases.py — Case Management API (InvoSpace).

Only INVESTIGATOR creates cases — either directly or by converting a
routed alert (see /alerts/{id}/convert-to-case).

Artifacts per case:
  - Hypotheses  (OPEN | SUPPORTED | REJECTED | INCONCLUSIVE)
  - Tasks       (PENDING | IN_PROGRESS | COMPLETED | SKIPPED)
  - Findings    (CONFIRMED | PROBABLE | INCONCLUSIVE | REFUTED)
  - Notes / timeline (CaseEvent)

Unique features:
  GET  /cases/{id}/completeness   weighted case-file completeness meter
  GET  /cases/{id}/report-draft   auto-generated investigation report draft
  POST /cases/{id}/decision       record final decision + workflow sync
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime, timezone

from api.deps import get_current_user, get_current_workspace
from db.database import get_db
from models.user import User
from models.role import Role
from core.permissions import require_permission, require_any_permission
from models.case import Case
from models.case_event import CaseEvent
from models.activity_timeline import ActivityTimeline
from models.workflow_instance import WorkflowInstance
from models.alert import Alert
from models.investigation_hypothesis import InvestigationHypothesis
from models.investigation_task import InvestigationTask
from models.investigation_finding import InvestigationFinding
from models.evidence import Evidence

router = APIRouter(prefix="/cases", tags=["cases"])


# ============================================================
# HELPERS & SCHEMAS
# ============================================================

def _query_cases_for_user(db: Session, current_user: User, org_id: int):
    query = db.query(Case).filter(Case.organization_id == org_id)
    return query


def _get_case(db: Session, current_user: User, org_id: int, case_id: int) -> Case:
    case = (
        _query_cases_for_user(db, current_user, org_id)
        .filter(Case.id == case_id)
        .first()
    )
    if not case:
        raise HTTPException(status_code=404, detail="Case not found.")
    return case


class CaseCreate(BaseModel):
    title: str
    description: Optional[str] = None
    priority: str = "MEDIUM"
    workflow_instance_id: Optional[int] = None
    linked_accounts: Optional[List[str]] = None
    linked_rings: Optional[List[str]] = None
    analysis_job_id: Optional[int] = None
    notes: Optional[str] = None
    # Workflow linkage
    alert_id: Optional[int] = None
    service_request_id: Optional[int] = None
    tracelab_risk_score: Optional[float] = None


class CaseUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    notes: Optional[str] = None
    decision: Optional[str] = None


class CaseAssign(BaseModel):
    assignee_id: int


class CaseNote(BaseModel):
    content: str


VALID_CASE_STATUSES = {"OPEN", "ASSIGNED", "INVESTIGATING", "EVIDENCE_REVIEW", "PENDING_REVIEW", "REVISION_REQUIRED", "RESOLVED", "CLOSED"}
VALID_PRIORITIES = {"LOW", "MEDIUM", "HIGH", "CRITICAL"}
VALID_DECISIONS = {
    "NO_SUSPICION",
    "SUSPICIOUS_ACTIVITY",
    "ESCALATE",
    "INSUFFICIENT_INFORMATION",
    "INCONCLUSIVE",
}


def _case_to_dict(db: Session, case: Case) -> dict:
    evidence_count = (
        db.query(Evidence).filter(Evidence.case_id == case.id).count()
    )
    return {
        "id": case.id,
        "title": case.title,
        "description": case.description,
        "status": case.status,
        "priority": case.priority,
        "linked_accounts": case.linked_accounts or [],
        "linked_rings": case.linked_rings or [],
        "analysis_job_id": case.analysis_job_id,
        "workflow_instance_id": case.workflow_instance_id,
        "alert_id": case.alert_id,
        "service_request_id": case.service_request_id,
        "tracelab_risk_score": case.tracelab_risk_score,
        "investigation_risk_score": case.investigation_risk_score,
        "decision": case.decision,
        "decision_reason": case.decision_reason,
        "decision_at": case.decision_at.isoformat() if case.decision_at else None,
        "notes": case.notes,
        "evidence_count": evidence_count,
        "created_by_id": case.created_by_id,
        "assigned_investigator_id": case.assigned_investigator_id,
        "created_at": case.created_at.isoformat() if case.created_at else None,
        "updated_at": case.updated_at.isoformat() if case.updated_at else None,
        "closed_at": case.closed_at.isoformat() if case.closed_at else None,
    }


def _add_case_event(db: Session, org_id: int, case_id: int, user_id: int, event_type: str, content: str) -> None:
    db.add(
        CaseEvent(
            organization_id=org_id,
            case_id=case_id,
            user_id=user_id,
            event_type=event_type,
            content=content,
        )
    )


def _sync_case_workflow(
    db: Session,
    case: Case,
    actor_id: int,
    to_status: str,
    stage: str,
    note: str,
) -> None:
    if not case.workflow_instance_id:
        return
    workflow = (
        db.query(WorkflowInstance)
        .filter(
            WorkflowInstance.id == case.workflow_instance_id,
            WorkflowInstance.organization_id == case.organization_id,
        )
        .first()
    )
    if not workflow:
        return
    from_status = workflow.current_status
    workflow.current_status = to_status
    workflow.current_stage = stage
    workflow.last_note = note
    db.add(
        ActivityTimeline(
            organization_id=case.organization_id,
            workflow_instance_id=workflow.id,
            actor_id=actor_id,
            action="TRANSITION",
            from_status=from_status,
            to_status=to_status,
            details=note,
        )
    )


# ============================================================
# CRUD
# ============================================================

@router.post("", status_code=201)
def create_case(
    body: CaseCreate,
    current_user: User = Depends(require_permission("case.create")),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """Create a new investigation case."""
    if body.priority.upper() not in VALID_PRIORITIES:
        raise HTTPException(status_code=400, detail=f"priority must be one of {sorted(VALID_PRIORITIES)}")

    # If created from an alert, inherit linkage + preserve TraceLab score
    alert = None
    if body.alert_id:
        alert = (
            db.query(Alert)
            .filter(Alert.id == body.alert_id, Alert.organization_id == org_id)
            .first()
        )
        if not alert:
            raise HTTPException(status_code=404, detail="Linked alert not found.")

    service_request_id = body.service_request_id
    tracelab_score = body.tracelab_risk_score
    linked_accounts = body.linked_accounts

    if alert:
        service_request_id = service_request_id or alert.service_request_id
        tracelab_score = tracelab_score if tracelab_score is not None else alert.risk_score
        linked_accounts = linked_accounts or alert.related_accounts

    case = Case(
        organization_id=org_id,
        created_by_id=current_user.id,
        assigned_investigator_id=current_user.id,
        assignee_id=current_user.id,
        title=body.title,
        description=body.description,
        priority=body.priority.upper(),
        linked_accounts=linked_accounts,
        linked_rings=body.linked_rings,
        analysis_job_id=body.analysis_job_id or (alert.analysis_job_id if alert else None),
        workflow_instance_id=body.workflow_instance_id,
        notes=body.notes,
        alert_id=alert.id if alert else None,
        service_request_id=service_request_id,
        tracelab_risk_score=tracelab_score,
    )
    db.add(case)
    db.flush()

    origin = f" from alert #{alert.id}" if alert else ""
    _add_case_event(db, org_id, case.id, current_user.id, "SYSTEM_ACTION", f"Case created{origin}")

    if alert:
        alert.case_id = case.id
        alert.status = "CONVERTED_TO_CASE"

    db.commit()
    db.refresh(case)
    return _case_to_dict(db, case)


@router.get("")
def list_cases(
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    mine_only: bool = Query(False),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(require_any_permission("case.view_assigned", "request.view_all")),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """List cases for the organization, with optional filters."""
    q = _query_cases_for_user(db, current_user, org_id)

    is_admin = current_user.role in (Role.ADMIN.value, Role.SUPER_ADMIN.value)
    if mine_only and not is_admin:
        q = q.filter(
            (Case.assigned_investigator_id == current_user.id)
            | (Case.assignee_id == current_user.id)
            | (Case.created_by_id == current_user.id)
        )

    if status:
        q = q.filter(Case.status == status.upper())
    if priority:
        q = q.filter(Case.priority == priority.upper())

    total = q.count()
    cases = q.order_by(Case.created_at.desc()).offset(offset).limit(limit).all()
    return {"items": [_case_to_dict(db, c) for c in cases], "total": total}


@router.get("/{case_id}")
def get_case(
    case_id: int,
    current_user: User = Depends(require_any_permission("case.view_assigned", "request.view_all")),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """Get a single case by ID."""
    case = _get_case(db, current_user, org_id, case_id)
    return _case_to_dict(db, case)


@router.patch("/{case_id}")
def update_case(
    case_id: int,
    body: CaseUpdate,
    current_user: User = Depends(require_permission("case.update")),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """Update a case's fields (immutable once CLOSED)."""
    case = _get_case(db, current_user, org_id, case_id)

    if case.status == "CLOSED":
        raise HTTPException(status_code=400, detail="Closed cases are immutable.")

    if body.title:
        case.title = body.title
    if body.description is not None:
        case.description = body.description
    if body.notes is not None:
        case.notes = body.notes

    if body.decision is not None:
        raise HTTPException(
            status_code=400,
            detail="Use POST /cases/{id}/decision to record the investigation decision.",
        )

    if body.status:
        new_status = body.status.upper()
        if new_status not in VALID_CASE_STATUSES:
            raise HTTPException(status_code=400, detail=f"status must be one of {sorted(VALID_CASE_STATUSES)}")
        if new_status != case.status:
            old_status = case.status
            case.status = new_status
            case.status_updated_at = datetime.now(timezone.utc)
            if new_status == "CLOSED":
                case.closed_at = datetime.now(timezone.utc)

            stage_map = {
                "OPEN": "INVESTIGATION",
                "ASSIGNED": "INVESTIGATION",
                "INVESTIGATING": "INVESTIGATION",
                "EVIDENCE_REVIEW": "INVESTIGATION",
                "PENDING_REVIEW": "REPORT_REVIEW",
                "REVISION_REQUIRED": "INVESTIGATION",
                "RESOLVED": "INVESTIGATION",
                "CLOSED": "CASE_CLOSED",
            }
            wf_status_map = {
                "PENDING_REVIEW": "AWAITING_REVIEW",
                "CLOSED": "CLOSED",
            }
            _sync_case_workflow(
                db,
                case,
                current_user.id,
                wf_status_map.get(new_status, "INVESTIGATION_IN_PROGRESS"),
                stage_map.get(new_status, "INVESTIGATION"),
                f"Case status changed to {new_status}",
            )
            _add_case_event(
                db, org_id, case.id, current_user.id, "STATUS_CHANGE",
                f"Status changed from {old_status} to {new_status}",
            )

    if body.priority:
        new_priority = body.priority.upper()
        if new_priority not in VALID_PRIORITIES:
            raise HTTPException(status_code=400, detail=f"priority must be one of {sorted(VALID_PRIORITIES)}")
        if new_priority != case.priority:
            old_priority = case.priority
            case.priority = new_priority
            _add_case_event(
                db, org_id, case.id, current_user.id, "SYSTEM_ACTION",
                f"Priority changed from {old_priority} to {new_priority}",
            )

    db.commit()
    db.refresh(case)
    return _case_to_dict(db, case)


@router.patch("/{case_id}/assign")
def assign_case(
    case_id: int,
    body: CaseAssign,
    current_user: User = Depends(require_any_permission("case.assign", "request.view_all")),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """Assign a case to an investigator (admin reassignment or self-claim)."""
    case = _get_case(db, current_user, org_id, case_id)

    assignee = (
        db.query(User)
        .filter(User.id == body.assignee_id, User.organization_id == org_id)
        .first()
    )
    if not assignee:
        raise HTTPException(status_code=404, detail="Assignee not found in this organization.")
    if assignee.role != Role.INVESTIGATOR.value and current_user.role not in (Role.ADMIN.value, Role.SUPER_ADMIN.value):
        raise HTTPException(status_code=400, detail="Cases can only be assigned to an INVESTIGATOR.")

    case.assigned_investigator_id = assignee.id
    case.assignee_id = assignee.id
    if case.status == "OPEN":
        case.status = "ASSIGNED"

    _add_case_event(db, org_id, case.id, current_user.id, "ASSIGNMENT", f"Case assigned to {assignee.username}")
    db.commit()
    db.refresh(case)
    return _case_to_dict(db, case)


# ============================================================
# NOTES & TIMELINE
# ============================================================

@router.post("/{case_id}/notes")
def add_case_note(
    case_id: int,
    body: CaseNote,
    current_user: User = Depends(require_permission("investigation.note.create")),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """Add a timeline note to a case."""
    case = _get_case(db, current_user, org_id, case_id)
    _add_case_event(db, org_id, case.id, current_user.id, "COMMENT", body.content)
    db.commit()
    return {"message": "Note added successfully"}


@router.get("/{case_id}/timeline")
def get_case_timeline(
    case_id: int,
    current_user: User = Depends(require_any_permission("case.view_assigned", "request.view_all")),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """Get the full event timeline for a case."""
    case = _get_case(db, current_user, org_id, case_id)
    events = (
        db.query(CaseEvent)
        .filter(CaseEvent.case_id == case.id)
        .order_by(CaseEvent.created_at.asc())
        .all()
    )
    return [
        {
            "id": e.id,
            "user_id": e.user_id,
            "event_type": e.event_type,
            "content": e.content,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        }
        for e in events
    ]


# ============================================================
# HYPOTHESES
# ============================================================

class HypothesisCreate(BaseModel):
    title: str
    description: Optional[str] = None
    status: str = "OPEN"


class HypothesisUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    supporting_evidence_ids: Optional[List[int]] = None
    contradicting_evidence_ids: Optional[List[int]] = None


VALID_HYP_STATUSES = {"OPEN", "SUPPORTED", "REJECTED", "INCONCLUSIVE"}


@router.post("/{case_id}/hypotheses", status_code=201)
def create_hypothesis(
    case_id: int,
    body: HypothesisCreate,
    current_user: User = Depends(require_permission("investigation.hypothesis.create")),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    case = _get_case(db, current_user, org_id, case_id)
    hyp = InvestigationHypothesis(
        organization_id=org_id,
        case_id=case.id,
        created_by_id=current_user.id,
        title=body.title,
        description=body.description,
        status=body.status.upper() if body.status.upper() in VALID_HYP_STATUSES else "OPEN",
    )
    db.add(hyp)
    db.flush()
    _add_case_event(db, org_id, case.id, current_user.id, "HYPOTHESIS", f"Hypothesis added: {body.title}")
    db.commit()
    db.refresh(hyp)
    return _hyp_to_dict(hyp)


def _hyp_to_dict(h: InvestigationHypothesis) -> dict:
    return {
        "id": h.id,
        "title": h.title,
        "description": h.description,
        "status": h.status,
        "notes": h.notes,
        "supporting_evidence_ids": h.supporting_evidence_ids or [],
        "contradicting_evidence_ids": h.contradicting_evidence_ids or [],
        "created_at": h.created_at.isoformat() if h.created_at else None,
        "updated_at": h.updated_at.isoformat() if h.updated_at else None,
    }


@router.get("/{case_id}/hypotheses")
def list_hypotheses(
    case_id: int,
    current_user: User = Depends(require_any_permission("case.view_assigned", "request.view_all")),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    case = _get_case(db, current_user, org_id, case_id)
    rows = (
        db.query(InvestigationHypothesis)
        .filter(InvestigationHypothesis.case_id == case.id)
        .order_by(InvestigationHypothesis.created_at.desc())
        .all()
    )
    return [_hyp_to_dict(h) for h in rows]


@router.patch("/{case_id}/hypotheses/{hypothesis_id}")
def update_hypothesis(
    case_id: int,
    hypothesis_id: int,
    body: HypothesisUpdate,
    current_user: User = Depends(require_permission("investigation.hypothesis.update")),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    _get_case(db, current_user, org_id, case_id)
    hyp = (
        db.query(InvestigationHypothesis)
        .filter(
            InvestigationHypothesis.id == hypothesis_id,
            InvestigationHypothesis.case_id == case_id,
            InvestigationHypothesis.organization_id == org_id,
        )
        .first()
    )
    if not hyp:
        raise HTTPException(status_code=404, detail="Hypothesis not found.")

    if body.status is not None:
        new_status = body.status.upper()
        if new_status not in VALID_HYP_STATUSES:
            raise HTTPException(status_code=400, detail=f"status must be one of {sorted(VALID_HYP_STATUSES)}")
        hyp.status = new_status
    if body.notes is not None:
        hyp.notes = body.notes
    if body.supporting_evidence_ids is not None:
        hyp.supporting_evidence_ids = body.supporting_evidence_ids
    if body.contradicting_evidence_ids is not None:
        hyp.contradicting_evidence_ids = body.contradicting_evidence_ids

    db.commit()
    db.refresh(hyp)
    return _hyp_to_dict(hyp)


# ============================================================
# TASKS
# ============================================================

class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    task_type: str = "CUSTOM"
    assigned_to_id: Optional[int] = None
    due_date: Optional[datetime] = None
    is_mandatory: bool = False


class TaskUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    assigned_to_id: Optional[int] = None
    due_date: Optional[datetime] = None


VALID_TASK_STATUSES = {"PENDING", "IN_PROGRESS", "COMPLETED", "SKIPPED"}


def _validate_task_assignee(
    db: Session,
    org_id: int,
    assigned_to_id: int,
) -> None:
    """
    Ensure the task assignee exists inside the same
    organization (prevents FK IntegrityError 500s).
    """
    assignee = (
        db.query(User)
        .filter(
            User.id == assigned_to_id,
            User.organization_id == org_id,
        )
        .first()
    )
    if not assignee:
        raise HTTPException(
            status_code=400,
            detail="assigned_to_id must be an existing user in this organization.",
        )


@router.post("/{case_id}/tasks", status_code=201)
def create_task(
    case_id: int,
    body: TaskCreate,
    current_user: User = Depends(require_permission("investigation.task.create")),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    case = _get_case(db, current_user, org_id, case_id)
    if body.assigned_to_id:
        _validate_task_assignee(db, org_id, body.assigned_to_id)
    task = InvestigationTask(
        organization_id=org_id,
        case_id=case.id,
        created_by_id=current_user.id,
        assigned_to_id=body.assigned_to_id or current_user.id,
        title=body.title,
        description=body.description,
        task_type=body.task_type,
        due_date=body.due_date,
        is_mandatory=body.is_mandatory,
    )
    db.add(task)
    db.flush()
    _add_case_event(db, org_id, case.id, current_user.id, "TASK", f"Task created: {body.title}")
    db.commit()
    db.refresh(task)
    return _task_to_dict(task)


def _task_to_dict(t: InvestigationTask) -> dict:
    return {
        "id": t.id,
        "title": t.title,
        "description": t.description,
        "task_type": t.task_type,
        "status": t.status,
        "is_mandatory": t.is_mandatory,
        "assigned_to_id": t.assigned_to_id,
        "due_date": t.due_date.isoformat() if t.due_date else None,
        "completed_at": t.completed_at.isoformat() if t.completed_at else None,
        "notes": t.notes,
        "created_at": t.created_at.isoformat() if t.created_at else None,
    }


@router.get("/{case_id}/tasks")
def list_tasks(
    case_id: int,
    current_user: User = Depends(require_any_permission("case.view_assigned", "request.view_all")),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    case = _get_case(db, current_user, org_id, case_id)
    rows = (
        db.query(InvestigationTask)
        .filter(InvestigationTask.case_id == case.id)
        .order_by(InvestigationTask.created_at.desc())
        .all()
    )
    return [_task_to_dict(t) for t in rows]


@router.patch("/{case_id}/tasks/{task_id}")
def update_task(
    case_id: int,
    task_id: int,
    body: TaskUpdate,
    current_user: User = Depends(require_permission("investigation.task.update")),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    _get_case(db, current_user, org_id, case_id)
    task = (
        db.query(InvestigationTask)
        .filter(
            InvestigationTask.id == task_id,
            InvestigationTask.case_id == case_id,
            InvestigationTask.organization_id == org_id,
        )
        .first()
    )
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")

    if body.status is not None:
        new_status = body.status.upper()
        if new_status not in VALID_TASK_STATUSES:
            raise HTTPException(status_code=400, detail=f"status must be one of {sorted(VALID_TASK_STATUSES)}")
        task.status = new_status
        task.completed_at = datetime.now(timezone.utc) if new_status == "COMPLETED" else None
    if body.notes is not None:
        task.notes = body.notes
    if body.assigned_to_id is not None:
        _validate_task_assignee(db, org_id, body.assigned_to_id)
        task.assigned_to_id = body.assigned_to_id
    if body.due_date is not None:
        task.due_date = body.due_date

    db.commit()
    db.refresh(task)
    return _task_to_dict(task)


# ============================================================
# FINDINGS
# ============================================================

class FindingCreate(BaseModel):
    title: str
    description: str
    finding_type: str = "OTHER"
    confidence: str = "INCONCLUSIVE"
    risk_contribution: float = 0.0
    aml_pattern: Optional[str] = None
    linked_entity_ids: Optional[List[int]] = None
    linked_evidence_ids: Optional[List[int]] = None
    linked_hypothesis_ids: Optional[List[int]] = None


class FindingUpdate(BaseModel):
    confidence: Optional[str] = None
    risk_contribution: Optional[float] = None
    description: Optional[str] = None


VALID_FINDING_TYPES = {
    "SUSPICIOUS_TRANSACTION", "SUSPICIOUS_NETWORK", "IDENTITY_DISCREPANCY",
    "BEHAVIOUR_ANOMALY", "PATTERN_MATCH", "RISK_FACTOR", "EXCULPATORY", "OTHER",
}
VALID_CONFIDENCES = {"CONFIRMED", "PROBABLE", "INCONCLUSIVE", "REFUTED"}


@router.post("/{case_id}/findings", status_code=201)
def create_finding(
    case_id: int,
    body: FindingCreate,
    current_user: User = Depends(require_permission("investigation.finding.create")),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    case = _get_case(db, current_user, org_id, case_id)
    finding = InvestigationFinding(
        organization_id=org_id,
        case_id=case.id,
        created_by_id=current_user.id,
        title=body.title,
        description=body.description,
        finding_type=body.finding_type.upper() if body.finding_type.upper() in VALID_FINDING_TYPES else "OTHER",
        confidence=body.confidence.upper() if body.confidence.upper() in VALID_CONFIDENCES else "INCONCLUSIVE",
        risk_contribution=body.risk_contribution,
        aml_pattern=body.aml_pattern,
        linked_entity_ids=body.linked_entity_ids,
        linked_evidence_ids=body.linked_evidence_ids,
        linked_hypothesis_ids=body.linked_hypothesis_ids,
    )
    db.add(finding)
    db.flush()
    _add_case_event(db, org_id, case.id, current_user.id, "FINDING", f"Finding recorded: {body.title}")
    db.commit()
    db.refresh(finding)
    return _finding_to_dict(finding)


def _finding_to_dict(f: InvestigationFinding) -> dict:
    return {
        "id": f.id,
        "title": f.title,
        "description": f.description,
        "finding_type": f.finding_type,
        "confidence": f.confidence,
        "risk_contribution": f.risk_contribution,
        "aml_pattern": f.aml_pattern,
        "linked_evidence_ids": f.linked_evidence_ids or [],
        "linked_hypothesis_ids": f.linked_hypothesis_ids or [],
        "created_at": f.created_at.isoformat() if f.created_at else None,
    }


@router.get("/{case_id}/findings")
def list_findings(
    case_id: int,
    current_user: User = Depends(require_any_permission("case.view_assigned", "request.view_all")),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    case = _get_case(db, current_user, org_id, case_id)
    rows = (
        db.query(InvestigationFinding)
        .filter(InvestigationFinding.case_id == case.id)
        .order_by(InvestigationFinding.created_at.desc())
        .all()
    )
    return [_finding_to_dict(f) for f in rows]


@router.patch("/{case_id}/findings/{finding_id}")
def update_finding(
    case_id: int,
    finding_id: int,
    body: FindingUpdate,
    current_user: User = Depends(require_permission("investigation.finding.update")),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    _get_case(db, current_user, org_id, case_id)
    finding = (
        db.query(InvestigationFinding)
        .filter(
            InvestigationFinding.id == finding_id,
            InvestigationFinding.case_id == case_id,
            InvestigationFinding.organization_id == org_id,
        )
        .first()
    )
    if not finding:
        raise HTTPException(status_code=404, detail="Finding not found.")

    if body.confidence is not None:
        conf = body.confidence.upper()
        if conf not in VALID_CONFIDENCES:
            raise HTTPException(status_code=400, detail=f"confidence must be one of {sorted(VALID_CONFIDENCES)}")
        finding.confidence = conf
    if body.risk_contribution is not None:
        finding.risk_contribution = body.risk_contribution
    if body.description is not None:
        finding.description = body.description

    db.commit()
    db.refresh(finding)
    return _finding_to_dict(finding)


# ============================================================
# DECISION PANEL
# ============================================================

class DecisionBody(BaseModel):
    decision: str
    reason: Optional[str] = None
    investigation_risk_score: Optional[float] = None


@router.post("/{case_id}/decision")
def record_decision(
    case_id: int,
    body: DecisionBody,
    current_user: User = Depends(require_permission("investigation.risk.reassess")),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """
    Record the investigator's final decision.

    decision ∈ NO_SUSPICION | SUSPICIOUS_ACTIVITY | ESCALATE |
               INSUFFICIENT_INFORMATION | INCONCLUSIVE

    Syncs the workflow toward report submission.
    """
    case = _get_case(db, current_user, org_id, case_id)

    if case.status == "CLOSED":
        raise HTTPException(status_code=400, detail="Closed cases cannot receive decisions.")

    decision = body.decision.upper()
    if decision not in VALID_DECISIONS:
        raise HTTPException(status_code=400, detail=f"decision must be one of {sorted(VALID_DECISIONS)}")

    case.decision = decision
    case.decision_reason = body.reason
    case.decision_at = datetime.now(timezone.utc)
    if body.investigation_risk_score is not None:
        case.investigation_risk_score = body.investigation_risk_score

    _add_case_event(
        db, org_id, case.id, current_user.id, "DECISION",
        f"Decision recorded: {decision}" + (f" — {body.reason}" if body.reason else ""),
    )

    # Move case into review pipeline
    if case.status not in ("PENDING_REVIEW", "CLOSED"):
        case.status = "PENDING_REVIEW"
        _sync_case_workflow(
            db, case, current_user.id,
            "DECISION_RECORDED", "INVESTIGATION",
            f"Investigator decision: {decision}",
        )

    db.commit()
    db.refresh(case)
    return _case_to_dict(db, case)


# ============================================================
# UNIQUE: CASE-FILE COMPLETENESS METER
# ============================================================

@router.get("/{case_id}/completeness")
def case_completeness(
    case_id: int,
    current_user: User = Depends(require_any_permission("case.view_assigned", "request.view_all")),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """
    Weighted readiness score for the case file:

      Evidence collected ......... 20%
      Hypotheses evaluated ....... 15%
      Tasks completed ............ 35%
      Findings recorded .......... 20%
      Decision recorded .......... 10%

    Returns per-dimension breakdown so the UI can show exactly
    what is missing before the report can be submitted.
    """
    case = _get_case(db, current_user, org_id, case_id)

    tasks = db.query(InvestigationTask).filter(InvestigationTask.case_id == case.id).all()
    tasks_done = sum(1 for t in tasks if t.status in ("COMPLETED", "SKIPPED"))
    findings = db.query(InvestigationFinding).filter(InvestigationFinding.case_id == case.id).count()
    hypotheses = db.query(InvestigationHypothesis).filter(InvestigationHypothesis.case_id == case.id).count()
    evidence_count = db.query(Evidence).filter(Evidence.case_id == case.id).count()

    dims = {
        "evidence": round(min(evidence_count, 3) / 3 * 20),
        "hypotheses": round(min(hypotheses, 2) / 2 * 15),
        "tasks": round((tasks_done / len(tasks)) * 35) if tasks else 0,
        "findings": round(min(findings, 3) / 3 * 20),
        "decision": 10 if case.decision else 0,
    }

    missing = []
    if evidence_count == 0:
        missing.append("Upload at least one piece of evidence")
    if hypotheses == 0:
        missing.append("Record at least one hypothesis")
    if tasks and tasks_done < len(tasks):
        missing.append(f"{len(tasks) - tasks_done} task(s) still open")
    if findings == 0:
        missing.append("Record at least one formal finding")
    if not case.decision:
        missing.append("Record the investigation decision")

    return {
        "case_id": case.id,
        "total": sum(dims.values()),
        "dimensions": dims,
        "missing": missing,
        "ready_for_report": len(missing) == 0,
    }


# ============================================================
# UNIQUE: AUTO-GENERATED REPORT DRAFT
# ============================================================

@router.get("/{case_id}/report-draft")
def case_report_draft(
    case_id: int,
    current_user: User = Depends(require_any_permission("case.view_assigned", "request.view_all")),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """
    Auto-generates a structured investigation report draft from the
    case's artifacts (alert context, hypotheses, tasks, findings,
    decision). The investigator reviews/edits it, then creates the
    ClientReport via POST /reports and uploads the final document.
    """
    case = _get_case(db, current_user, org_id, case_id)

    alert = (
        db.query(Alert).filter(Alert.id == case.alert_id).first()
        if case.alert_id else None
    )
    hypotheses = (
        db.query(InvestigationHypothesis)
        .filter(InvestigationHypothesis.case_id == case.id)
        .all()
    )
    tasks = (
        db.query(InvestigationTask)
        .filter(InvestigationTask.case_id == case.id)
        .all()
    )
    findings = (
        db.query(InvestigationFinding)
        .filter(InvestigationFinding.case_id == case.id)
        .all()
    )
    evidence_rows = (
        db.query(Evidence).filter(Evidence.case_id == case.id).all()
    )

    confirmed_findings = [f for f in findings if f.confidence in ("CONFIRMED", "PROBABLE")]

    summary_lines = []
    summary_lines.append(
        f"Investigation of case '{case.title}' (priority {case.priority})."
    )
    if alert:
        summary_lines.append(
            f"Originated from TraceLab alert #{alert.id} "
            f"({alert.alert_type}, risk score {alert.risk_score:.0f})."
        )
    if case.tracelab_risk_score is not None:
        if case.investigation_risk_score is not None:
            summary_lines.append(
                f"TraceLab technical risk score preserved at {case.tracelab_risk_score:.0f}; "
                f"investigator reassessment: {case.investigation_risk_score:.0f}."
            )
        else:
            summary_lines.append(
                f"TraceLab technical risk score preserved at {case.tracelab_risk_score:.0f}; "
                f"investigator reassessment not yet recorded."
            )
    summary_lines.append(
        f"{len(findings)} formal finding(s) recorded, of which "
        f"{len(confirmed_findings)} confirmed/probable."
    )
    if case.decision:
        summary_lines.append(f"Final decision: {case.decision}.")

    draft = {
        "case_id": case.id,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "title": f"Investigation Report — {case.title}",
        "summary": " ".join(summary_lines),
        "sections": {
            "background": {
                "description": case.description,
                "service_request_id": case.service_request_id,
                "alert_id": case.alert_id,
                "analysis_job_id": case.analysis_job_id,
                "linked_accounts": case.linked_accounts or [],
                "linked_rings": case.linked_rings or [],
            },
            "risk_assessment": {
                "tracelab_risk_score": case.tracelab_risk_score,
                "investigation_risk_score": case.investigation_risk_score,
                "priority": case.priority,
            },
            "hypotheses": [
                {"title": h.title, "status": h.status, "description": h.description}
                for h in hypotheses
            ],
            "procedures_performed": [
                {
                    "title": t.title,
                    "type": t.task_type,
                    "status": t.status,
                    "completed_at": t.completed_at.isoformat() if t.completed_at else None,
                }
                for t in tasks
            ],
            "findings": [
                {
                    "title": f.title,
                    "type": f.finding_type,
                    "confidence": f.confidence,
                    "risk_contribution": f.risk_contribution,
                    "description": f.description,
                }
                for f in findings
            ],
            "evidence_index": [
                {"id": e.id, "file_name": e.file_name}
                for e in evidence_rows
            ],
            "conclusion": {
                "decision": case.decision,
                "reason": case.decision_reason,
                "decided_at": case.decision_at.isoformat() if case.decision_at else None,
            },
        },
        "markdown": _draft_markdown(case, alert, hypotheses, tasks, findings, evidence_rows),
    }
    return draft


def _draft_markdown(case, alert, hypotheses, tasks, findings, evidence_rows) -> str:
    lines = []
    lines.append(f"# Investigation Report — {case.title}")
    lines.append("")
    lines.append(f"*Generated {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}*")
    lines.append("")
    lines.append("## Background")
    lines.append(case.description or "_No description provided._")
    if alert:
        lines.append("")
        lines.append(
            f"- Origin alert: **#{alert.id}** ({alert.alert_type}, risk {alert.risk_score:.0f})"
        )
    if case.linked_accounts:
        lines.append(f"- Linked accounts: {', '.join(map(str, case.linked_accounts))}")
    lines.append("")
    lines.append("## Risk Assessment")
    lines.append(f"- TraceLab risk score: **{case.tracelab_risk_score if case.tracelab_risk_score is not None else 'N/A'}**")
    lines.append(f"- Investigator reassessment: **{case.investigation_risk_score if case.investigation_risk_score is not None else 'pending'}**")
    lines.append(f"- Priority: **{case.priority}**")
    lines.append("")
    lines.append("## Hypotheses")
    if hypotheses:
        for h in hypotheses:
            lines.append(f"- [{h.status}] {h.title}")
    else:
        lines.append("_None recorded._")
    lines.append("")
    lines.append("## Procedures Performed")
    if tasks:
        for t in tasks:
            lines.append(f"- [{t.status}] {t.title} ({t.task_type})")
    else:
        lines.append("_None recorded._")
    lines.append("")
    lines.append("## Findings")
    if findings:
        for f in findings:
            lines.append(f"### {f.title} ({f.finding_type}, {f.confidence})")
            lines.append(f.description)
            lines.append("")
    else:
        lines.append("_None recorded._")
    lines.append("## Evidence Index")
    if evidence_rows:
        for e in evidence_rows:
            lines.append(f"- Evidence #{e.id}: {e.file_name}")
    else:
        lines.append("_No evidence attached._")
    lines.append("")
    lines.append("## Conclusion")
    if case.decision:
        lines.append(f"**Decision: {case.decision}**")
        if case.decision_reason:
            lines.append(case.decision_reason)
    else:
        lines.append("_Decision pending._")
    return "\n".join(lines)
