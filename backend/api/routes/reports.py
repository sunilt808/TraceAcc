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
        Role.INVESTIGATOR.value, Role.TRACE_LAB_ANALYST.value, Role.ADMIN.value
    ])),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """Create a new report record."""
    if body.report_type.upper() not in VALID_TYPES:
        raise HTTPException(status_code=400, detail=f"report_type must be one of {VALID_TYPES}")

    report = ClientReport(
        organization_id=org_id,
        case_id=body.case_id,
        service_request_id=body.service_request_id,
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
        Role.INVESTIGATOR.value, Role.TRACE_LAB_ANALYST.value, Role.ADMIN.value
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
        Role.ADMIN.value
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
