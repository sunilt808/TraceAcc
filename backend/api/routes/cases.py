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

from api.deps import get_current_user, get_current_workspace, RoleChecker
from db.database import get_db
from models.user import User
from models.role import Role
from core.permissions import require_permission, require_any_permission
from models.case import Case
from models.case_event import CaseEvent
from models.activity_timeline import ActivityTimeline
from models.workflow_instance import WorkflowInstance


router = APIRouter(prefix="/cases", tags=["cases"])


def _query_cases_for_user(db: Session, current_user: User, org_id: int):
    query = db.query(Case)
    if current_user.role != Role.SUPER_ADMIN.value:
        query = query.filter(Case.organization_id == org_id)
    return query


class CaseCreate(BaseModel):
    title:            str
    description:      Optional[str] = None
    priority:         str = "MEDIUM"
    workflow_instance_id: Optional[int] = None
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
    decision:        Optional[str] = None


class CaseAssign(BaseModel):
    assignee_id: int


class CaseNote(BaseModel):
    content: str


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
        "workflow_instance_id": case.workflow_instance_id,
        "notes":            case.notes,
        "created_at":       case.created_at.isoformat() if case.created_at else None,
        "updated_at":       case.updated_at.isoformat() if case.updated_at else None,
        "closed_at":        case.closed_at.isoformat() if case.closed_at else None,
    }


