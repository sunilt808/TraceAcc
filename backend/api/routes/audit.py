from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from api.deps import get_current_user, RoleChecker
from models.role import Role
from db.database import get_db
from models.user import User
from schemas.audit import AuditLogListResponse, AuditLogOut, AuditStatsOut
from services.audit_service import (
    get_user_login_history,
    get_failed_login_attempts,
    get_analyze_history,
    get_user_activity,
    get_audit_stats,
)


router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("/login-history", response_model=AuditLogListResponse)
def get_my_login_history(
    limit: int = Query(default=50, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(RoleChecker([Role.ADMIN.value])),
    db: Session = Depends(get_db),
):
    """Get login history for the current user."""
    items = get_user_login_history(db, user_id=current_user.id, limit=limit, offset=offset)
    return AuditLogListResponse(
        items=[AuditLogOut.model_validate(item) for item in items],
        total=len(items),
        limit=limit,
        offset=offset,
    )


@router.get("/failed-attempts", response_model=AuditLogListResponse)
def get_my_failed_attempts(
    limit: int = Query(default=50, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(RoleChecker([Role.ADMIN.value])),
    db: Session = Depends(get_db),
):
    """Get failed login attempts for the current user's username."""
    items = get_failed_login_attempts(db, username=current_user.username, limit=limit, offset=offset)
    return AuditLogListResponse(
        items=[AuditLogOut.model_validate(item) for item in items],
        total=len(items),
        limit=limit,
        offset=offset,
    )


@router.get("/analyze-history", response_model=AuditLogListResponse)
def get_my_analyze_history(
    limit: int = Query(default=50, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(RoleChecker([Role.ADMIN.value])),
    db: Session = Depends(get_db),
):
    """Get analysis history for the current user."""
    items = get_analyze_history(db, user_id=current_user.id, limit=limit, offset=offset)
    return AuditLogListResponse(
        items=[AuditLogOut.model_validate(item) for item in items],
        total=len(items),
        limit=limit,
        offset=offset,
    )


@router.get("/activity", response_model=AuditLogListResponse)
def get_my_activity(
    limit: int = Query(default=100, le=200),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(RoleChecker([Role.ADMIN.value])),
    db: Session = Depends(get_db),
):
    """Get all activity for the current user."""
    items = get_user_activity(db, user_id=current_user.id, limit=limit, offset=offset)
    return AuditLogListResponse(
        items=[AuditLogOut.model_validate(item) for item in items],
        total=len(items),
        limit=limit,
        offset=offset,
    )


@router.get("/stats", response_model=AuditStatsOut)
def get_my_stats(
    current_user: User = Depends(RoleChecker([Role.ADMIN.value])),
    db: Session = Depends(get_db),
):
    """Get audit statistics for the current user."""
    stats = get_audit_stats(db, user_id=current_user.id)
    return AuditStatsOut(**stats)
