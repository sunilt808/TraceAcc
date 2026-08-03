"""
admin.py — Admin Management API.

Provides admin-only endpoints for user management,
organization management, and system dashboard stats.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func as sa_func
from typing import Optional
from pydantic import BaseModel
from datetime import datetime, timezone

from api.deps import get_current_user, RoleChecker
from db.database import get_db
from models.user import User
from models.role import Role
from models.organization import Organization
from models.case import Case
from models.alert import Alert
from models.service_request import ServiceRequest
from models.workflow_instance import WorkflowInstance
from models.assignment import Assignment
from models.activity_timeline import ActivityTimeline
from models.client_report import ClientReport

router = APIRouter(prefix="/admin", tags=["admin"])

# ---------- Schemas ----------

class UserUpdate(BaseModel):
    role: Optional[str] = None
    is_active: Optional[bool] = None
    organization_id: Optional[int] = None


class OrganizationCreate(BaseModel):
    name: str


class RequestReviewAction(BaseModel):
    action: str
    assignee_id: Optional[int] = None
    note: Optional[str] = None
    due_at: Optional[datetime] = None


class ReportReviewAction(BaseModel):
    action: str
    note: Optional[str] = None


# ---------- User Management ----------

@router.get("/users")
def list_users(
    limit: int = Query(100, le=500),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(RoleChecker([Role.ADMIN.value])),
    db: Session = Depends(get_db),
):
    """List all users. ADMIN sees all users in their org."""
    q = db.query(User)

    if current_user.role == Role.ADMIN.value:
        q = q.filter(User.organization_id == current_user.organization_id)

    total = q.count()
    users = q.order_by(User.created_at.desc()).offset(offset).limit(limit).all()

    return {
        "items": [
            {
                "id": u.id,
                "username": u.username,
                "email": u.email,
                "role": u.role,
                "organization_id": u.organization_id,
                "is_active": u.is_active,
                "last_login": u.last_login.isoformat() if u.last_login else None,
                "created_at": u.created_at.isoformat() if u.created_at else None,
            }
            for u in users
        ],
        "total": total,
    }


@router.patch("/users/{user_id}")
def update_user(
    user_id: int,
    body: UserUpdate,
    current_user: User = Depends(RoleChecker([Role.ADMIN.value])),
    db: Session = Depends(get_db),
):
    """Update a user's role, active status, or organization."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    # Admin can only manage users within their org
    if current_user.role == Role.ADMIN.value and user.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Cannot manage users outside your organization.")

    # Prevent self-demotion
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot modify your own account via admin API.")

    valid_roles = {r.value for r in Role}
    if body.role is not None:
        if body.role not in valid_roles:
            raise HTTPException(status_code=400, detail=f"role must be one of {valid_roles}")
        # ADMIN assigning roles
        user.role = body.role

    if body.is_active is not None:
        user.is_active = body.is_active

    if body.organization_id is not None:
        user.organization_id = body.organization_id

    db.commit()
    db.refresh(user)
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "role": user.role,
        "organization_id": user.organization_id,
        "is_active": user.is_active,
    }


# ---------- Organization Management ----------


def _request_queue_item(db: Session, request: ServiceRequest) -> dict:
    workflow = db.query(WorkflowInstance).filter(WorkflowInstance.service_request_id == request.id).order_by(WorkflowInstance.created_at.desc()).first()
    assignee = db.query(User).filter(User.id == request.assigned_to_id).first() if request.assigned_to_id else None
    latest_assignment = None
    if workflow:
        latest_assignment = db.query(Assignment).filter(Assignment.workflow_instance_id == workflow.id).order_by(Assignment.created_at.desc()).first()

    assigned_team = None
    if assignee:
        if assignee.role == Role.TRACE_LAB_ANALYST.value:
            assigned_team = "TraceLab"
        elif assignee.role == Role.INVESTIGATOR.value:
            assigned_team = "InvoSpace"
        else:
            assigned_team = assignee.role

    return {
        "id": request.id,
        "organization_id": request.organization_id,
        "title": request.title,
        "description": request.description,
        "request_type": request.request_type,
        "status": request.status,
        "assigned_to_id": request.assigned_to_id,
        "assigned_user": assignee.username if assignee else None,
        "assigned_team": assigned_team,
        "priority": "HIGH" if request.request_type == "INVESTIGATION" else "MEDIUM",
        "due_at": latest_assignment.due_at.isoformat() if latest_assignment and latest_assignment.due_at else None,
        "workflow_instance_id": workflow.id if workflow else None,
        "current_stage": workflow.current_stage if workflow else None,
        "current_status": workflow.current_status if workflow else request.status,
        "created_at": request.created_at.isoformat() if request.created_at else None,
        "updated_at": request.updated_at.isoformat() if request.updated_at else None,
    }


