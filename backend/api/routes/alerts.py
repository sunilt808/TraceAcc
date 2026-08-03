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
from pydantic import BaseModel

class AlertAssign(BaseModel):
    assignee_id: int

router = APIRouter(prefix="/alerts", tags=["alerts"])

def _alert_to_dict(alert: Alert) -> dict:
    return {
        "id": alert.id,
        "analysis_job_id": alert.analysis_job_id,
        "case_id": alert.case_id,
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
        Role.TRACE_LAB_ANALYST.value, Role.INVESTIGATOR.value, Role.ADMIN.value
    ])),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """List all alerts for the organization."""
    q = db.query(Alert).filter(Alert.organization_id == org_id)
    if status:
        q = q.filter(Alert.status == status.upper())
        
    alerts = q.order_by(Alert.created_at.desc()).offset(offset).limit(limit).all()
    return {"items": [_alert_to_dict(a) for a in alerts], "total": q.count()}

@router.patch("/{alert_id}/status")
def update_alert_status(
    alert_id: int,
    status: str = Query(...),
    current_user: User = Depends(RoleChecker([
        Role.INVESTIGATOR.value, Role.ADMIN.value
    ])),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """Update an alert's status (e.g., TRIAGED, FALSE_POSITIVE)."""
    VALID_STATUSES = {"NEW", "TRIAGED", "FALSE_POSITIVE", "ESCALATED"}
    status = status.upper()
    if status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of {VALID_STATUSES}")
        
    alert = db.query(Alert).filter(Alert.id == alert_id, Alert.organization_id == org_id).first()
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
    current_user: User = Depends(RoleChecker([Role.ADMIN.value])),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """Assign an alert to a specific user."""
    alert = db.query(Alert).filter(Alert.id == alert_id, Alert.organization_id == org_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found.")
        
    assignee = db.query(User).filter(User.id == body.assignee_id, User.organization_id == org_id).first()
    if not assignee:
        raise HTTPException(status_code=404, detail="Assignee not found in this organization.")
        
    alert.assignee_id = assignee.id
    db.commit()
    db.refresh(alert)
    return _alert_to_dict(alert)

@router.post("/{alert_id}/escalate")
def escalate_alert_to_case(
    alert_id: int,
    current_user: User = Depends(RoleChecker([
        Role.INVESTIGATOR.value, Role.ADMIN.value
    ])),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """Escalate an alert to an investigation case."""
    alert = db.query(Alert).filter(Alert.id == alert_id, Alert.organization_id == org_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found.")
        
    if alert.case_id:
        raise HTTPException(status_code=400, detail="Alert is already linked to a case.")
        
    # Create the case
    case = Case(
        organization_id=org_id,
        created_by_id=current_user.id,
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
    db.commit()
    
    return {"message": "Alert escalated successfully", "case_id": case.id}
