"""
alerts.py — Alerts Management API.

Lifecycle:
  ANALYST creates/triages alerts  →  escalates to ADMIN
  ADMIN routes escalated alert    →  INVESTIGATOR (InvoSpace)
  INVESTIGATOR converts alert     →  Case

Statuses (canonical):
  NEW | UNDER_REVIEW | TRIAGED | FALSE_POSITIVE | ESCALATED
  | CONVERTED_TO_CASE | DISMISSED | CLOSED
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
from models.alert import Alert
from models.case import Case
from models.activity_timeline import ActivityTimeline
from models.workflow_instance import WorkflowInstance
from core.permissions import require_permission, require_any_permission
from services.notification_service import (
    notify_alert_escalated,
    notify_alert_routed,
)

router = APIRouter(prefix="/alerts", tags=["alerts"])

VALID_ALERT_STATUSES = {
    "NEW",
    "UNDER_REVIEW",
    "TRIAGED",
    "FALSE_POSITIVE",
    "ESCALATED",
    "CONVERTED_TO_CASE",
    "DISMISSED",
    "CLOSED",
}


class AlertAssign(BaseModel):
    assignee_id: int


class AlertEscalate(BaseModel):
    reason: Optional[str] = None
    priority: Optional[str] = None


class BulkAlertAction(BaseModel):
    alert_ids: List[int]
    action: str  # TRIAGE | DISMISS | FALSE_POSITIVE | ESCALATE | UNDER_REVIEW
    note: Optional[str] = None


class AlertCreate(BaseModel):
    service_request_id: Optional[int] = None
    alert_type: str
    pattern_type: Optional[str] = None
    risk_score: float = 0.0
    severity: str = "MEDIUM"
    trigger_reason: Optional[str] = None
    related_accounts: Optional[List[str]] = None


# ============================================================
# HELPERS
# ============================================================

def _scope_alerts(db: Session, current_user: User, org_id: int):
    query = db.query(Alert).filter(Alert.organization_id == org_id)
    return query


def _get_alert(db: Session, current_user: User, org_id: int, alert_id: int) -> Alert:
    alert = (
        _scope_alerts(db, current_user, org_id)
        .filter(Alert.id == alert_id)
        .first()
    )
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found.")
    return alert


def _alert_to_dict(alert: Alert) -> dict:
    return {
        "id": alert.id,
        "analysis_job_id": alert.analysis_job_id,
        "service_request_id": alert.service_request_id,
        "case_id": alert.case_id,
        "workflow_instance_id": alert.workflow_instance_id,
        "alert_type": alert.alert_type,
        "pattern_type": alert.pattern_type,
        "risk_score": alert.risk_score,
        "severity": alert.severity,
        "status": alert.status,
        "trigger_reason": alert.trigger_reason,
        "detection_reason": alert.detection_reason,
        "related_accounts": alert.related_accounts or [],
        "assignee_id": alert.assignee_id,
        "routed_to_id": alert.routed_to_id,
        "escalation_reason": alert.escalation_reason,
        "escalation_priority": alert.escalation_priority,
        "escalated_at": alert.escalated_at.isoformat() if alert.escalated_at else None,
        "routed_at": alert.routed_at.isoformat() if alert.routed_at else None,
        "created_at": alert.created_at.isoformat() if alert.created_at else None,
        "updated_at": alert.updated_at.isoformat() if alert.updated_at else None,
    }


def _sync_workflow_for_alert(
    db: Session,
    org_id: int,
    workflow_id: Optional[int],
    actor_id: int,
    to_status: str,
    stage: str,
    note: str,
):
    if workflow_id:
        workflow = (
            db.query(WorkflowInstance)
            .filter(
                WorkflowInstance.id == workflow_id,
                WorkflowInstance.organization_id == org_id,
            )
            .first()
        )
        if not workflow:
            return None
    else:
        workflow = WorkflowInstance(
            organization_id=org_id,
            current_status=to_status,
            current_stage=stage,
            owner_id=actor_id,
            assignee_id=actor_id,
        )
        db.add(workflow)
        db.flush()

    from_status = workflow.current_status
    workflow.current_status = to_status
    workflow.current_stage = stage
    workflow.last_note = note
    db.add(
        ActivityTimeline(
            organization_id=workflow.organization_id,
            workflow_instance_id=workflow.id,
            actor_id=actor_id,
            action="TRANSITION",
            from_status=from_status,
            to_status=to_status,
            details=note,
        )
    )
    return workflow


# ============================================================
# LIST / READ
# ============================================================

@router.get("")
def list_alerts(
    status: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(
        require_any_permission("alert.view_all", "alert.view_assigned")
    ),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """List alerts for the organization (analyst/admin/investigator)."""
    q = _scope_alerts(db, current_user, org_id)

    # Investigators primarily see ESCALATED alerts routed to them
    if current_user.role == Role.INVESTIGATOR.value:
        q = q.filter(
            (Alert.routed_to_id == current_user.id)
            | (Alert.assignee_id == current_user.id)
            | (Alert.status == "ESCALATED")
        )

    if status:
        q = q.filter(Alert.status == status.upper())
    if severity:
        q = q.filter(Alert.severity == severity.upper())

    total = q.count()
    alerts = (
        q.order_by(Alert.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return {"items": [_alert_to_dict(a) for a in alerts], "total": total}


@router.get("/{alert_id}")
def get_alert(
    alert_id: int,
    current_user: User = Depends(
        require_any_permission("alert.view_all", "alert.view_assigned")
    ),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    alert = _get_alert(db, current_user, org_id, alert_id)
    return _alert_to_dict(alert)


# ============================================================
# CREATE (analyst)
# ============================================================

@router.post("", status_code=201)
def create_alert(
    body: AlertCreate,
    current_user: User = Depends(require_permission("alert.create")),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """Analyst manually creates a new alert."""
    alert = Alert(
        organization_id=org_id,
        service_request_id=body.service_request_id,
        alert_type=body.alert_type,
        pattern_type=body.pattern_type,
        risk_score=body.risk_score,
        severity=body.severity.upper(),
        trigger_reason=body.trigger_reason,
        related_accounts=body.related_accounts,
        created_by_id=current_user.id,
        status="NEW",
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return _alert_to_dict(alert)


# ============================================================
# STATUS / TRIAGE (analyst)
# ============================================================

@router.patch("/{alert_id}/status")
def update_alert_status(
    alert_id: int,
    status: str = Query(...),
    note: Optional[str] = Query(None),
    current_user: User = Depends(require_permission("alert.update")),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """Triage an alert: UNDER_REVIEW / TRIAGED / FALSE_POSITIVE / DISMISSED."""
    new_status = status.upper()
    if new_status not in VALID_ALERT_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Must be one of {sorted(VALID_ALERT_STATUSES)}",
        )

    alert = _get_alert(db, current_user, org_id, alert_id)
    alert.status = new_status
    if note:
        alert.trigger_reason = note
    db.commit()
    db.refresh(alert)
    return _alert_to_dict(alert)


# ============================================================
# BULK ACTIONS (analyst) — fast triage board
# ============================================================

@router.post("/bulk-action")
def bulk_alert_action(
    body: BulkAlertAction,
    current_user: User = Depends(require_any_permission("alert.update", "alert.escalate_to_admin")),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """
    Bulk triage for the analyst alert board.

    action: UNDER_REVIEW | TRIAGE | DISMISS | FALSE_POSITIVE | ESCALATE
    """
    action = body.action.upper()

    action_map = {
        "UNDER_REVIEW": "UNDER_REVIEW",
        "TRIAGE": "TRIAGED",
        "DISMISS": "DISMISSED",
        "FALSE_POSITIVE": "FALSE_POSITIVE",
    }

    if action not in action_map and action != "ESCALATE":
        raise HTTPException(
            status_code=400,
            detail="action must be one of UNDER_REVIEW, TRIAGE, DISMISS, FALSE_POSITIVE, ESCALATE",
        )

    if not body.alert_ids:
        raise HTTPException(status_code=400, detail="alert_ids must not be empty.")

    results = {"updated": [], "skipped": []}

    for alert_id in body.alert_ids:
        alert = (
            _scope_alerts(db, current_user, org_id)
            .filter(Alert.id == alert_id)
            .first()
        )
        if not alert:
            results["skipped"].append({"id": alert_id, "reason": "not_found"})
            continue

        if alert.status in ("CONVERTED_TO_CASE", "CLOSED"):
            results["skipped"].append({"id": alert_id, "reason": f"immutable ({alert.status})"})
            continue

        if action == "ESCALATE":
            if alert.status == "ESCALATED":
                results["skipped"].append({"id": alert_id, "reason": "already_escalated"})
                continue
            alert.status = "ESCALATED"
            alert.escalated_by_id = current_user.id
            alert.escalated_at = datetime.now(timezone.utc)
            alert.escalation_reason = body.note
            _sync_workflow_for_alert(
                db=db,
                org_id=org_id,
                workflow_id=alert.workflow_instance_id,
                actor_id=current_user.id,
                to_status="ESCALATED",
                stage="ALERT_ESCALATED",
                note=f"Alert #{alert.id} escalated (bulk)",
            )
            notify_alert_escalated(
                db,
                org_id=org_id,
                alert_id=alert.id,
                analyst_name=current_user.username,
                risk_score=alert.risk_score or 0.0,
            )
        else:
            alert.status = action_map[action]
            if body.note:
                alert.trigger_reason = body.note

        results["updated"].append(alert.id)

    db.commit()
    return {"action": action, **results}


# ============================================================
# ESCALATE (analyst → admin)
# ============================================================

@router.post("/{alert_id}/escalate")
def escalate_alert_to_admin(
    alert_id: int,
    body: Optional[AlertEscalate] = None,
    current_user: User = Depends(require_permission("alert.escalate_to_admin")),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """Analyst escalates an alert to Admin for routing. NOT case creation."""
    alert = _get_alert(db, current_user, org_id, alert_id)

    if alert.status in ("CONVERTED_TO_CASE", "CLOSED"):
        raise HTTPException(
            status_code=400,
            detail=f"Alert is already {alert.status} and cannot be escalated.",
        )

    reason = (body.reason if body else None) or "Escalated for admin review"
    priority = ((body.priority if body else None) or "HIGH").upper()
    if priority not in {"LOW", "MEDIUM", "HIGH", "CRITICAL"}:
        priority = "HIGH"

    alert.status = "ESCALATED"
    alert.escalated_by_id = current_user.id
    alert.escalated_at = datetime.now(timezone.utc)
    alert.escalation_reason = reason
    alert.escalation_priority = priority

    _sync_workflow_for_alert(
        db=db,
        org_id=org_id,
        workflow_id=alert.workflow_instance_id,
        actor_id=current_user.id,
        to_status="ESCALATED",
        stage="ALERT_ESCALATED",
        note=f"Alert #{alert.id} escalated to Admin — {reason}",
    )

    notify_alert_escalated(
        db,
        org_id=org_id,
        alert_id=alert.id,
        analyst_name=current_user.username,
        risk_score=alert.risk_score or 0.0,
    )

    db.commit()
    db.refresh(alert)
    return _alert_to_dict(alert)


# ============================================================
# ROUTE (admin → investigator)
# ============================================================

@router.patch("/{alert_id}/assign")
def assign_alert(
    alert_id: int,
    body: AlertAssign,
    current_user: User = Depends(require_permission("alert.route_to_invospace")),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """
    Admin routes an ESCALATED alert to an InvoSpace investigator.
    """
    alert = _get_alert(db, current_user, org_id, alert_id)

    if alert.status != "ESCALATED":
        raise HTTPException(
            status_code=400,
            detail="Only ESCALATED alerts can be routed to InvoSpace.",
        )

    assignee = (
        db.query(User)
        .filter(
            User.id == body.assignee_id,
            User.organization_id == org_id,
        )
        .first()
    )
    if not assignee:
        raise HTTPException(status_code=404, detail="Assignee not found in this organization.")

    if assignee.role != Role.INVESTIGATOR.value:
        raise HTTPException(
            status_code=400,
            detail="Alerts can only be routed to an INVESTIGATOR (InvoSpace).",
        )

    alert.assignee_id = assignee.id
    alert.routed_by_id = current_user.id
    alert.routed_to_id = assignee.id
    alert.routed_at = datetime.now(timezone.utc)

    workflow = _sync_workflow_for_alert(
        db=db,
        org_id=org_id,
        workflow_id=alert.workflow_instance_id,
        actor_id=current_user.id,
        to_status="ROUTED",
        stage="INVOSPACE",
        note=f"Alert #{alert.id} routed to {assignee.username}",
    )
    if workflow and not alert.workflow_instance_id:
        alert.workflow_instance_id = workflow.id

    notify_alert_routed(
        db,
        org_id=org_id,
        alert_id=alert.id,
        investigator_id=assignee.id,
        risk_score=alert.risk_score or 0.0,
    )

    db.commit()
    db.refresh(alert)
    return _alert_to_dict(alert)


# ============================================================
# CONVERT TO CASE (investigator)
# ============================================================

class AlertConvert(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None


@router.post("/{alert_id}/convert-to-case", status_code=201)
def convert_alert_to_case(
    alert_id: int,
    body: Optional[AlertConvert] = None,
    current_user: User = Depends(require_permission("case.create")),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """
    InvoSpace converts a routed alert into an investigation case.

    - Creates the Case linked to the alert + service request
    - Marks the alert CONVERTED_TO_CASE
    - Preserves the TraceLab risk score on the case
    - Syncs the workflow to INVESTIGATION
    """
    alert = _get_alert(db, current_user, org_id, alert_id)

    if alert.status != "ESCALATED":
        raise HTTPException(
            status_code=400,
            detail="Only ESCALATED alerts can be converted to a case.",
        )

    if alert.case_id:
        existing = db.query(Case).filter(Case.id == alert.case_id).first()
        if existing:
            raise HTTPException(
                status_code=409,
                detail=f"Alert already converted to case #{existing.id}.",
            )

    priority = (body.priority if body and body.priority else None)
    if priority is None:
        severity_to_priority = {
            "CRITICAL": "CRITICAL",
            "HIGH": "HIGH",
            "MEDIUM": "MEDIUM",
            "LOW": "LOW",
        }
        priority = severity_to_priority.get((alert.severity or "MEDIUM").upper(), "MEDIUM")

    default_title = (
        body.title if body and body.title
        else f"Investigation: {alert.alert_type} (Alert #{alert.id})"
    )
    default_desc = (
        body.description if body and body.description
        else (alert.trigger_reason or f"Case opened from routed alert #{alert.id}.")
    )

    case = Case(
        organization_id=org_id,
        alert_id=alert.id,
        service_request_id=alert.service_request_id,
        created_by_id=current_user.id,
        assigned_investigator_id=current_user.id,
        assignee_id=current_user.id,
        title=default_title,
        description=default_desc,
        status="OPEN",
        priority=priority,
        tracelab_risk_score=alert.risk_score,
        linked_accounts=alert.related_accounts,
    )
    db.add(case)
    db.flush()

    from models.case_event import CaseEvent

    db.add(
        CaseEvent(
            organization_id=org_id,
            case_id=case.id,
            user_id=current_user.id,
            event_type="SYSTEM_ACTION",
            content=f"Case created from alert #{alert.id} ({alert.alert_type}, risk {alert.risk_score:.0f})",
        )
    )

    alert.case_id = case.id
    alert.status = "CONVERTED_TO_CASE"

    workflow = _sync_workflow_for_alert(
        db=db,
        org_id=org_id,
        workflow_id=alert.workflow_instance_id,
        actor_id=current_user.id,
        to_status="INVESTIGATION_IN_PROGRESS",
        stage="INVESTIGATION",
        note=f"Alert #{alert.id} converted to case #{case.id}",
    )
    if workflow:
        case.workflow_instance_id = workflow.id

    from services.notification_service import notify_case_created

    notify_case_created(
        db,
        org_id=org_id,
        case_id=case.id,
        case_title=case.title,
        investigator_id=current_user.id,
    )

    db.commit()
    db.refresh(case)
    db.refresh(alert)

    return {
        "case": {
            "id": case.id,
            "title": case.title,
            "status": case.status,
            "priority": case.priority,
            "tracelab_risk_score": case.tracelab_risk_score,
        },
        "alert": _alert_to_dict(alert),
    }
