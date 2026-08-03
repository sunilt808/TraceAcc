"""
evidence.py - Evidence Management API.
Allows uploading and downloading evidence files for cases.
Strictly tenant-isolated.
"""
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from api.deps import get_current_user, get_current_workspace
from db.database import get_db
from models.user import User
from models.case import Case
from models.evidence import Evidence
from services.storage_service import StorageService

router = APIRouter(prefix="/cases/{case_id}/evidence", tags=["evidence"])

@router.post("", status_code=201)
def upload_evidence(
    case_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """Upload a new piece of evidence for a case."""
    # Verify the case exists and belongs to the organization
    case = db.query(Case).filter(Case.id == case_id, Case.organization_id == org_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found.")
        
    storage_path = StorageService.save_evidence(file, org_id, case_id)
    
    evidence = Evidence(
        organization_id=org_id,
        case_id=case_id,
        uploader_id=current_user.id,
        file_name=file.filename,
        storage_path=storage_path,
        mime_type=file.content_type
    )
    db.add(evidence)
    db.commit()
    db.refresh(evidence)
    
    return {
        "id": evidence.id,
        "file_name": evidence.file_name,
        "mime_type": evidence.mime_type,
        "uploaded_at": evidence.uploaded_at.isoformat() if evidence.uploaded_at else None
    }

@router.get("")
def list_evidence(
    case_id: int,
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """List all evidence attached to a case."""
    case = db.query(Case).filter(Case.id == case_id, Case.organization_id == org_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found.")
        
    evidence_list = db.query(Evidence).filter(Evidence.case_id == case_id).all()
    
    return [{
        "id": e.id,
        "file_name": e.file_name,
        "mime_type": e.mime_type,
        "uploaded_at": e.uploaded_at.isoformat() if e.uploaded_at else None
    } for e in evidence_list]

@router.get("/{evidence_id}/download")
def download_evidence(
    case_id: int,
    evidence_id: int,
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """Download an evidence file."""
    # We verify the org_id indirectly by checking if the case belongs to the org
    evidence = db.query(Evidence).join(Case).filter(
        Evidence.id == evidence_id,
        Evidence.case_id == case_id,
        Case.organization_id == org_id
    ).first()
    
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence not found.")
        
    try:
        file_path = StorageService.get_evidence_path(evidence.storage_path)
        return FileResponse(path=file_path, filename=evidence.file_name, media_type=evidence.mime_type)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Evidence file missing from storage.")
