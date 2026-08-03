from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel

from api.deps import get_current_user, get_current_workspace, RoleChecker
from db.database import get_db
from models.user import User
from models.role import Role
from models.workflow_instance import WorkflowInstance
from models.activity_timeline import ActivityTimeline
from models.assignment import Assignment
from models.service_request import ServiceRequest

router = APIRouter(prefix="/workflow-instances", tags=["workflow"])


class WorkflowTransition(BaseModel):
    status: Optional[str] = None
    stage: Optional[str] = None
    note: Optional[str] = None


class WorkflowAssign(BaseModel):
    assignee_id: int


def _workflow_to_dict(instance: WorkflowInstance) -> dict:
    return {
        "id": instance.id,
        "organization_id": instance.organization_id,
        "service_request_id": instance.service_request_id,
        "case_id": instance.case_id,
        "report_id": instance.report_id,
        "current_status": instance.current_status,
        "current_stage": instance.current_stage,
        "owner_id": instance.owner_id,
        "assignee_id": instance.assignee_id,
        "last_note": instance.last_note,
        "created_at": instance.created_at.isoformat() if instance.created_at else None,
        "updated_at": instance.updated_at.isoformat() if instance.updated_at else None,
    }


def _get_workflow_instance(db: Session, current_user: User, org_id: int, workflow_id: int):
    query = db.query(WorkflowInstance).filter(WorkflowInstance.id == workflow_id)
    if current_user.role != Role.SUPER_ADMIN.value:
        query = query.filter(WorkflowInstance.organization_id == org_id)
    return query.first()


@router.patch("/{workflow_id}/transition")
def transition_workflow(
    workflow_id: int,
    body: WorkflowTransition,
    current_user: User = Depends(RoleChecker([Role.ADMIN.value, Role.SUPER_ADMIN.value, Role.TRACE_LAB_ANALYST.value, Role.INVESTIGATOR.value])),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    instance = _get_workflow_instance(db, current_user, org_id, workflow_id)
    if not instance:
        raise HTTPException(status_code=404, detail="Workflow instance not found")

    old_status = instance.current_status
    if body.status:
        instance.current_status = body.status.upper()
    if body.stage:
        instance.current_stage = body.stage.upper()
    if body.note:
        instance.last_note = body.note

    db.add(ActivityTimeline(
        organization_id=instance.organization_id,
        workflow_instance_id=instance.id,
        actor_id=current_user.id,
        action="TRANSITION",
        from_status=old_status,
        to_status=instance.current_status,
        details=body.note,
    ))
    db.commit()
    db.refresh(instance)
    return _workflow_to_dict(instance)


@router.post("/{workflow_id}/assign")
def assign_workflow(
    workflow_id: int,
    body: WorkflowAssign,
    current_user: User = Depends(RoleChecker([Role.ADMIN.value, Role.SUPER_ADMIN.value])),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    instance = _get_workflow_instance(db, current_user, org_id, workflow_id)
    if not instance:
        raise HTTPException(status_code=404, detail="Workflow instance not found")

    assignee = db.query(User).filter(User.id == body.assignee_id, User.organization_id == org_id).first()
    if not assignee:
        raise HTTPException(status_code=404, detail="Assignee not found")

    instance.assignee_id = assignee.id
    instance.owner_id = current_user.id

    db.add(Assignment(
        organization_id=instance.organization_id,
        workflow_instance_id=instance.id,
        entity_type="SERVICE_REQUEST",
        entity_id=instance.service_request_id or 0,
        assignee_id=assignee.id,
        assigned_by_id=current_user.id,
        status="ACTIVE",
    ))
    db.add(ActivityTimeline(
        organization_id=instance.organization_id,
        workflow_instance_id=instance.id,
        actor_id=current_user.id,
        action="ASSIGN",
        from_status=instance.current_status,
        to_status=instance.current_status,
        details=f"Assigned to {assignee.username}",
    ))
    db.commit()
    db.refresh(instance)
    return {"workflow_id": instance.id, "assignee_id": instance.assignee_id}


@router.get("/{workflow_id}/timeline")
def get_workflow_timeline(
    workflow_id: int,
    current_user: User = Depends(get_current_user),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    instance = _get_workflow_instance(db, current_user, org_id, workflow_id)
    if not instance:
        raise HTTPException(status_code=404, detail="Workflow instance not found")

    items = db.query(ActivityTimeline).filter(
        ActivityTimeline.workflow_instance_id == workflow_id,
        ActivityTimeline.organization_id == instance.organization_id,
    ).order_by(ActivityTimeline.created_at.asc()).all()
    return {"items": [
        {
            "id": item.id,
            "action": item.action,
            "from_status": item.from_status,
            "to_status": item.to_status,
            "details": item.details,
            "created_at": item.created_at.isoformat() if item.created_at else None,
        }
        for item in items
    ]}