@router.post("", status_code=201)
def create_case(
    body: CaseCreate,
    current_user: User = Depends(require_permission("case.create")),
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
        workflow_instance_id=body.workflow_instance_id,
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
    current_user: User = Depends(require_any_permission("case.view_assigned", "request.view_all")),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """List all cases for the current user's organization, with optional filters."""
    q = _query_cases_for_user(db, current_user, org_id)
    if status:
        q = q.filter(Case.status == status.upper())
    if priority:
        q = q.filter(Case.priority == priority.upper())
    cases = q.order_by(Case.created_at.desc()).offset(offset).limit(limit).all()
    return {"items": [_case_to_dict(c) for c in cases], "total": len(cases)}


@router.get("/{case_id}")
def get_case(
    case_id: int,
    current_user: User = Depends(require_any_permission("case.view_assigned", "request.view_all")),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """Get a single case by ID."""
    case = _query_cases_for_user(db, current_user, org_id).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found.")
    return _case_to_dict(case)


@router.patch("/{case_id}")
def update_case(
    case_id: int,
    body: CaseUpdate,
    current_user: User = Depends(require_permission("case.update")),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """Update a case's fields."""
    case = _query_cases_for_user(db, current_user, org_id).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found.")

    VALID_STATUSES   = {"OPEN", "INVESTIGATING", "REVIEW", "CLOSED", "ESCALATED"}
    VALID_PRIORITIES = {"LOW", "MEDIUM", "HIGH", "CRITICAL"}
    VALID_DECISIONS  = {"NO_ACTION", "SAR_FILED", "REFERRED_TO_LAW_ENFORCEMENT", "MONITORING"}

    if body.title:    case.title       = body.title
    if body.description is not None:  case.description = body.description
    if body.notes is not None:        case.notes       = body.notes
    if body.decision is not None:
        if body.decision.upper() not in VALID_DECISIONS:
            raise HTTPException(status_code=400, detail=f"decision must be one of {VALID_DECISIONS}")
        case.decision = body.decision.upper()

    if body.status:
        if body.status.upper() not in VALID_STATUSES:
            raise HTTPException(status_code=400, detail=f"status must be one of {VALID_STATUSES}")
        if case.status != body.status.upper():
            old_status = case.status
            case.status = body.status.upper()
            case.status_updated_at = datetime.now(timezone.utc)
            if case.status == "CLOSED":
                case.closed_at = datetime.now(timezone.utc)

            if case.workflow_instance_id:
                workflow = db.query(WorkflowInstance).filter(
                    WorkflowInstance.id == case.workflow_instance_id,
                    WorkflowInstance.organization_id == org_id,
                ).first()
                if workflow:
                    workflow.current_status = "CLOSED" if case.status == "CLOSED" else "INVESTIGATION_IN_PROGRESS"
                    workflow.current_stage = "CASE_CLOSED" if case.status == "CLOSED" else "INVESTIGATION"
                    workflow.last_note = f"Case status changed to {case.status}"
                    db.add(ActivityTimeline(
                        organization_id=org_id,
                        workflow_instance_id=workflow.id,
                        actor_id=current_user.id,
                        action="TRANSITION",
                        from_status=old_status,
                        to_status=case.status,
                        details=f"Case status changed to {case.status}",
                    ))
                
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


@router.patch("/{case_id}/assign")
def assign_case(
    case_id: int,
    body: CaseAssign,
    current_user: User = Depends(require_permission("case.assign")),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """Assign a case to a specific investigator."""
    case = _query_cases_for_user(db, current_user, org_id).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found.")
        
    assignee = db.query(User).filter(User.id == body.assignee_id, User.organization_id == org_id).first()
    if not assignee:
        raise HTTPException(status_code=404, detail="Assignee not found in this organization.")
        
    case.assignee_id = assignee.id
    
    event = CaseEvent(
        organization_id=org_id,
        case_id=case.id,
        user_id=current_user.id,
        event_type="ASSIGNMENT",
        content=f"Case assigned to {assignee.username}"
    )
    db.add(event)
    
    db.commit()
    db.refresh(case)
    return _case_to_dict(case)


@router.post("/{case_id}/notes")
def add_case_note(
    case_id: int,
    body: CaseNote,
    current_user: User = Depends(require_permission("investigation.note.create")),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """Add a timeline note to a case."""
    case = _query_cases_for_user(db, current_user, org_id).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found.")
        
    event = CaseEvent(
        organization_id=org_id,
        case_id=case.id,
        user_id=current_user.id,
        event_type="COMMENT",
        content=body.content
    )
    db.add(event)
    db.commit()
    
    return {"message": "Note added successfully"}


@router.get("/{case_id}/timeline")
def get_case_timeline(
    case_id: int,
    current_user: User = Depends(require_any_permission("case.view_assigned", "request.view_all")),
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


# --- Investigation Artifacts ---

from models.investigation_hypothesis import InvestigationHypothesis
from models.investigation_task import InvestigationTask
from models.investigation_finding import InvestigationFinding

class HypothesisCreate(BaseModel):
    title: str
    description: Optional[str] = None
    status: str = "OPEN"

@router.post("/{case_id}/hypotheses")
def create_hypothesis(
    case_id: int,
    body: HypothesisCreate,
    current_user: User = Depends(require_permission("investigation.hypothesis.create")),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    case = db.query(Case).filter(Case.id == case_id, Case.organization_id == org_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found.")
        
    hyp = InvestigationHypothesis(
        organization_id=org_id,
        case_id=case.id,
        created_by_id=current_user.id,
        title=body.title,
        description=body.description,
        status=body.status
    )
    db.add(hyp)
    db.commit()
    db.refresh(hyp)
    return {"id": hyp.id, "title": hyp.title, "status": hyp.status}


class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    task_type: str = "CUSTOM"
    assigned_to_id: Optional[int] = None

@router.post("/{case_id}/tasks")
def create_task(
    case_id: int,
    body: TaskCreate,
    current_user: User = Depends(require_permission("investigation.task.create")),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    case = db.query(Case).filter(Case.id == case_id, Case.organization_id == org_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found.")
        
    task = InvestigationTask(
        organization_id=org_id,
        case_id=case.id,
        created_by_id=current_user.id,
        assigned_to_id=body.assigned_to_id,
        title=body.title,
        description=body.description,
        task_type=body.task_type
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return {"id": task.id, "title": task.title, "status": task.status}


class FindingCreate(BaseModel):
    title: str
    description: str
    finding_type: str = "OTHER"
    confidence: str = "INCONCLUSIVE"
    risk_contribution: float = 0.0

@router.post("/{case_id}/findings")
def create_finding(
    case_id: int,
    body: FindingCreate,
    current_user: User = Depends(require_permission("investigation.finding.create")),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    case = db.query(Case).filter(Case.id == case_id, Case.organization_id == org_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found.")
        
    finding = InvestigationFinding(
        organization_id=org_id,
        case_id=case.id,
        created_by_id=current_user.id,
        title=body.title,
        description=body.description,
        finding_type=body.finding_type,
        confidence=body.confidence,
        risk_contribution=body.risk_contribution
    )
    db.add(finding)
    db.commit()
    db.refresh(finding)
    return {"id": finding.id, "title": finding.title, "confidence": finding.confidence}

