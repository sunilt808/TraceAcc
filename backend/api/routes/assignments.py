"""
assignments.py — Employee-facing Assignment API.

Admin assignment of data (service requests) reaches analysts
and invospace investigators through the `assignments` table.
Until now employees had no direct way to list those assignments
or update their progress. This router closes that gap:

    GET    /assignments              List my (or all, for ADMIN) assignments
    PATCH  /assignments/{id}/status  Update lifecycle status

Lifecycle: ACTIVE -> COMPLETED | CANCELLED
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel

from api.deps import get_current_user, get_current_workspace
from db.database import get_db
from models.user import User
from models.role import Role
from models.assignment import Assignment
from models.service_request import ServiceRequest
from models.workflow_instance import WorkflowInstance
from services.notification_service import notify_admins

router = APIRouter(prefix="/assignments", tags=["assignments"])

VALID_STATUSES = {"ACTIVE", "COMPLETED", "CANCELLED"}


class AssignmentStatusUpdate(BaseModel):
    status: str


def _assignment_to_dict(db: Session, a: Assignment) -> dict:
    """Serialize an assignment with the linked service-request context."""
    sr = (
        db.query(ServiceRequest)
        .filter(ServiceRequest.id == a.entity_id)
        .first()
        if a.entity_type == "SERVICE_REQUEST"
        else None
    )

    workflow = (
        db.query(WorkflowInstance)
        .filter(WorkflowInstance.id == a.workflow_instance_id)
        .first()
    )

    assignee = db.query(User).filter(User.id == a.assignee_id).first()

    return {
        "id": a.id,
        "organization_id": a.organization_id,
        "entity_type": a.entity_type,
        "entity_id": a.entity_id,
        "workflow_instance_id": a.workflow_instance_id,
        "assignee_id": a.assignee_id,
        "assignee_username": assignee.username if assignee else None,
        "assigned_by_id": a.assigned_by_id,
        "status": a.status,
        "due_at": a.due_at.isoformat() if a.due_at else None,
        "created_at": a.created_at.isoformat() if a.created_at else None,
        "updated_at": a.updated_at.isoformat() if a.updated_at else None,
        # Service request context — the assigned data itself
        "service_request": (
            {
                "id": sr.id,
                "title": sr.title,
                "description": sr.description,
                "request_type": sr.request_type,
                "status": sr.status,
                "dataset_filename": sr.dataset_filename,
                "has_dataset": bool(sr.dataset_path),
                "created_by_id": sr.created_by_id,
            }
            if sr
            else None
        ),
        "request_status": (
            workflow.current_status if workflow else None
        ),
    }


@router.get("")
def list_assignments(
    status: Optional[str] = Query(None),
    mine_only: bool = Query(True),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """
    List assignments.

    - Analyst / InvoSpace / Client: only their own assignments
      (this is the employee work queue fed by admin assignment).
      Assignment rows may belong to a client organization while
      staff sit in an internal organization, so staff scoping is
      by assignee, not by organization.
    - ADMIN: own assignments by default; pass ?mine_only=false to
      see every assignment across the platform.
    """
    q = db.query(Assignment)

    if current_user.role == Role.ADMIN.value and not mine_only:
        pass  # platform-wide view
    else:
        q = q.filter(Assignment.assignee_id == current_user.id)

    if status:
        q = q.filter(Assignment.status == status.upper())

    total = q.count()
    items = (
        q.order_by(Assignment.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return {"items": [_assignment_to_dict(db, a) for a in items], "total": total}


@router.patch("/{assignment_id}/status")
def update_assignment_status(
    assignment_id: int,
    body: AssignmentStatusUpdate,
    current_user: User = Depends(get_current_user),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """
    Update the lifecycle status of an assignment.

    - The assignee can mark their own work COMPLETED or CANCELLED.
    - ADMIN can update any assignment.
    """
    new_status = body.status.upper()
    if new_status not in VALID_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"status must be one of {sorted(VALID_STATUSES)}",
        )

    assignment = (
        db.query(Assignment)
        .filter(Assignment.id == assignment_id)
        .first()
    )

    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found.")

    is_admin = current_user.role == Role.ADMIN.value

    if not is_admin and assignment.assignee_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="This assignment does not belong to you.",
        )

    org_id = assignment.organization_id
    old_status = assignment.status
    assignment.status = new_status

    # Keep the workflow + service request in step with progress.
    workflow = (
        db.query(WorkflowInstance)
        .filter(WorkflowInstance.id == assignment.workflow_instance_id)
        .first()
    )

    from models.activity_timeline import ActivityTimeline

    if workflow is not None:
        db.add(ActivityTimeline(
            organization_id=org_id,
            workflow_instance_id=workflow.id,
            actor_id=current_user.id,
            action="ASSIGNMENT_STATUS",
            from_status=old_status,
            to_status=new_status,
            details=f"Assignment #{assignment.id} marked {new_status} by {current_user.username}",
        ))

    if new_status == "COMPLETED":
        sr = (
            db.query(ServiceRequest)
            .filter(ServiceRequest.id == assignment.entity_id)
            .first()
        )
        if sr and current_user.role != Role.ADMIN.value:
            sr.status = "COMPLETED"

        notify_admins(
            db,
            org_id=org_id,
            notification_type="ASSIGNMENT_COMPLETED",
            title="Assignment completed",
            message=(
                f"{current_user.username} completed assignment "
                f"#{assignment.id}."
            ),
            resource_type="SERVICE_REQUEST",
            resource_id=assignment.entity_id,
        )

    db.commit()
    db.refresh(assignment)

    return _assignment_to_dict(db, assignment)
