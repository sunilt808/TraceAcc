"""
service_requests.py — Client Service Request API.

Allows client users to submit service requests, upload datasets,
and allows admins to review, assign, and manage requests.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel

from api.deps import get_current_user, get_current_workspace, RoleChecker
from db.database import get_db
from models.user import User
from models.role import Role
from models.service_request import ServiceRequest
from models.workflow_instance import WorkflowInstance
from models.activity_timeline import ActivityTimeline
from services.storage_service import StorageService

router = APIRouter(prefix="/service-requests", tags=["service-requests"])

# ---------- Pydantic Schemas ----------

class ServiceRequestCreate(BaseModel):
    title: str
    description: Optional[str] = None
    request_type: str = "ANALYSIS"  # ANALYSIS | INVESTIGATION | AUDIT


class ServiceRequestUpdate(BaseModel):
    status: Optional[str] = None
    assigned_to_id: Optional[int] = None
    admin_notes: Optional[str] = None


# ---------- Helpers ----------

VALID_TYPES = {"ANALYSIS", "INVESTIGATION", "AUDIT"}
VALID_STATUSES = {"SUBMITTED", "APPROVED", "IN_PROGRESS", "COMPLETED", "REJECTED"}


def _sr_workflow(db: Session, request_id: int, org_id: int):
    return db.query(WorkflowInstance).filter(
        WorkflowInstance.service_request_id == request_id,
        WorkflowInstance.organization_id == org_id,
    ).order_by(WorkflowInstance.created_at.desc()).first()


def _sr_to_dict(db: Session, sr: ServiceRequest) -> dict:
    from models.case import Case
    from models.report_release import ReportRelease

    workflow = _sr_workflow(db, sr.id, sr.organization_id)
    linked_case = db.query(Case).filter(Case.service_request_id == sr.id).order_by(Case.id.desc()).first()

    # Robust fallback: match case by title / description / organization if service_request_id wasn't set
    if not linked_case and sr.title:
        linked_case = db.query(Case).filter(
            Case.organization_id == sr.organization_id,
            (Case.title.contains(sr.title)) | (Case.description.contains(sr.title))
        ).order_by(Case.id.desc()).first()
        if linked_case and linked_case.service_request_id is None:
            try:
                linked_case.service_request_id = sr.id
                db.add(linked_case)
                db.commit()
            except Exception:
                db.rollback()

    status = sr.status
    stage = workflow.current_stage if workflow else None
    wf_status = workflow.current_status if workflow else None

    # Check if a report has been released for this case/service request or organization
    has_release = False
    if linked_case:
        has_release = db.query(ReportRelease).filter(
            ReportRelease.case_id == linked_case.id,
            ReportRelease.is_active == True
        ).first() is not None

        if linked_case.status == "CLOSED" or has_release:
            status = "COMPLETED"
            stage = "CASE_CLOSED"
            wf_status = "COMPLETED"
            # Persist completion to ServiceRequest and WorkflowInstance if not already set
            if sr.status != "COMPLETED":
                sr.status = "COMPLETED"
                db.add(sr)
                if workflow:
                    workflow.current_status = "COMPLETED"
                    workflow.current_stage = "CASE_CLOSED"
                    db.add(workflow)
                try:
                    db.commit()
                except Exception:
                    db.rollback()
        elif linked_case.status in ("APPROVED", "PENDING_REVIEW"):
            status = "IN_PROGRESS"
            stage = "REPORT_REVIEW"
            wf_status = "AWAITING_REVIEW"
        elif linked_case.status in ("INVESTIGATING", "IN_PROGRESS", "ASSIGNED", "EVIDENCE_REVIEW"):
            status = "IN_PROGRESS"
            stage = "INVESTIGATION"
            wf_status = "INVESTIGATION_IN_PROGRESS"

    return {
        "id": sr.id,
        "organization_id": sr.organization_id,
        "created_by_id": sr.created_by_id,
        "assigned_to_id": sr.assigned_to_id,
        "title": sr.title,
        "description": sr.description,
        "request_type": sr.request_type,
        "status": status,
        "case_id": linked_case.id if linked_case else None,
        "case_status": linked_case.status if linked_case else None,
        "is_report_released": has_release,
        "dataset_filename": sr.dataset_filename,
        "admin_notes": sr.admin_notes,
        "workflow_instance_id": workflow.id if workflow else None,
        "workflow_current_status": wf_status,
        "workflow_current_stage": stage,
        "created_at": sr.created_at.isoformat() if sr.created_at else None,
        "updated_at": sr.updated_at.isoformat() if sr.updated_at else None,
    }


# ---------- Endpoints ----------

@router.post("", status_code=201)
def create_service_request(
    body: ServiceRequestCreate,
    current_user: User = Depends(RoleChecker([
        Role.CLIENT_USER.value, Role.ADMIN.value
    ])),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """Client creates a new service request."""
    if body.request_type.upper() not in VALID_TYPES:
        raise HTTPException(status_code=400, detail=f"request_type must be one of {VALID_TYPES}")

    sr = ServiceRequest(
        organization_id=org_id,
        created_by_id=current_user.id,
        title=body.title,
        description=body.description,
        request_type=body.request_type.upper(),
    )
    db.add(sr)
    db.flush()

    workflow_instance = WorkflowInstance(
        organization_id=org_id,
        service_request_id=sr.id,
        current_status="SUBMITTED",
        current_stage="REQUEST_CREATED",
        owner_id=current_user.id,
        assignee_id=current_user.id,
    )
    db.add(workflow_instance)
    db.flush()
    db.add(ActivityTimeline(
        organization_id=org_id,
        workflow_instance_id=workflow_instance.id,
        actor_id=current_user.id,
        action="CREATED",
        from_status="NEW",
        to_status="SUBMITTED",
        details="Service request created",
    ))

    db.commit()
    db.refresh(sr)

    # Notify admins of the new request
    from services.notification_service import notify_admins

    notify_admins(
        db,
        org_id=org_id,
        notification_type="REQUEST_SUBMITTED",
        title="New service request",
        message=(
            f"{current_user.username} submitted '{sr.title}' "
            f"({sr.request_type})."
        ),
        resource_type="SERVICE_REQUEST",
        resource_id=sr.id,
    )
    db.commit()

    return _sr_to_dict(db, sr)


@router.get("")
def list_service_requests(
    status: Optional[str] = Query(None),
    assigned_to_me: bool = Query(False),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """
    List service requests.
    - CLIENT_USER sees only their own requests (own organization).
    - ADMIN sees all requests in scope.
    - Analyst/Investigator with ?assigned_to_me=true get their
      work queue — assignments may cross organizations because
      internal staff are assigned client-organization requests.
    """

    if current_user.role == Role.CLIENT_USER.value:
        # Clients are strictly tenant-scoped to their own requests
        q = db.query(ServiceRequest).filter(
            ServiceRequest.organization_id == org_id,
            ServiceRequest.created_by_id == current_user.id,
        )
    elif assigned_to_me:
        # Staff work queue — assignment-based, cross-org aware
        q = db.query(ServiceRequest).filter(
            (ServiceRequest.assigned_to_id == current_user.id)
            | (ServiceRequest.assigned_analyst_id == current_user.id)
            | (ServiceRequest.assigned_invospace_id == current_user.id)
        )
    else:
        q = db.query(ServiceRequest).filter(
            ServiceRequest.organization_id == org_id
        )

    if status:
        q = q.filter(ServiceRequest.status == status.upper())

    total = q.count()
    items = q.order_by(ServiceRequest.created_at.desc()).offset(offset).limit(limit).all()
    return {"items": [_sr_to_dict(db, sr) for sr in items], "total": total}


@router.get("/{request_id}")
def get_service_request(
    request_id: int,
    current_user: User = Depends(get_current_user),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """Get a single service request."""
    sr = db.query(ServiceRequest).filter(
        ServiceRequest.id == request_id,
    ).first()

    if not sr:
        raise HTTPException(status_code=404, detail="Service request not found.")

    role = current_user.role
    is_assignee = current_user.id in (
        sr.assigned_to_id,
        sr.assigned_analyst_id,
        sr.assigned_invospace_id,
    )

    if sr.organization_id == org_id:
        # Same-organization access: clients see own requests only
        if current_user.role == Role.CLIENT_USER.value and sr.created_by_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied.")
    elif not is_assignee and current_user.role != Role.ADMIN.value:
        # Cross-organization access only for assigned staff or ADMIN
        raise HTTPException(status_code=404, detail="Service request not found.")

    return _sr_to_dict(db, sr)


@router.patch("/{request_id}")
def update_service_request(
    request_id: int,
    body: ServiceRequestUpdate,
    current_user: User = Depends(RoleChecker([
        Role.ADMIN.value
    ])),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """Admin updates a service request's status, assignment, or notes."""
    sr = db.query(ServiceRequest).filter(
        ServiceRequest.id == request_id,
        ServiceRequest.organization_id == org_id,
    ).first()
    if not sr:
        raise HTTPException(status_code=404, detail="Service request not found.")

    if body.status:
        if body.status.upper() not in VALID_STATUSES:
            raise HTTPException(status_code=400, detail=f"status must be one of {VALID_STATUSES}")
        sr.status = body.status.upper()

    if body.assigned_to_id is not None:
        sr.assigned_to_id = body.assigned_to_id

    if body.admin_notes is not None:
        sr.admin_notes = body.admin_notes

    db.commit()
    db.refresh(sr)
    return _sr_to_dict(db, sr)


