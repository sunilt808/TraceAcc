"""
cases.py — Case Management API.

Allows analysts to create, view, update, and close investigation cases
linked to suspicious accounts or fraud rings.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime, timezone

from api.deps import get_current_user
from db.database import get_db
from models.user import User
from models.case import Case


router = APIRouter(prefix="/cases", tags=["cases"])


class CaseCreate(BaseModel):
    title:            str
    description:      Optional[str] = None
    priority:         str = "MEDIUM"
    linked_accounts:  Optional[List[str]] = None
    linked_rings:     Optional[List[str]] = None
    analysis_job_id:  Optional[int] = None
    notes:            Optional[str] = None


class CaseUpdate(BaseModel):
    title:           Optional[str] = None
    description:     Optional[str] = None
    status:          Optional[str] = None
    priority:        Optional[str] = None
    notes:           Optional[str] = None


def _case_to_dict(case: Case) -> dict:
    return {
        "id":               case.id,
        "title":            case.title,
        "description":      case.description,
        "status":           case.status,
        "priority":         case.priority,
        "linked_accounts":  case.linked_accounts or [],
        "linked_rings":     case.linked_rings or [],
        "analysis_job_id":  case.analysis_job_id,
        "notes":            case.notes,
        "created_at":       case.created_at.isoformat() if case.created_at else None,
        "updated_at":       case.updated_at.isoformat() if case.updated_at else None,
        "closed_at":        case.closed_at.isoformat() if case.closed_at else None,
    }


@router.post("", status_code=201)
def create_case(
    body: CaseCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new investigation case."""
    VALID_PRIORITIES = {"LOW", "MEDIUM", "HIGH", "CRITICAL"}
    if body.priority not in VALID_PRIORITIES:
        raise HTTPException(status_code=400, detail=f"priority must be one of {VALID_PRIORITIES}")

    case = Case(
        user_id=current_user.id,
        title=body.title,
        description=body.description,
        priority=body.priority,
        linked_accounts=body.linked_accounts,
        linked_rings=body.linked_rings,
        analysis_job_id=body.analysis_job_id,
        notes=body.notes,
    )
    db.add(case)
    db.commit()
    db.refresh(case)
    return _case_to_dict(case)


@router.get("")
def list_cases(
    status:   Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    limit:    int = Query(50, le=200),
    offset:   int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all cases for the current user, with optional filters."""
    q = db.query(Case).filter(Case.user_id == current_user.id)
    if status:
        q = q.filter(Case.status == status.upper())
    if priority:
        q = q.filter(Case.priority == priority.upper())
    cases = q.order_by(Case.created_at.desc()).offset(offset).limit(limit).all()
    return {"items": [_case_to_dict(c) for c in cases], "total": len(cases)}


@router.get("/{case_id}")
def get_case(
    case_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a single case by ID."""
    case = db.query(Case).filter(Case.id == case_id, Case.user_id == current_user.id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found.")
    return _case_to_dict(case)


@router.patch("/{case_id}")
def update_case(
    case_id: int,
    body: CaseUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a case's fields."""
    case = db.query(Case).filter(Case.id == case_id, Case.user_id == current_user.id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found.")

    VALID_STATUSES   = {"OPEN", "INVESTIGATING", "CLOSED", "ESCALATED"}
    VALID_PRIORITIES = {"LOW", "MEDIUM", "HIGH", "CRITICAL"}

    if body.title:    case.title       = body.title
    if body.description is not None:  case.description = body.description
    if body.notes is not None:        case.notes       = body.notes

    if body.status:
        if body.status.upper() not in VALID_STATUSES:
            raise HTTPException(status_code=400, detail=f"status must be one of {VALID_STATUSES}")
        case.status = body.status.upper()
        if case.status == "CLOSED":
            case.closed_at = datetime.now(timezone.utc)

    if body.priority:
        if body.priority.upper() not in VALID_PRIORITIES:
            raise HTTPException(status_code=400, detail=f"priority must be one of {VALID_PRIORITIES}")
        case.priority = body.priority.upper()

    db.commit()
    db.refresh(case)
    return _case_to_dict(case)


@router.delete("/{case_id}", status_code=204)
def delete_case(
    case_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a case."""
    case = db.query(Case).filter(Case.id == case_id, Case.user_id == current_user.id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found.")
    db.delete(case)
    db.commit()
    return None