def _service_request_workflow(db: Session, request_id: int, org_id: int):
    return db.query(WorkflowInstance).filter(
        WorkflowInstance.service_request_id == request_id,
        WorkflowInstance.organization_id == org_id,
    ).order_by(WorkflowInstance.created_at.desc()).first()


def _record_workflow_event(db: Session, workflow: WorkflowInstance, actor_id: int, action: str, from_status: str, to_status: str, note: Optional[str]):
    db.add(ActivityTimeline(
        organization_id=workflow.organization_id,
        workflow_instance_id=workflow.id,
        actor_id=actor_id,
        action=action,
        from_status=from_status,
        to_status=to_status,
        details=note,
    ))


def _service_request_scope_query(db: Session, current_user: User):
    query = db.query(ServiceRequest)
    if current_user.role != Role.SUPER_ADMIN.value:
        query = query.filter(ServiceRequest.organization_id == current_user.organization_id)
    return query


def _service_request_for_review(db: Session, current_user: User, request_id: int):
    request = db.query(ServiceRequest).filter(ServiceRequest.id == request_id)
    if current_user.role != Role.SUPER_ADMIN.value:
        request = request.filter(ServiceRequest.organization_id == current_user.organization_id)
    return request.first()


@router.get("/request-queue")
def request_queue(
    status: Optional[str] = Query(None),
    current_user: User = Depends(RoleChecker([Role.ADMIN.value, Role.SUPER_ADMIN.value])),
    db: Session = Depends(get_db),
):
    q = _service_request_scope_query(db, current_user)
    if status:
        q = q.filter(ServiceRequest.status == status.upper())
    items = q.order_by(ServiceRequest.created_at.desc()).all()
    grouped = {key: 0 for key in ["PENDING", "APPROVED", "REJECTED", "IN_PROGRESS", "COMPLETED"]}
    for request in _service_request_scope_query(db, current_user).all():
        grouped[request.status] = grouped.get(request.status, 0) + 1

    return {
        "items": [_request_queue_item(db, request) for request in items],
        "counts": grouped,
        "total": len(items),
    }


