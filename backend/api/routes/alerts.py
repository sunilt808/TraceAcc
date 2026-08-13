"""
alerts.py - Alerts Management API.
Allows fetching, triaging, and escalating alerts.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from api.deps import get_current_user, get_current_workspace, RoleChecker
from db.database import get_db
from models.user import User
from models.role import Role
from models.alert import Alert
from models.case import Case
from models.activity_timeline import ActivityTimeline
from models.workflow_instance import WorkflowInstance
from pydantic import BaseModel
from core.permissions import require_permission, require_any_permission

class AlertAssign(BaseModel):
    assignee_id: int

router = APIRouter(prefix="/alerts", tags=["alerts"])


def _query_alerts_for_user(db: Session, current_user: User, org_id: int):
    query = db.query(Alert)
    if current_user.role != Role.SUPER_ADMIN.value:
        query = query.filter(Alert.organization_id == org_id)
    return query


def _alert_to_dict(alert: Alert) -> dict:
    return {
        "id": alert.id,
        "analysis_job_id": alert.analysis_job_id,
        "case_id": alert.case_id,
        "workflow_instance_id": alert.workflow_instance_id,
        "alert_type": alert.alert_type,
        "risk_score": alert.risk_score,
        "severity": alert.severity,
        "status": alert.status,
        "detection_reason": alert.detection_reason,
        "related_accounts": alert.related_accounts,
        "assignee_id": alert.assignee_id,
        "created_at": alert.created_at.isoformat() if alert.created_at else None,
        "updated_at": alert.updated_at.isoformat() if alert.updated_at else None,
    }

@router.get("")
def list_alerts(
    status: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(require_any_permission("alert.view_all", "alert.view_assigned")),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """List all alerts for the organization."""
    q = _query_alerts_for_user(db, current_user, org_id)
    if status:
        q = q.filter(Alert.status == status.upper())
        
    alerts = q.order_by(Alert.created_at.desc()).offset(offset).limit(limit).all()
    return {"items": [_alert_to_dict(a) for a in alerts], "total": q.count()}

@router.patch("/{alert_id}/status")
def update_alert_status(
    alert_id: int,
    status: str = Query(...),
    current_user: User = Depends(require_permission("alert.update")),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """Update an alert's status (e.g., TRIAGED, FALSE_POSITIVE)."""
    VALID_STATUSES = {"NEW", "TRIAGED", "FALSE_POSITIVE", "ESCALATED"}
    status = status.upper()
    if status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of {VALID_STATUSES}")
        
    alert = _query_alerts_for_user(db, current_user, org_id).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found.")
        
    alert.status = status
    db.commit()
    db.refresh(alert)
    return _alert_to_dict(alert)

@router.patch("/{alert_id}/assign")
def assign_alert(
    alert_id: int,
    body: AlertAssign,
    current_user: User = Depends(require_permission("alert.route_to_invospace")),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """Assign an alert to a specific user."""
    alert = _query_alerts_for_user(db, current_user, org_id).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found.")
        
    assignee = db.query(User).filter(User.id == body.assignee_id, User.organization_id == org_id).first()
    if not assignee:
        raise HTTPException(status_code=404, detail="Assignee not found in this organization.")
        
    alert.assignee_id = assignee.id
    db.commit()
    db.refresh(alert)
    return _alert_to_dict(alert)

def _sync_workflow_for_alert(db: Session, org_id: int, workflow_id: Optional[int], actor_id: int, to_status: str, stage: str, note: str, is_super_admin: bool = False):
    if not workflow_id:
        workflow = WorkflowInstance(
            organization_id=org_id,
            current_status=to_status,
            current_stage=stage,
            owner_id=actor_id,
            assignee_id=actor_id,
        )
        db.add(workflow)
        db.flush()
        workflow_id = workflow.id

    workflow = db.query(WorkflowInstance).filter(
        WorkflowInstance.id == workflow_id,
        *( [] if is_super_admin else [WorkflowInstance.organization_id == org_id] ),
    ).first()
    if not workflow:
        return None

    from_status = workflow.current_status
    workflow_org_id = workflow.organization_id
    workflow.current_status = to_status
    workflow.current_stage = stage
    workflow.last_note = note
    db.add(ActivityTimeline(
        organization_id=workflow_org_id,
        workflow_instance_id=workflow.id,
        actor_id=actor_id,
        action="TRANSITION",
        from_status=from_status,
        to_status=to_status,
        details=note,
    ))
    return workflow

class AlertCreate(BaseModel):
    service_request_id: Optional[int] = None
    alert_type: str
    pattern_type: Optional[str] = None
    risk_score: float = 0.0
    severity: str = "MEDIUM"
    trigger_reason: Optional[str] = None

@router.post("", status_code=201)
def create_alert(
    body: AlertCreate,
    current_user: User = Depends(require_permission("alert.create")),
    db: Session = Depends(get_db),
):
    """Analyst creates a new alert."""
    alert = Alert(
        organization_id=current_user.organization_id,
        service_request_id=body.service_request_id,
        alert_type=body.alert_type,
        pattern_type=body.pattern_type,
        risk_score=body.risk_score,
        severity=body.severity,
        trigger_reason=body.trigger_reason,
        created_by_id=current_user.id,
        status="NEW"
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return _alert_to_dict(alert)

@router.post("/{alert_id}/escalate")
def escalate_alert_to_admin(
    alert_id: int,
    current_user: User = Depends(require_permission("alert.escalate_to_admin")),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """Analyst escalates an alert to Admin (NOT to case directly)."""
    alert = _query_alerts_for_user(db, current_user, org_id).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found.")
        
    alert.status = "ESCALATED"
    alert.escalated_by_id = current_user.id
    
    _sync_workflow_for_alert(
        db=db,
        org_id=org_id,
        workflow_id=alert.workflow_instance_id,
        actor_id=current_user.id,
        to_status="ESCALATED",
        stage="ALERT_ESCALATED",
        note=f"Alert #{alert.id} escalated to Admin",
        is_super_admin=current_user.role == Role.SUPER_ADMIN.value,
    )
    db.commit()
    return _alert_to_dict(alert)
