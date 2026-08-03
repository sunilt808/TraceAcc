"""
reports.py - Client Reports API.

Analysts and Investigators can generate/upload reports for service requests
and cases. Admins can release these reports to clients. Clients can list
and download their released reports.
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
from models.client_report import ClientReport
from models.workflow_instance import WorkflowInstance
from models.activity_timeline import ActivityTimeline
from services.storage_service import StorageService
from datetime import datetime, timezone

router = APIRouter(prefix="/reports", tags=["reports"])

# ---------- Schemas ----------

class ReportCreate(BaseModel):
    title: str
    summary: Optional[str] = None
    report_type: str = "ANALYSIS" # ANALYSIS | INVESTIGATION | COMPLIANCE
    case_id: Optional[int] = None
    service_request_id: Optional[int] = None
    workflow_instance_id: Optional[int] = None


class ReportUpdate(BaseModel):
    title: Optional[str] = None
    summary: Optional[str] = None


# ---------- Helpers ----------

VALID_TYPES = {"ANALYSIS", "INVESTIGATION", "COMPLIANCE"}


def _report_to_dict(r: ClientReport) -> dict:
    return {
        "id": r.id,
        "organization_id": r.organization_id,
        "case_id": r.case_id,
        "service_request_id": r.service_request_id,
        "title": r.title,
        "summary": r.summary,
        "report_type": r.report_type,
        "status": r.status,
        "generated_by_id": r.generated_by_id,
        "is_released": r.is_released,
        "released_at": r.released_at.isoformat() if r.released_at else None,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


# ---------- Endpoints ----------

@router.post("", status_code=201)
def create_report(
    body: ReportCreate,
    current_user: User = Depends(RoleChecker([
        Role.INVESTIGATOR.value, Role.TRACE_LAB_ANALYST.value, Role.ADMIN.value, Role.SUPER_ADMIN.value
    ])),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """Create a new report record."""
    if body.report_type.upper() not in VALID_TYPES:
        raise HTTPException(status_code=400, detail=f"report_type must be one of {VALID_TYPES}")

    workflow_instance_id = body.workflow_instance_id
    if not workflow_instance_id:
        if body.case_id:
            workflow = db.query(WorkflowInstance).filter(WorkflowInstance.case_id == body.case_id, WorkflowInstance.organization_id == org_id).order_by(WorkflowInstance.created_at.desc()).first()
            if workflow:
                workflow_instance_id = workflow.id
        elif body.service_request_id:
            workflow = db.query(WorkflowInstance).filter(WorkflowInstance.service_request_id == body.service_request_id, WorkflowInstance.organization_id == org_id).order_by(WorkflowInstance.created_at.desc()).first()
            if workflow:
                workflow_instance_id = workflow.id

    report = ClientReport(
        organization_id=org_id,
        case_id=body.case_id,
        service_request_id=body.service_request_id,
        workflow_instance_id=workflow_instance_id,
        title=body.title,
        summary=body.summary,
        report_type=body.report_type.upper(),
        generated_by_id=current_user.id,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return _report_to_dict(report)


@router.post("/{report_id}/upload")
def upload_report_file(
    report_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(RoleChecker([
        Role.INVESTIGATOR.value, Role.TRACE_LAB_ANALYST.value, Role.ADMIN.value, Role.SUPER_ADMIN.value
    ])),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """Upload the actual report file (PDF/Doc)."""
    report = db.query(ClientReport).filter(
        ClientReport.id == report_id,
        ClientReport.organization_id == org_id,
    ).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found.")

    storage_path = StorageService.save_evidence(file, org_id, report.case_id or report.service_request_id or 0)
    report.file_path = storage_path
    db.commit()
    return {"message": "Report file uploaded successfully."}


@router.patch("/{report_id}/release")
def release_report(
    report_id: int,
    current_user: User = Depends(RoleChecker([
        Role.ADMIN.value, Role.SUPER_ADMIN.value
    ])),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """Release a report to the client."""
    report = db.query(ClientReport).filter(
        ClientReport.id == report_id,
        ClientReport.organization_id == org_id,
    ).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found.")
    
    if not report.file_path:
        raise HTTPException(status_code=400, detail="Cannot release report without a file attached.")

    report.is_released = True
    report.released_at = datetime.now(timezone.utc)
    report.released_by_id = current_user.id
    db.commit()
    db.refresh(report)
    return _report_to_dict(report)


@router.post("/{report_id}/submit-for-review")
def submit_report_for_review(
    report_id: int,
    current_user: User = Depends(RoleChecker([
        Role.INVESTIGATOR.value, Role.TRACE_LAB_ANALYST.value, Role.ADMIN.value, Role.SUPER_ADMIN.value
    ])),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    report = db.query(ClientReport).filter(
        ClientReport.id == report_id,
        ClientReport.organization_id == org_id,
    ).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found.")

    report.status = "READY_FOR_REVIEW"
    if report.workflow_instance_id:
        workflow = db.query(WorkflowInstance).filter(
            WorkflowInstance.id == report.workflow_instance_id,
            WorkflowInstance.organization_id == org_id,
        ).first()
        if workflow:
            from_status = workflow.current_status
            workflow.current_status = "AWAITING_REVIEW"
            workflow.current_stage = "REPORT_REVIEW"
            workflow.last_note = "Report submitted for review"
            db.add(ActivityTimeline(
                organization_id=org_id,
                workflow_instance_id=workflow.id,
                actor_id=current_user.id,
                action="TRANSITION",
                from_status=from_status,
                to_status="READY_FOR_REVIEW",
                details="Report submitted for review",
            ))

    db.commit()
    db.refresh(report)
    return _report_to_dict(report)


@router.post("/{report_id}/approve")
def approve_report(
    report_id: int,
    current_user: User = Depends(RoleChecker([
        Role.ADMIN.value, Role.SUPER_ADMIN.value
    ])),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    report = db.query(ClientReport).filter(
        ClientReport.id == report_id,
        ClientReport.organization_id == org_id,
    ).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found.")

    report.status = "RELEASED"
    report.is_released = True
    report.released_at = datetime.now(timezone.utc)
    report.released_by_id = current_user.id

    if report.workflow_instance_id:
        workflow = db.query(WorkflowInstance).filter(
            WorkflowInstance.id == report.workflow_instance_id,
            WorkflowInstance.organization_id == org_id,
        ).first()
        if workflow:
            from_status = workflow.current_status
            workflow.current_status = "CLOSED"
            workflow.current_stage = "REPORT_RELEASED"
            workflow.last_note = "Report approved and released"
            db.add(ActivityTimeline(
                organization_id=org_id,
                workflow_instance_id=workflow.id,
                actor_id=current_user.id,
                action="TRANSITION",
                from_status=from_status,
                to_status="RELEASED",
                details="Report approved and released",
            ))

    db.commit()
    db.refresh(report)
    return _report_to_dict(report)


@router.get("")
def list_reports(
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """
    List reports. 
    CLIENT_USER only sees is_released = True.
    """
    q = db.query(ClientReport).filter(ClientReport.organization_id == org_id)

    if current_user.role == Role.CLIENT_USER.value:
        q = q.filter(ClientReport.is_released == True)

    total = q.count()
    items = q.order_by(ClientReport.created_at.desc()).offset(offset).limit(limit).all()
    return {"items": [_report_to_dict(r) for r in items], "total": total}


@router.get("/{report_id}/download")
def download_report(
    report_id: int,
    current_user: User = Depends(get_current_user),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """Download the report file."""
    report = db.query(ClientReport).filter(
        ClientReport.id == report_id,
        ClientReport.organization_id == org_id,
    ).first()
    
    if not report:
        raise HTTPException(status_code=404, detail="Report not found.")
        
    if current_user.role == Role.CLIENT_USER.value and not report.is_released:
        raise HTTPException(status_code=403, detail="Report not released yet.")
        
    if not report.file_path:
        raise HTTPException(status_code=404, detail="No file attached to this report.")

    try:
        file_path = StorageService.get_evidence_path(report.file_path)
        # Extract original filename from path if needed, or use title
        return FileResponse(path=file_path, filename=f"{report.title.replace(' ', '_')}.pdf")
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Report file missing from storage.")
