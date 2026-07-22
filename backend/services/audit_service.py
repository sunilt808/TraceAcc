import json
import traceback
from datetime import datetime, timezone
from typing import Optional, Any
from enum import Enum

from fastapi import Request
from sqlalchemy.orm import Session

from models.audit_log import AuditLog


class EventType(str, Enum):
    AUTH = "AUTH"
    ANALYZE = "ANALYZE"
    PROFILE = "PROFILE"
    SYSTEM = "SYSTEM"
    ERROR = "ERROR"


class EventAction(str, Enum):
    # Auth actions
    LOGIN = "login"
    LOGIN_FAILED = "login_failed"
    REGISTER = "register"
    LOGOUT = "logout"
    TOKEN_REFRESH = "token_refresh"
    TOKEN_INVALID = "token_invalid"
    
    # Profile actions
    PASSWORD_CHANGE = "password_change"
    PASSWORD_CHANGE_FAILED = "password_change_failed"
    PROFILE_VIEW = "profile_view"
    
    # Analyze actions
    ANALYZE_START = "analyze_start"
    ANALYZE_SUCCESS = "analyze_success"
    ANALYZE_FAILED = "analyze_failed"
    
    # System actions
    STARTUP = "startup"
    SHUTDOWN = "shutdown"
    DB_INIT = "db_init"
    
    # Error actions
    UNHANDLED_ERROR = "unhandled_error"
    VALIDATION_ERROR = "validation_error"
    AUTH_ERROR = "auth_error"


class EventStatus(str, Enum):
    SUCCESS = "success"
    FAILURE = "failure"
    ERROR = "error"


def log_event(
    db: Session,
    event_type: EventType,
    event_action: EventAction,
    event_status: EventStatus,
    user_id: Optional[int] = None,
    username: Optional[str] = None,
    request: Optional[Request] = None,
    details: Optional[dict[str, Any]] = None,
    error_message: Optional[str] = None,
    duration_ms: Optional[int] = None,
) -> AuditLog:
    """
    Unified audit logging function for all backend events.
    
    Args:
        db: Database session
        event_type: Category of event (AUTH, ANALYZE, PROFILE, SYSTEM, ERROR)
        event_action: Specific action being logged
        event_status: Outcome of the action (success, failure, error)
        user_id: ID of the user performing the action (if authenticated)
        username: Username of the user (for failed logins where user_id may not exist)
        request: FastAPI request object for extracting IP, user agent, endpoint
        details: Additional context as a dictionary (will be JSON serialized)
        error_message: Error message if applicable
        duration_ms: Duration of the operation in milliseconds
    
    Returns:
        The created AuditLog record
    """
    # Extract request context if provided
    ip_address = None
    user_agent = None
    endpoint = None
    method = None
    
    if request:
        # Get real IP (handles proxies)
        ip_address = request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
        if not ip_address:
            ip_address = request.client.host if request.client else None
        
        user_agent = request.headers.get("User-Agent", "")[:500]  # Truncate to fit column
        endpoint = str(request.url.path)
        method = request.method
    
    # Serialize details to JSON
    details_json = None
    if details:
        try:
            details_json = json.dumps(details, default=str)
        except Exception:
            details_json = str(details)
    
    audit_log = AuditLog(
        timestamp=datetime.now(timezone.utc),
        event_type=event_type.value,
        event_action=event_action.value,
        event_status=event_status.value,
        user_id=user_id,
        username=username,
        ip_address=ip_address,
        user_agent=user_agent,
        endpoint=endpoint,
        method=method,
        details=details_json,
        error_message=error_message,
        duration_ms=duration_ms,
    )
    
    db.add(audit_log)
    db.commit()
    db.refresh(audit_log)
    
    return audit_log


def log_error(
    db: Session,
    error: Exception,
    request: Optional[Request] = None,
    user_id: Optional[int] = None,
    username: Optional[str] = None,
    context: Optional[dict[str, Any]] = None,
) -> AuditLog:
    """
    Convenience function for logging errors with full traceback.
    """
    error_details = {
        "error_type": type(error).__name__,
        "error_str": str(error),
        "traceback": traceback.format_exc(),
    }
    
    if context:
        error_details.update(context)
    
    return log_event(
        db=db,
        event_type=EventType.ERROR,
        event_action=EventAction.UNHANDLED_ERROR,
        event_status=EventStatus.ERROR,
        user_id=user_id,
        username=username,
        request=request,
        details=error_details,
        error_message=str(error),
    )


# Query helpers for API endpoints
def get_user_login_history(
    db: Session,
    user_id: int,
    limit: int = 50,
    offset: int = 0,
) -> list[AuditLog]:
    """Get login history for a specific user."""
    return (
        db.query(AuditLog)
        .filter(
            AuditLog.user_id == user_id,
            AuditLog.event_action.in_([EventAction.LOGIN.value, EventAction.LOGIN_FAILED.value])
        )
        .order_by(AuditLog.timestamp.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


def get_failed_login_attempts(
    db: Session,
    username: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> list[AuditLog]:
    """Get failed login attempts, optionally filtered by username."""
    query = db.query(AuditLog).filter(
        AuditLog.event_action == EventAction.LOGIN_FAILED.value
    )
    
    if username:
        query = query.filter(AuditLog.username == username)
    
    return query.order_by(AuditLog.timestamp.desc()).offset(offset).limit(limit).all()


def get_analyze_history(
    db: Session,
    user_id: Optional[int] = None,
    limit: int = 50,
    offset: int = 0,
) -> list[AuditLog]:
    """Get analysis history, optionally filtered by user."""
    query = db.query(AuditLog).filter(
        AuditLog.event_type == EventType.ANALYZE.value
    )
    
    if user_id:
        query = query.filter(AuditLog.user_id == user_id)
    
    return query.order_by(AuditLog.timestamp.desc()).offset(offset).limit(limit).all()


def get_user_activity(
    db: Session,
    user_id: int,
    limit: int = 100,
    offset: int = 0,
) -> list[AuditLog]:
    """Get all activity for a specific user."""
    return (
        db.query(AuditLog)
        .filter(AuditLog.user_id == user_id)
        .order_by(AuditLog.timestamp.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


def get_recent_errors(
    db: Session,
    limit: int = 50,
    offset: int = 0,
) -> list[AuditLog]:
    """Get recent error logs."""
    return (
        db.query(AuditLog)
        .filter(AuditLog.event_status == EventStatus.ERROR.value)
        .order_by(AuditLog.timestamp.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


def get_audit_stats(db: Session, user_id: Optional[int] = None) -> dict:
    """Get audit statistics."""
    from sqlalchemy import func
    
    base_query = db.query(AuditLog)
    if user_id:
        base_query = base_query.filter(AuditLog.user_id == user_id)
    
    total_events = base_query.count()
    
    success_count = base_query.filter(AuditLog.event_status == EventStatus.SUCCESS.value).count()
    failure_count = base_query.filter(AuditLog.event_status == EventStatus.FAILURE.value).count()
    error_count = base_query.filter(AuditLog.event_status == EventStatus.ERROR.value).count()
    
    login_count = base_query.filter(AuditLog.event_action == EventAction.LOGIN.value).count()
    analyze_count = base_query.filter(AuditLog.event_action == EventAction.ANALYZE_SUCCESS.value).count()
    
    return {
        "total_events": total_events,
        "success_count": success_count,
        "failure_count": failure_count,
        "error_count": error_count,
        "login_count": login_count,
        "analyze_count": analyze_count,
    }
