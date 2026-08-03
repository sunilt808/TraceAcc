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

from api.deps import get_current_user, get_current_workspace
from db.database import get_db
from models.user import User
from models.case import Case
from models.case_event import CaseEvent


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
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """Create a new investigation case."""
    VALID_PRIORITIES = {"LOW", "MEDIUM", "HIGH", "CRITICAL"}
    if body.priority not in VALID_PRIORITIES:
        raise HTTPException(status_code=400, detail=f"priority must be one of {VALID_PRIORITIES}")

    case = Case(
        organization_id=org_id,
        created_by_id=current_user.id,
        title=body.title,
        description=body.description,
        priority=body.priority,
        linked_accounts=body.linked_accounts,
        linked_rings=body.linked_rings,
        analysis_job_id=body.analysis_job_id,
        notes=body.notes,
    )
    db.add(case)
    db.flush() # Get case ID
    
    event = CaseEvent(
        organization_id=org_id,
        case_id=case.id,
        user_id=current_user.id,
        event_type="SYSTEM_ACTION",
        content="Case created"
    )
    db.add(event)
    
    db.commit()
    db.refresh(case)
    return _case_to_dict(case)


@router.get("")
def list_cases(
    status:   Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    limit:    int = Query(50, le=200),
    offset:   int = Query(0, ge=0),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """List all cases for the current user's organization, with optional filters."""
    q = db.query(Case).filter(Case.organization_id == org_id)
    if status:
        q = q.filter(Case.status == status.upper())
    if priority:
        q = q.filter(Case.priority == priority.upper())
    cases = q.order_by(Case.created_at.desc()).offset(offset).limit(limit).all()
    return {"items": [_case_to_dict(c) for c in cases], "total": len(cases)}


@router.get("/{case_id}")
def get_case(
    case_id: int,
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """Get a single case by ID."""
    case = db.query(Case).filter(Case.id == case_id, Case.organization_id == org_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found.")
    return _case_to_dict(case)


@router.patch("/{case_id}")
def update_case(
    case_id: int,
    body: CaseUpdate,
    current_user: User = Depends(get_current_user),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """Update a case's fields."""
    case = db.query(Case).filter(Case.id == case_id, Case.organization_id == org_id).first()
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
        if case.status != body.status.upper():
            old_status = case.status
            case.status = body.status.upper()
            case.status_updated_at = datetime.now(timezone.utc)
            if case.status == "CLOSED":
                case.closed_at = datetime.now(timezone.utc)
                
            event = CaseEvent(
                organization_id=org_id,
                case_id=case.id,
                user_id=current_user.id,
                event_type="STATUS_CHANGE",
                content=f"Status changed from {old_status} to {case.status}"
            )
            db.add(event)

    if body.priority:
        if body.priority.upper() not in VALID_PRIORITIES:
            raise HTTPException(status_code=400, detail=f"priority must be one of {VALID_PRIORITIES}")
        if case.priority != body.priority.upper():
            old_priority = case.priority
            case.priority = body.priority.upper()
            event = CaseEvent(
                organization_id=org_id,
                case_id=case.id,
                user_id=current_user.id,
                event_type="SYSTEM_ACTION",
                content=f"Priority changed from {old_priority} to {case.priority}"
            )
            db.add(event)

    db.commit()
    db.refresh(case)
    return _case_to_dict(case)


@router.delete("/{case_id}", status_code=204)
def delete_case(
    case_id: int,
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """Delete a case."""
    case = db.query(Case).filter(Case.id == case_id, Case.organization_id == org_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found.")
    db.delete(case)
    db.commit()
    return None

@router.get("/{case_id}/timeline")
def get_case_timeline(
    case_id: int,
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """Get the event timeline for a specific case."""
    case = db.query(Case).filter(Case.id == case_id, Case.organization_id == org_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found.")
        
    events = db.query(CaseEvent).filter(CaseEvent.case_id == case_id).order_by(CaseEvent.created_at.asc()).all()
    
    return [{
        "id": e.id,
        "user_id": e.user_id,
        "event_type": e.event_type,
        "content": e.content,
        "created_at": e.created_at.isoformat() if e.created_at else None
    } for e in events]

