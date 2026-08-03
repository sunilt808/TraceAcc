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

router = APIRouter(prefix="/admin", tags=["admin"])

# ---------- Schemas ----------

class UserUpdate(BaseModel):
    role: Optional[str] = None
    is_active: Optional[bool] = None
    organization_id: Optional[int] = None


class OrganizationCreate(BaseModel):
    name: str


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

@router.get("/dashboard")
def admin_dashboard(
    current_user: User = Depends(RoleChecker([Role.ADMIN.value])),
    db: Session = Depends(get_db),
):
    """System-wide dashboard stats for admin."""
    # System-wide stats are no longer supported for standard ADMIN.
    # We now fetch only org-specific stats.
    org_id = current_user.organization_id
    total_users = db.query(sa_func.count(User.id)).filter(User.organization_id == org_id).scalar()
    total_orgs = 1
        total_cases = db.query(sa_func.count(Case.id)).filter(Case.organization_id == org_id).scalar()
        open_cases = db.query(sa_func.count(Case.id)).filter(Case.organization_id == org_id, Case.status.in_(["OPEN", "INVESTIGATING", "REVIEW"])).scalar()
        total_alerts = db.query(sa_func.count(Alert.id)).filter(Alert.organization_id == org_id).scalar()
        new_alerts = db.query(sa_func.count(Alert.id)).filter(Alert.organization_id == org_id, Alert.status == "NEW").scalar()
        total_requests = db.query(sa_func.count(ServiceRequest.id)).filter(ServiceRequest.organization_id == org_id).scalar()
        pending_requests = db.query(sa_func.count(ServiceRequest.id)).filter(ServiceRequest.organization_id == org_id, ServiceRequest.status == "PENDING").scalar()

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
