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
    current_user: User = Depends(RoleChecker([
        Role.TRACE_LAB_ANALYST.value, Role.INVESTIGATOR.value, Role.ADMIN.value, Role.SUPER_ADMIN.value
    ])),
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
    current_user: User = Depends(RoleChecker([
        Role.INVESTIGATOR.value, Role.ADMIN.value, Role.SUPER_ADMIN.value
    ])),
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
    current_user: User = Depends(RoleChecker([Role.ADMIN.value, Role.SUPER_ADMIN.value])),
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


@router.post("/{alert_id}/escalate")
def escalate_alert_to_case(
    alert_id: int,
    current_user: User = Depends(RoleChecker([
        Role.INVESTIGATOR.value, Role.ADMIN.value, Role.SUPER_ADMIN.value
    ])),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """Escalate an alert to an investigation case."""
    alert = _query_alerts_for_user(db, current_user, org_id).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found.")
        
    if alert.case_id:
        raise HTTPException(status_code=400, detail="Alert is already linked to a case.")
        
    # Create the case
    workflow_instance = _sync_workflow_for_alert(
        db=db,
        org_id=org_id,
        workflow_id=alert.workflow_instance_id,
        actor_id=current_user.id,
        to_status="INVESTIGATION_IN_PROGRESS",
        stage="CASE_CREATED",
        note=f"Alert #{alert.id} escalated to investigation",
        is_super_admin=current_user.role == Role.SUPER_ADMIN.value,
    )
    workflow_org_id = workflow_instance.organization_id if workflow_instance else org_id

    case = Case(
        organization_id=workflow_org_id,
        created_by_id=current_user.id,
        workflow_instance_id=workflow_instance.id if workflow_instance else alert.workflow_instance_id,
        title=f"Investigation for Alert #{alert.id} ({alert.alert_type})",
        priority=alert.severity,
        analysis_job_id=alert.analysis_job_id,
        notes=f"Escalated from Alert #{alert.id}. Detection Reason: {alert.detection_reason}"
    )
    db.add(case)
    db.flush() # Get case.id
    
    # Update alert
    alert.status = "ESCALATED"
    alert.case_id = case.id
    alert.workflow_instance_id = workflow_instance.id if workflow_instance else alert.workflow_instance_id
    if workflow_instance:
        workflow_instance.case_id = case.id
        db.add(ActivityTimeline(
            organization_id=workflow_org_id,
            workflow_instance_id=workflow_instance.id,
            actor_id=current_user.id,
            action="CASE_LINK",
            from_status=workflow_instance.current_status,
            to_status=workflow_instance.current_status,
            details=f"Linked alert #{alert.id} to case #{case.id}",
        ))
    db.commit()
    
    return {"message": "Alert escalated successfully", "case_id": case.id}
