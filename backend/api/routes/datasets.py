from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
import os
import time

from core.permissions import require_permission, require_any_permission, ROLE_ANALYST, ROLE_ADMIN, ROLE_CLIENT
from db.database import get_db
from models.user import User
from models.dataset import Dataset
from models.service_request import ServiceRequest
from services.storage_service import StorageService

router = APIRouter(prefix="/datasets", tags=["datasets"])


@router.post("", status_code=201)
def create_dataset(
    service_request_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(require_any_permission("dataset.create", "request.create")),
    db: Session = Depends(get_db),
):
    sr = db.query(ServiceRequest).filter(
        ServiceRequest.id == service_request_id,
        ServiceRequest.organization_id == current_user.organization_id
    ).first()
    if not sr:
        raise HTTPException(status_code=404, detail="Service request not found.")

    storage_path = StorageService.save_evidence(file, current_user.organization_id, sr.id)

    dataset = Dataset(
        organization_id=current_user.organization_id,
        service_request_id=sr.id,
        uploaded_by_id=current_user.id,
        original_filename=file.filename,
        storage_path=storage_path,
        mime_type=file.content_type,
        status="UPLOADED"
    )
    db.add(dataset)
    db.commit()
    db.refresh(dataset)
    
    # Update SR if needed
    if not sr.dataset_path:
        sr.dataset_path = storage_path
        sr.dataset_filename = file.filename
        db.commit()

    return {"id": dataset.id, "status": dataset.status, "filename": dataset.original_filename}


@router.post("/{dataset_id}/validate")
def validate_dataset(
    dataset_id: int,
    current_user: User = Depends(require_permission("dataset.validate")),
    db: Session = Depends(get_db),
):
    dataset = db.query(Dataset).filter(
        Dataset.id == dataset_id,
        Dataset.organization_id == current_user.organization_id
    ).first()
    
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    dataset.status = "VALIDATING"
    db.commit()
    
    # Mock validation process
    dataset.row_count = 1000
    dataset.valid_row_count = 998
    dataset.invalid_row_count = 2
    dataset.duplicate_count = 0
    dataset.status = "VALID"
    db.commit()
    
    return {"message": "Dataset validated", "status": dataset.status}