@router.patch("/service-requests/{request_id}/review")
def review_service_request(
    request_id: int,
    body: RequestReviewAction,
    current_user: User = Depends(RoleChecker([Role.ADMIN.value, Role.SUPER_ADMIN.value])),
    db: Session = Depends(get_db),
):
    request = _service_request_for_review(db, current_user, request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Service request not found.")

    org_id = request.organization_id
    workflow = _service_request_workflow(db, request.id, org_id)
    action = body.action.upper()
    valid_actions = {"ACCEPT", "REJECT", "ASSIGN_TRACELAB", "ASSIGN_INVOSPACE", "REASSIGN"}
    if action not in valid_actions:
        raise HTTPException(status_code=400, detail=f"action must be one of {valid_actions}")

    old_status = request.status
    old_stage = workflow.current_stage if workflow else None

    if action == "ACCEPT":
        request.status = "APPROVED"
        if workflow:
            workflow.current_status = "APPROVED"
            workflow.current_stage = "ADMIN_REVIEW"
            workflow.last_note = body.note or "Request accepted"
            _record_workflow_event(db, workflow, current_user.id, "TRANSITION", old_status, request.status, body.note or "Request accepted")
    elif action == "REJECT":
        request.status = "REJECTED"
        if workflow:
            workflow.current_status = "REJECTED"
            workflow.current_stage = "ADMIN_REVIEW"
            workflow.last_note = body.note or "Request rejected"
            _record_workflow_event(db, workflow, current_user.id, "TRANSITION", old_status, request.status, body.note or "Request rejected")
    else:
        if not body.assignee_id:
            raise HTTPException(status_code=400, detail="assignee_id is required for assignment actions.")
        assignee_query = db.query(User).filter(User.id == body.assignee_id)
        if current_user.role != Role.SUPER_ADMIN.value:
            assignee_query = assignee_query.filter(User.organization_id == org_id)
        assignee = assignee_query.first()
        if not assignee:
            raise HTTPException(status_code=404, detail="Assignee not found in this organization.")
        request.assigned_to_id = assignee.id
        request.status = "IN_PROGRESS"
        if workflow:
            workflow.assignee_id = assignee.id
            workflow.owner_id = current_user.id
            workflow.current_status = "IN_PROGRESS"
            workflow.current_stage = "TRACE_LAB" if action == "ASSIGN_TRACELAB" else "INVOSPACE"
            workflow.last_note = body.note or f"Assigned to {assignee.username}"
            db.add(Assignment(
                organization_id=org_id,
                workflow_instance_id=workflow.id,
                entity_type="SERVICE_REQUEST",
                entity_id=request.id,
                assignee_id=assignee.id,
                assigned_by_id=current_user.id,
                status="ACTIVE",
                due_at=body.due_at,
            ))
            _record_workflow_event(db, workflow, current_user.id, "ASSIGN", old_stage or old_status, workflow.current_stage, body.note or f"Assigned to {assignee.username}")

    if body.note:
        request.admin_notes = body.note

    db.add(ActivityTimeline(
        organization_id=org_id,
        workflow_instance_id=workflow.id if workflow else 0,
        actor_id=current_user.id,
        action="REQUEST_REVIEW",
        from_status=old_status,
        to_status=request.status,
        details=body.note,
    )) if workflow else None

    db.commit()
    return _request_queue_item(db, request)


@router.get("/report-queue")
def report_queue(
    status: Optional[str] = Query(None),
    current_user: User = Depends(RoleChecker([Role.ADMIN.value, Role.SUPER_ADMIN.value])),
    db: Session = Depends(get_db),
):
    q = db.query(ClientReport)
    if current_user.role != Role.SUPER_ADMIN.value:
        q = q.filter(ClientReport.organization_id == current_user.organization_id)
    if status:
        q = q.filter(ClientReport.status == status.upper())
    items = q.order_by(ClientReport.created_at.desc()).all()
    return {
        "items": [
            {
                "id": report.id,
                "title": report.title,
                "status": report.status,
                "report_type": report.report_type,
                "is_released": report.is_released,
                "case_id": report.case_id,
                "service_request_id": report.service_request_id,
                "created_at": report.created_at.isoformat() if report.created_at else None,
                "updated_at": report.updated_at.isoformat() if report.updated_at else None,
            }
            for report in items
        ],
        "total": len(items),
    }


@router.patch("/reports/{report_id}/review")
def review_report(
    report_id: int,
    body: ReportReviewAction,
    current_user: User = Depends(RoleChecker([Role.ADMIN.value, Role.SUPER_ADMIN.value])),
    db: Session = Depends(get_db),
):
    report = db.query(ClientReport).filter(ClientReport.id == report_id)
    if current_user.role != Role.SUPER_ADMIN.value:
        report = report.filter(ClientReport.organization_id == current_user.organization_id)
    report = report.first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found.")

    action = body.action.upper()
    valid_actions = {"APPROVE", "REQUEST_CHANGES", "REJECT", "RELEASE"}
    if action not in valid_actions:
        raise HTTPException(status_code=400, detail=f"action must be one of {valid_actions}")

    workflow = None
    if report.workflow_instance_id:
        workflow = db.query(WorkflowInstance).filter(
            WorkflowInstance.id == report.workflow_instance_id,
            WorkflowInstance.organization_id == report.organization_id,
        ).first()

    previous_status = report.status
    if action == "APPROVE":
        report.status = "APPROVED"
        if workflow:
            workflow.current_status = "APPROVED"
            workflow.current_stage = "REPORT_REVIEW"
            workflow.last_note = body.note or "Report approved"
    elif action == "REQUEST_CHANGES":
        report.status = "CHANGES_REQUESTED"
        if workflow:
            workflow.current_status = "CHANGES_REQUESTED"
            workflow.current_stage = "REPORT_REVIEW"
            workflow.last_note = body.note or "Changes requested"
    elif action == "REJECT":
        report.status = "REJECTED"
        if workflow:
            workflow.current_status = "REJECTED"
            workflow.current_stage = "REPORT_REVIEW"
            workflow.last_note = body.note or "Report rejected"
    elif action == "RELEASE":
        if report.file_path is None:
            raise HTTPException(status_code=400, detail="Cannot release a report without an uploaded file.")
        report.status = "RELEASED"
        report.is_released = True
        report.released_at = datetime.now(timezone.utc)
        report.released_by_id = current_user.id
        if workflow:
            workflow.current_status = "CLOSED"
            workflow.current_stage = "REPORT_RELEASED"
            workflow.last_note = body.note or "Report released to client"

    db.add(ActivityTimeline(
        organization_id=report.organization_id,
        workflow_instance_id=workflow.id if workflow else 0,
        actor_id=current_user.id,
        action="REPORT_REVIEW",
        from_status=previous_status,
        to_status=report.status,
        details=body.note,
    )) if workflow else None
    db.commit()
    db.refresh(report)
    return {
        "id": report.id,
        "status": report.status,
        "is_released": report.is_released,
        "released_at": report.released_at.isoformat() if report.released_at else None,
    }

@router.get("/organizations")
def list_organizations(
    current_user: User = Depends(RoleChecker([Role.ADMIN.value])),
    db: Session = Depends(get_db),
):
    """List all organizations."""
    orgs = db.query(Organization).order_by(Organization.created_at.desc()).all()
    return [
        {
            "id": o.id,
            "name": o.name,
            "created_at": o.created_at.isoformat() if o.created_at else None,
        }
        for o in orgs
    ]


@router.post("/organizations", status_code=201)
def create_organization(
    body: OrganizationCreate,
    current_user: User = Depends(RoleChecker([Role.ADMIN.value])),
    db: Session = Depends(get_db),
):
    """Create a new client organization."""
    existing = db.query(Organization).filter(Organization.name == body.name).first()
    if existing:
        raise HTTPException(status_code=409, detail="Organization with this name already exists.")

    org = Organization(name=body.name)
    db.add(org)
    db.commit()
    db.refresh(org)
    return {"id": org.id, "name": org.name, "created_at": org.created_at.isoformat() if org.created_at else None}


# ---------- Dashboard Stats ----------

@router.get("/operations-queue")
def operations_queue(
    limit: int = Query(20, le=100),
    current_user: User = Depends(RoleChecker([Role.ADMIN.value, Role.SUPER_ADMIN.value])),
    db: Session = Depends(get_db),
):
    """Return a lightweight operations queue for admins to review workflow items."""
    org_id = current_user.organization_id
    items = []
    workflows = db.query(WorkflowInstance).filter(
        WorkflowInstance.organization_id == org_id,
    ).order_by(WorkflowInstance.created_at.desc()).limit(limit).all()

    for workflow in workflows:
        entry = {
            "id": workflow.id,
            "type": "WORKFLOW",
            "title": "Workflow item",
            "current_status": workflow.current_status,
            "current_stage": workflow.current_stage,
            "last_note": workflow.last_note,
            "created_at": workflow.created_at.isoformat() if workflow.created_at else None,
        }
        if workflow.service_request_id:
            sr = db.query(ServiceRequest).filter(ServiceRequest.id == workflow.service_request_id).first()
            if sr:
                entry["title"] = sr.title
                entry["service_request_id"] = sr.id
                entry["request_status"] = sr.status
        if workflow.case_id:
            case = db.query(Case).filter(Case.id == workflow.case_id).first()
            if case:
                entry["case_id"] = case.id
                entry["case_title"] = case.title
        items.append(entry)

    return {"items": items, "total": len(items)}


@router.get("/dashboard")
def admin_dashboard(
    current_user: User = Depends(RoleChecker([Role.ADMIN.value, Role.SUPER_ADMIN.value])),
    db: Session = Depends(get_db),
):
    """System-wide dashboard stats for admin."""
    # System-wide stats are no longer supported for standard ADMIN.
    # We now fetch only org-specific stats.
    org_id = None if current_user.role == Role.SUPER_ADMIN.value else current_user.organization_id
    user_query = db.query(User)
    case_query = db.query(Case)
    alert_query = db.query(Alert)
    request_query = db.query(ServiceRequest)
    if org_id is not None:
        user_query = user_query.filter(User.organization_id == org_id)
        case_query = case_query.filter(Case.organization_id == org_id)
        alert_query = alert_query.filter(Alert.organization_id == org_id)
        request_query = request_query.filter(ServiceRequest.organization_id == org_id)

    total_users = user_query.count()
    total_orgs = db.query(sa_func.count(Organization.id)).scalar() if org_id is None else 1
    total_cases = case_query.count()
    open_cases = case_query.filter(Case.status.in_(["OPEN", "INVESTIGATING", "REVIEW"])).count()
    total_alerts = alert_query.count()
    new_alerts = alert_query.filter(Alert.status == "NEW").count()
    total_requests = request_query.count()
    pending_requests = request_query.filter(ServiceRequest.status == "PENDING").count()

    return {
        "total_users": total_users,
        "total_organizations": total_orgs,
        "total_cases": total_cases,
        "open_cases": open_cases,
        "total_alerts": total_alerts,
        "new_alerts": new_alerts,
        "total_requests": total_requests,
        "pending_requests": pending_requests,
    }