@router.post("/{request_id}/upload")
def upload_dataset(
    request_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(RoleChecker([
        Role.CLIENT_USER.value, Role.ADMIN.value
    ])),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """Client uploads a dataset file for a service request."""
    sr = db.query(ServiceRequest).filter(
        ServiceRequest.id == request_id,
        ServiceRequest.organization_id == org_id,
    ).first()
    if not sr:
        raise HTTPException(status_code=404, detail="Service request not found.")

    if current_user.role == Role.CLIENT_USER.value and sr.created_by_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied.")

    storage_path = StorageService.save_evidence(file, org_id, request_id)
    sr.dataset_path = storage_path
    sr.dataset_filename = file.filename
    db.commit()
    db.refresh(sr)
    return {"message": "Dataset uploaded successfully", "filename": file.filename, "service_request": _sr_to_dict(db, sr)}


@router.get("/{request_id}/dataset/download")
def download_dataset(
    request_id: int,
    current_user: User = Depends(get_current_user),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """
    Download the dataset attached to a service request.

    Access:
      - ADMIN: any request in scope.
      - CLIENT_USER: only own requests.
      - TRACE_LAB_ANALYST / INVESTIGATOR: requests assigned
        to them (this is how assigned data reaches the
        analyst / invospace workspace for analysis).
    """
    sr = db.query(ServiceRequest).filter(
        ServiceRequest.id == request_id,
    ).first()
    if not sr:
        raise HTTPException(status_code=404, detail="Service request not found.")

    role = current_user.role

    is_assignee = current_user.id in (
        sr.assigned_to_id,
        sr.assigned_analyst_id,
        sr.assigned_invospace_id,
    )

    if role == Role.CLIENT_USER.value:
        if (
            sr.created_by_id != current_user.id
            or sr.organization_id != org_id
        ):
            raise HTTPException(status_code=403, detail="Access denied.")
    elif sr.organization_id != org_id and not is_assignee and role != Role.ADMIN.value:
        # Cross-organization download only for assigned staff
        raise HTTPException(
            status_code=403,
            detail="This request is not assigned to you.",
        )

    if role in (Role.TRACE_LAB_ANALYST.value, Role.INVESTIGATOR.value) and not is_assignee:
        raise HTTPException(
            status_code=403,
            detail="This request is not assigned to you.",
        )

    if not sr.dataset_path:
        raise HTTPException(status_code=404, detail="No dataset has been uploaded for this request.")

    try:
        file_path = StorageService.get_evidence_path(sr.dataset_path)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Dataset file missing from storage.")

    filename = sr.dataset_filename or "dataset.csv"
    return FileResponse(path=file_path, filename=filename, media_type="text/csv")
