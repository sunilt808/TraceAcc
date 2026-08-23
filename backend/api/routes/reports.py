"""
reports.py — Client Reports API.

Flow: creator (Analyst/Investigator) → upload file → submit-for-review
      Admin: review → sign (digital seal) → release
      Client: list + download RELEASED reports only.

Digital Seal (unique feature):
  Signing computes a SHA-256 hash over the report's identity +
  content + signer + timestamp. GET /reports/{id}/signature
  recomputes and verifies the hash — any tampering with the
  report record invalidates the seal (tamper-evident badge).
"""
import hashlib
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from api.deps import get_current_user, get_current_workspace
from db.database import get_db
from models.user import User
from models.role import Role
from core.permissions import require_permission, require_any_permission
from models.client_report import ClientReport
from models.workflow_instance import WorkflowInstance
from models.activity_timeline import ActivityTimeline
from services.storage_service import StorageService
from services.notification_service import (
    notify_report_submitted,
    notify_report_released,
)

router = APIRouter(prefix="/reports", tags=["reports"])


# ============================================================
# SCHEMAS
# ============================================================

class ReportCreate(BaseModel):
    title: str
    summary: Optional[str] = None
    report_type: str = "ANALYSIS"  # ANALYSIS | INVESTIGATION | COMPLIANCE
    case_id: Optional[int] = None
    service_request_id: Optional[int] = None
    workflow_instance_id: Optional[int] = None


class ReportUpdate(BaseModel):
    title: Optional[str] = None
    summary: Optional[str] = None


VALID_TYPES = {"ANALYSIS", "INVESTIGATION", "COMPLIANCE"}


# ============================================================
# HELPERS
# ============================================================

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
        "has_file": bool(r.file_path),
        "generated_by_id": r.generated_by_id,
        "signed_by_id": r.signed_by_id,
        "signed_at": r.signed_at.isoformat() if r.signed_at else None,
        "seal_id": r.seal_id,
        "signature_hash": r.signature_hash,
        "is_released": r.is_released,
        "released_at": r.released_at.isoformat() if r.released_at else None,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "updated_at": r.updated_at.isoformat() if r.updated_at else None,
    }


