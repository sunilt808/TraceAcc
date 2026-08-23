"""
deps.py — Authentication, Workspace & RBAC Dependencies.

Responsibilities:
    1. Extract Bearer token
    2. Authenticate current user
    3. Validate active account
    4. Resolve active organization/workspace
    5. Enforce role-based access control

Roles (exactly four):
    CLIENT_USER
    ADMIN
    TRACE_LAB_ANALYST
    INVESTIGATOR

ADMIN is the top-level role and can perform every admin
operation across the platform.
"""

from typing import List, Optional

from fastapi import (
    Depends,
    Header,
    HTTPException,
    status,
)
from fastapi.security import (
    HTTPAuthorizationCredentials,
    HTTPBearer,
)
from sqlalchemy.orm import Session

from db.database import get_db
from models.user import User
from models.role import Role, LEGACY_SUPER_ADMIN
from models.organization import Organization

from services.auth_service import (
    decode_access_token,
    get_user_by_username,
)


# ============================================================
# BEARER AUTHENTICATION
# ============================================================

bearer_scheme = HTTPBearer(
    auto_error=False
)


def get_bearer_token(
    credentials: Optional[
        HTTPAuthorizationCredentials
    ] = Depends(bearer_scheme),
) -> str:

    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
            headers={
                "WWW-Authenticate": "Bearer",
            },
        )

    if credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication scheme",
            headers={
                "WWW-Authenticate": "Bearer",
            },
        )

    if not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
            headers={
                "WWW-Authenticate": "Bearer",
            },
        )

    return credentials.credentials


# ============================================================
# CURRENT USER
# ============================================================

def get_current_user(
    token: str = Depends(get_bearer_token),
    db: Session = Depends(get_db),
) -> User:

    payload = decode_access_token(
        token
    )

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={
                "WWW-Authenticate": "Bearer",
            },
        )

    username = payload.get("sub")

    if not username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token subject",
            headers={
                "WWW-Authenticate": "Bearer",
            },
        )

    user = get_user_by_username(
        db,
        username,
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={
                "WWW-Authenticate": "Bearer",
            },
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated",
        )

    # --------------------------------------------------------
    # LEGACY ROLE NORMALIZATION (self-healing)
    #
    # Old databases may still contain rows with the retired
    # SUPER_ADMIN role. ADMIN is now the top-level role, so
    # normalize those rows transparently on first access.
    # --------------------------------------------------------

    if user.role == LEGACY_SUPER_ADMIN:
        user.role = Role.ADMIN.value
        db.add(user)
        db.commit()
        db.refresh(user)

    # --------------------------------------------------------
    # ORGANIZATION VALIDATION
    #
    # Every user must belong to a valid organization.
    # --------------------------------------------------------

    if user.organization_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "User does not belong to any "
                "organization/workspace"
            ),
        )

    organization = (
        db.query(Organization)
        .filter(
            Organization.id
            == user.organization_id
        )
        .first()
    )

    if not organization:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User organization was not found",
        )

    return user


# ============================================================
# WORKSPACE / ORGANIZATION RESOLUTION
# ============================================================

def get_current_workspace(
    user: User = Depends(get_current_user),
    x_organization_id: Optional[int] = Header(
        None,
        alias="X-Organization-Id",
    ),
    db: Session = Depends(get_db),
) -> int:
    """
    Resolve organization/workspace.

    CLIENT_USER:
        Own organization only.

    ADMIN:
        Top-level role — defaults to own organization,
        but may operate on ANY organization by passing
        X-Organization-Id (needed for user provisioning,
        org approval, cross-org administration).

    TRACE_LAB_ANALYST:
        Assigned organization only.

    INVESTIGATOR:
        Assigned organization only.
    """

    # --------------------------------------------------------
    # ADMIN — full platform administration
    # --------------------------------------------------------

    if user.role == Role.ADMIN.value:

        if x_organization_id is not None:
            organization_id = x_organization_id
        elif user.organization_id is not None:
            organization_id = user.organization_id
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "ADMIN must provide X-Organization-Id "
                    "for organization-scoped operations"
                ),
            )

        organization = (
            db.query(Organization)
            .filter(
                Organization.id
                == organization_id
            )
            .first()
        )

        if not organization:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Organization not found",
            )

        return organization.id

    # --------------------------------------------------------
    # ALL NORMAL USERS MUST HAVE AN ORGANIZATION
    # --------------------------------------------------------

    if user.organization_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "User does not belong to any "
                "organization/workspace"
            ),
        )

    # --------------------------------------------------------
    # NORMAL USERS CANNOT SWITCH ORGANIZATION
    # --------------------------------------------------------

    if x_organization_id is not None:

        if x_organization_id != user.organization_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "You are not authorized to access "
                    "this organization/workspace"
                ),
            )

    organization = (
        db.query(Organization)
        .filter(
            Organization.id
            == user.organization_id
        )
        .first()
    )

    if not organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )

    return organization.id


# ============================================================
# ROLE CHECKER
# ============================================================

class RoleChecker:
    """
    Role-Based Access Control dependency.

    Checks the user's role against the allowed list.
    """

    def __init__(
        self,
        allowed_roles: List[str],
    ):
        self.allowed_roles = allowed_roles

    def __call__(
        self,
        user: User = Depends(get_current_user),
    ) -> User:

        if not self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "No roles are configured "
                    "for this operation"
                ),
            )

        effective_allowed = set(
            self.allowed_roles
        )

        if user.role not in effective_allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "Operation not permitted. "
                    f"Required role: {self.allowed_roles}"
                ),
            )

        return user


# ============================================================
# ROLE-SPECIFIC DEPENDENCIES
# ============================================================

def require_client(
    user: User = Depends(get_current_user),
) -> User:

    if user.role != Role.CLIENT_USER.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Client access required",
        )

    return user


def require_admin(
    user: User = Depends(get_current_user),
) -> User:

    if user.role != Role.ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )

    return user


def require_analyst(
    user: User = Depends(get_current_user),
) -> User:

    if user.role != Role.TRACE_LAB_ANALYST.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="TraceLab analyst access required",
        )

    return user


def require_investigator(
    user: User = Depends(get_current_user),
) -> User:

    if user.role != Role.INVESTIGATOR.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="InvoSpace investigator access required",
        )

    return user


# ============================================================
# INTERNAL USER
# ============================================================

def require_internal_user(
    user: User = Depends(get_current_user),
) -> User:

    internal_roles = {
        Role.ADMIN.value,
        Role.TRACE_LAB_ANALYST.value,
        Role.INVESTIGATOR.value,
    }

    if user.role not in internal_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Internal user access required",
        )

    return user