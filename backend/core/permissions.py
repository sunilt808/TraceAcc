"""
permissions.py — Centralized RBAC Permission System for TraceAcc Pro.

Canonical role mapping (DB value → operational role):
  CLIENT_USER       → CLIENT
  TRACE_LAB_ANALYST → ANALYST
  INVESTIGATOR      → INVOSPACE
  ADMIN             → ADMIN
  SUPER_ADMIN       → treated as ADMIN (legacy/platform)

Do NOT scatter role checks throughout route files.
Use require_permission() or has_permission() here.
"""
from typing import Set, Optional
from fastapi import Depends, HTTPException, status
from models.user import User
from api.deps import get_current_user

# ---------------------------------------------------------------------------
# Canonical role constants (DB string values — do NOT rename, breaks existing data)
# ---------------------------------------------------------------------------
ROLE_CLIENT   = "CLIENT_USER"
ROLE_ADMIN    = "ADMIN"
ROLE_ANALYST  = "TRACE_LAB_ANALYST"
ROLE_INVOSPACE = "INVESTIGATOR"
ROLE_SUPER    = "SUPER_ADMIN"   # Legacy/platform admin — treated as ADMIN

# Roles that should be treated as ADMIN for permission checks
ADMIN_ROLES: Set[str] = {ROLE_ADMIN, ROLE_SUPER}

# ---------------------------------------------------------------------------
# Full permission matrix
# ---------------------------------------------------------------------------
_PERMISSIONS: dict[str, Set[str]] = {
    ROLE_CLIENT: {
        "request.create",
        "request.view_own",
        "request.update_own",
        "request.respond_information",
        "message.view_own",
        "message.create_to_admin",
        "notification.view",
        "report.view_released",
        "report.download_released",
        "profile.view",
        "profile.update",
    },
    ROLE_ADMIN: {
        # Request management
        "request.view_all",
        "request.review",
        "request.approve",
        "request.reject",
        "request.request_information",
        "request.assign_analyst",
        "request.assign_invospace",
        "request.reassign",
        # Alert management
        "alert.view_all",
        "alert.review",
        "alert.route_to_invospace",
        # Report management
        "report.view_internal",
        "report.review",
        "report.request_revision",
        "report.approve",
        "report.sign",
        "report.release",
        # User management
        "user.view",
        "user.create",
        "user.update",
        "user.disable",
        # Communication
        "message.view",
        "message.create",
        "notification.manage",
        # Audit
        "audit.view",
    },
    ROLE_ANALYST: {
        # Assigned request access
        "request.view_assigned",
        # Dataset/transaction
        "dataset.create",
        "dataset.view_assigned",
        "dataset.validate",
        "transaction.view",
        # Analysis
        "analysis.run",
        "graph.analyze",
        "behaviour.analyze",
        "temporal.analyze",
        "ml.run",
        "risk.calculate",
        # Alert (ANALYST creates alerts — NOT cases)
        "alert.create",
        "alert.view_assigned",
        "alert.update",
        "alert.escalate_to_admin",
        # Technical reporting
        "technical_report.create",
        "technical_report.submit",
    },
    ROLE_INVOSPACE: {
        # Assigned access
        "request.view_assigned",
        "alert.view_assigned",
        # Case management (ONLY InvoSpace creates cases)
        "case.create",
        "case.view_assigned",
        "case.update",
        "case.assign",
        "case.reassign",
        # Evidence
        "evidence.create",
        "evidence.view",
        "evidence.download",
        # Investigation artifacts
        "investigation.note.create",
        "investigation.note.update",
        "investigation.hypothesis.create",
        "investigation.hypothesis.update",
        "investigation.task.create",
        "investigation.task.update",
        "investigation.finding.create",
        "investigation.finding.update",
        "investigation.timeline.create",
        # Investigation analysis
        "investigation.graph.analyze",
        "investigation.behaviour.analyze",
        "investigation.temporal.analyze",
        "investigation.ml.run",
        "investigation.risk.reassess",
        # Investigation reporting
        "investigation_report.create",
        "investigation_report.submit",
        "investigation_report.revise",
    },
}

# SUPER_ADMIN inherits all ADMIN permissions
_PERMISSIONS[ROLE_SUPER] = set(_PERMISSIONS[ROLE_ADMIN])


# ---------------------------------------------------------------------------
# Permission helpers
# ---------------------------------------------------------------------------

def _effective_role(role: str) -> str:
    """Normalize SUPER_ADMIN → ADMIN for permission lookups."""
    if role == ROLE_SUPER:
        return ROLE_ADMIN
    return role


def has_permission(user: User, permission: str) -> bool:
    """Return True if the user's role grants the given permission."""
    role = _effective_role(user.role)
    return permission in _PERMISSIONS.get(role, set())


def require_permission(permission: str):
    """
    FastAPI dependency factory.

    Usage:
        @router.post("/alerts", dependencies=[Depends(require_permission("alert.create"))])

    Or as a parameter:
        current_user: User = Depends(require_permission("alert.create"))
    """
    def _check(user: User = Depends(get_current_user)) -> User:
        if not has_permission(user, permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied: '{permission}' is not granted to your role ({user.role}).",
            )
        return user
    return _check


def require_any_permission(*permissions: str):
    """Dependency that grants access if the user has ANY of the given permissions."""
    def _check(user: User = Depends(get_current_user)) -> User:
        for perm in permissions:
            if has_permission(user, perm):
                return user
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permission denied. Required one of: {list(permissions)}",
        )
    return _check


def require_role(*roles: str):
    """
    Dependency that checks role membership directly.
    SUPER_ADMIN is automatically treated as ADMIN.
    """
    expanded = set(roles)
    if ROLE_ADMIN in expanded:
        expanded.add(ROLE_SUPER)

    def _check(user: User = Depends(get_current_user)) -> User:
        if user.role not in expanded:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{user.role}' is not authorized for this action.",
            )
        return user
    return _check


def is_admin(user: User) -> bool:
    return user.role in ADMIN_ROLES


def is_client(user: User) -> bool:
    return user.role == ROLE_CLIENT


def is_analyst(user: User) -> bool:
    return user.role == ROLE_ANALYST


def is_invospace(user: User) -> bool:
    return user.role == ROLE_INVOSPACE