def _compute_seal_hash(report: ClientReport, signer_id: int, signed_at: datetime) -> str:
    """
    Deterministic SHA-256 over the report's identity and content.
    Recomputing this later detects tampering with the report record.
    """
    content_fingerprint = ""
    if report.file_path:
        try:
            path = StorageService.get_evidence_path(report.file_path)
            sha = hashlib.sha256()
            with open(path, "rb") as fh:
                for chunk in iter(lambda: fh.read(65536), b""):
                    sha.update(chunk)
            content_fingerprint = sha.hexdigest()
        except (FileNotFoundError, OSError):
            content_fingerprint = "FILE_MISSING"

    payload = "|".join(
        [
            f"report:{report.id}",
            f"title:{report.title}",
            f"summary:{(report.summary or '').strip()}",
            f"status:{report.status}",
            f"type:{report.report_type}",
            f"case:{report.case_id or ''}",
            f"request:{report.service_request_id or ''}",
            f"content_sha256:{content_fingerprint}",
            f"signer:{signer_id}",
            f"signed_at:{signed_at.isoformat()}",
            "traceacc-seal-v1",
        ]
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _get_report_scoped(db: Session, org_id: int, report_id: int) -> ClientReport:
    report = (
        db.query(ClientReport)
        .filter(
            ClientReport.id == report_id,
            ClientReport.organization_id == org_id,
        )
        .first()
    )
    if not report:
        raise HTTPException(status_code=404, detail="Report not found.")
    return report


def _resolve_workflow(
    db: Session, org_id: int, body: ReportCreate
) -> Optional[int]:
    if body.workflow_instance_id:
        return body.workflow_instance_id
    if body.case_id:
        wf = (
            db.query(WorkflowInstance)
            .filter(
                WorkflowInstance.case_id == body.case_id,
                WorkflowInstance.organization_id == org_id,
            )
            .order_by(WorkflowInstance.created_at.desc())
            .first()
        )
        return wf.id if wf else None
    if body.service_request_id:
        wf = (
            db.query(WorkflowInstance)
            .filter(
                WorkflowInstance.service_request_id == body.service_request_id,
                WorkflowInstance.organization_id == org_id,
            )
            .order_by(WorkflowInstance.created_at.desc())
            .first()
        )
        return wf.id if wf else None
    return None


# ============================================================
# CREATE / UPLOAD
# ============================================================

@router.post("", status_code=201)
def create_report(
    body: ReportCreate,
    current_user: User = Depends(
        require_any_permission(
            "report.review",
            "technical_report.submit",
            "investigation_report.submit",
        )
    ),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """Create a new report record (draft)."""
    if body.report_type.upper() not in VALID_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"report_type must be one of {sorted(VALID_TYPES)}",
        )

    workflow_instance_id = _resolve_workflow(db, org_id, body)

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


@router.patch("/{report_id}")
def update_report(
    report_id: int,
    body: ReportUpdate,
    current_user: User = Depends(
        require_any_permission(
            "report.review",
            "technical_report.submit",
            "investigation_report.submit",
        )
    ),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """Edit title/summary of a DRAFT report."""
    report = _get_report_scoped(db, org_id, report_id)

    if report.status not in ("DRAFT", "CHANGES_REQUESTED", "REJECTED"):
        raise HTTPException(
            status_code=400,
            detail=f"Report in status {report.status} cannot be edited.",
        )

    if body.title is not None:
        report.title = body.title
    if body.summary is not None:
        report.summary = body.summary

    db.commit()
    db.refresh(report)
    return _report_to_dict(report)


@router.post("/{report_id}/upload")
def upload_report_file(
    report_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(
        require_any_permission(
            "report.review",
            "technical_report.submit",
            "investigation_report.submit",
        )
    ),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """Upload the actual report file (PDF/Doc)."""
    report = _get_report_scoped(db, org_id, report_id)

    if report.is_released:
        raise HTTPException(status_code=400, detail="Released reports are immutable.")

    storage_path = StorageService.save_evidence(
        file, org_id, report.case_id or report.service_request_id or 0
    )
    report.file_path = storage_path

    # Any content change after signing invalidates the seal
    if report.signature_hash:
        report.signature_hash = None
        report.seal_id = None
        report.signed_at = None
        report.signed_by_id = None
        if report.status == "SIGNED":
            report.status = "APPROVED"

    db.commit()
    return {"message": "Report file uploaded successfully.", "report": _report_to_dict(report)}


# ============================================================
# WORKFLOW: SUBMIT → SIGN → RELEASE
# ============================================================

@router.post("/{report_id}/submit-for-review")
def submit_report_for_review(
    report_id: int,
    current_user: User = Depends(
        require_any_permission(
            "report.review",
            "technical_report.submit",
            "investigation_report.submit",
        )
    ),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    report = _get_report_scoped(db, org_id, report_id)

    if report.status not in ("DRAFT", "CHANGES_REQUESTED", "REJECTED"):
        raise HTTPException(
            status_code=400,
            detail=f"Report in status {report.status} cannot be submitted.",
        )
    if not report.file_path:
        raise HTTPException(
            status_code=400,
            detail="Attach the report file before submitting for review.",
        )

    report.status = "READY_FOR_REVIEW"

    if report.workflow_instance_id:
        workflow = (
            db.query(WorkflowInstance)
            .filter(
                WorkflowInstance.id == report.workflow_instance_id,
                WorkflowInstance.organization_id == org_id,
            )
            .first()
        )
        if workflow:
            from_status = workflow.current_status
            workflow.current_status = "AWAITING_REVIEW"
            workflow.current_stage = "REPORT_REVIEW"
            workflow.last_note = "Report submitted for review"
            db.add(
                ActivityTimeline(
                    organization_id=org_id,
                    workflow_instance_id=workflow.id,
                    actor_id=current_user.id,
                    action="TRANSITION",
                    from_status=from_status,
                    to_status="READY_FOR_REVIEW",
                    details="Report submitted for review",
                )
            )

    notify_report_submitted(
        db,
        org_id=org_id,
        report_id=report.id,
        report_title=report.title,
        submitter_name=current_user.username,
    )

    db.commit()
    db.refresh(report)
    return _report_to_dict(report)


@router.post("/{report_id}/sign")
def sign_report(
    report_id: int,
    current_user: User = Depends(require_permission("report.sign")),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """
    Apply the digital seal (Admin).

    Computes SHA-256 over report identity + file content + signer +
    timestamp. The seal is tamper-evident: editing the record or
    replacing the file invalidates it.
    """
    report = _get_report_scoped(db, org_id, report_id)

    if report.status not in ("APPROVED", "SIGNED"):
        raise HTTPException(
            status_code=400,
            detail="Only APPROVED reports can be signed. Review the report first.",
        )
    if not report.file_path:
        raise HTTPException(
            status_code=400,
            detail="Cannot sign a report without an uploaded file.",
        )

    signed_at = datetime.now(timezone.utc)
    signature_hash = _compute_seal_hash(report, current_user.id, signed_at)
    seal_id = f"TA-SEAL-{report.organization_id}-{report.id}-{signed_at.strftime('%Y%m%d%H%M%S')}"

    report.status = "SIGNED"
    report.signed_by_id = current_user.id
    report.signed_at = signed_at
    report.signature_hash = signature_hash
    report.seal_id = seal_id

    db.commit()
    db.refresh(report)
    return _report_to_dict(report)


@router.get("/{report_id}/signature")
def verify_report_signature(
    report_id: int,
    current_user: User = Depends(get_current_user),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """
    Verify the digital seal.

    Recomputes the hash from the current record + file content and
    compares with the stored signature_hash. Returns badge data for
    the UI (signer, timestamp, seal id, valid flag).
    """
    report = _get_report_scoped(db, org_id, report_id)

    if not report.signature_hash or not report.signed_at or not report.signed_by_id:
        return {
            "report_id": report.id,
            "sealed": False,
            "valid": False,
            "reason": "Report has not been signed.",
        }

    recomputed = _compute_seal_hash(
        report, report.signed_by_id, report.signed_at
    )
    valid = recomputed == report.signature_hash

    signer = db.query(User).filter(User.id == report.signed_by_id).first()

    return {
        "report_id": report.id,
        "sealed": True,
        "valid": valid,
        "reason": None if valid else "Signature mismatch — report content changed after signing.",
        "seal_id": report.seal_id,
        "signature_hash": report.signature_hash,
        "signed_at": report.signed_at.isoformat() if report.signed_at else None,
        "signed_by": signer.username if signer else None,
    }


@router.post("/{report_id}/release")
def release_report(
    report_id: int,
    current_user: User = Depends(require_permission("report.release")),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """Release a SIGNED + APPROVED report to the client."""
    report = _get_report_scoped(db, org_id, report_id)

    if report.status not in ("APPROVED", "SIGNED"):
        raise HTTPException(
            status_code=400,
            detail="Only an APPROVED/SIGNED report can be released.",
        )
    if not report.file_path:
        raise HTTPException(
            status_code=400,
            detail="Cannot release report without a file attached.",
        )

    report.is_released = True
    report.released_at = datetime.now(timezone.utc)
    report.released_by_id = current_user.id
    report.status = "RELEASED"

    # Notify the client who owns the linked request
    client_id = None
    if report.service_request_id:
        from models.service_request import ServiceRequest

        sr = (
            db.query(ServiceRequest)
            .filter(ServiceRequest.id == report.service_request_id)
            .first()
        )
        client_id = sr.created_by_id if sr else None

    notify_report_released(
        db,
        org_id=org_id,
        report_id=report.id,
        report_title=report.title,
        client_id=client_id,
    )

    db.commit()
    db.refresh(report)
    return _report_to_dict(report)


@router.post("/{report_id}/approve")
def approve_report(
    report_id: int,
    current_user: User = Depends(require_permission("report.approve")),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """Approve a submitted report (pre-sign step)."""
    report = _get_report_scoped(db, org_id, report_id)

    if report.status not in ("READY_FOR_REVIEW", "UNDER_REVIEW", "SIGNED"):
        raise HTTPException(
            status_code=400,
            detail=f"Report in status {report.status} cannot be approved.",
        )

    report.status = "APPROVED"
    report.reviewed_by_id = current_user.id
    report.reviewed_at = datetime.now(timezone.utc)

    if report.workflow_instance_id:
        workflow = (
            db.query(WorkflowInstance)
            .filter(
                WorkflowInstance.id == report.workflow_instance_id,
                WorkflowInstance.organization_id == org_id,
            )
            .first()
        )
        if workflow:
            workflow.current_status = "APPROVED"
            workflow.current_stage = "REPORT_REVIEW"
            workflow.last_note = "Report approved by admin"

    db.commit()
    db.refresh(report)
    return _report_to_dict(report)


# ============================================================
# LIST / DOWNLOAD
# ============================================================

@router.get("")
def list_reports(
    report_type: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(
        require_any_permission("report.view_released", "report.view_internal")
    ),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """
    List reports.
    CLIENT_USER only sees is_released = True.
    """
    q = db.query(ClientReport).filter(ClientReport.organization_id == org_id)

    if current_user.role == Role.CLIENT_USER.value:
        q = q.filter(ClientReport.is_released == True)  # noqa: E712

    if report_type:
        q = q.filter(ClientReport.report_type == report_type.upper())

    total = q.count()
    items = (
        q.order_by(ClientReport.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return {"items": [_report_to_dict(r) for r in items], "total": total}


@router.get("/{report_id}/download")
def download_report(
    report_id: int,
    token: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """
    Download the report file.

    Accepts the Bearer header (axios blob downloads) OR a ?token=
    query parameter (plain browser <a> downloads).
    """
    report = _get_report_scoped(db, org_id, report_id)

    if current_user.role == Role.CLIENT_USER.value and not report.is_released:
        raise HTTPException(status_code=403, detail="Report not released yet.")

    if not report.file_path:
        raise HTTPException(status_code=404, detail="No file attached to this report.")

    try:
        file_path = StorageService.get_evidence_path(report.file_path)
        safe_title = report.title.replace(" ", "_").replace("/", "-")
        return FileResponse(path=file_path, filename=f"{safe_title}.pdf")
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Report file missing from storage.")
