"""
admin.py — TraceAcc Pro Admin Management API.

Responsibilities:
    - User management
    - Organization management
    - Organization approval
    - Service request review
    - TraceLab / InvoSpace assignment
    - Client report review
    - Operations queue
    - Dashboard statistics

Operational roles:
    CLIENT_USER
    ADMIN
    TRACE_LAB_ANALYST
    INVESTIGATOR

ADMIN is the top-level administrative role and can perform
every admin operation across the platform.
"""

from datetime import datetime, timezone
from typing import Optional

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
)
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func as sa_func
from sqlalchemy.orm import Session

from api.deps import RoleChecker
from db.database import get_db

from models.user import User
from models.role import Role
from models.organization import Organization
from models.case import Case
from models.alert import Alert
from models.service_request import ServiceRequest
from models.workflow_instance import WorkflowInstance
from models.assignment import Assignment
from models.activity_timeline import ActivityTimeline
from models.client_report import ClientReport

from services.auth_service import (
    create_user as auth_create_user,
    get_user_by_username,
)


router = APIRouter(
    prefix="/admin",
    tags=["admin"],
)


# ============================================================
# ROLE HELPERS
# ============================================================

ADMIN_ROLES = [
    Role.ADMIN.value,
]


VALID_ROLES = {
    Role.CLIENT.value,
    Role.ADMIN.value,
    Role.ANALYST.value,
    Role.INVOSPACE.value,
}


def _is_admin(user: User) -> bool:
    return user.role == Role.ADMIN.value


def _validate_password_strength(password: str) -> None:
    """
    Same enterprise policy as self-registration:
      >= 8 chars, at least one letter and one digit.
    """
    if len(password) < 8:
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 8 characters long.",
        )
    if not any(c.isalpha() for c in password):
        raise HTTPException(
            status_code=400,
            detail="Password must contain at least one letter.",
        )
    if not any(c.isdigit() for c in password):
        raise HTTPException(
            status_code=400,
            detail="Password must contain at least one digit.",
        )


def _can_manage_role(
    current_user: User,
    target_role: str,
) -> bool:
    """
    ADMIN is the top-level role and can provision
    every operational role:
        CLIENT_USER
        ADMIN
        TRACE_LAB_ANALYST
        INVESTIGATOR
    """

    return target_role in VALID_ROLES


# ============================================================
# SCHEMAS
# ============================================================

class UserUpdate(BaseModel):
    role: Optional[str] = None
    is_active: Optional[bool] = None
    organization_id: Optional[int] = None
    phone: Optional[str] = None


class UserCreateAdmin(BaseModel):
    username: str = Field(
        min_length=3,
        max_length=150,
    )

    email: Optional[EmailStr] = None

    phone: Optional[str] = None

    password: str = Field(
        min_length=8,
        max_length=128,
    )

    role: str

    organization_id: Optional[int] = None


class OrganizationCreate(BaseModel):
    name: str = Field(
        min_length=2,
        max_length=255,
    )

    org_type: Optional[str] = None
    registration_number: Optional[str] = None
    country: Optional[str] = None
    state: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None
    website: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    contact_person: Optional[str] = None


class OrganizationUpdate(BaseModel):
    status: Optional[str] = None
    name: Optional[str] = None
    org_type: Optional[str] = None
    registration_number: Optional[str] = None
    country: Optional[str] = None
    state: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None
    website: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    contact_person: Optional[str] = None


class RequestReviewAction(BaseModel):
    action: str
    assignee_id: Optional[int] = None
    note: Optional[str] = None
    due_at: Optional[datetime] = None


class ReportReviewAction(BaseModel):
    action: str
    note: Optional[str] = None


# ============================================================
# ORGANIZATION SERIALIZER
# ============================================================

def _org_to_dict(org: Organization) -> dict:
    return {
        "id": org.id,
        "name": org.name,
        "org_type": org.org_type,
        "registration_number": org.registration_number,
        "country": org.country,
        "state": org.state,
        "city": org.city,
        "address": org.address,
        "website": org.website,
        "phone": org.phone,
        "email": org.email,
        "contact_person": org.contact_person,
        "status": org.status,
        "approved_at": (
            org.approved_at.isoformat()
            if org.approved_at
            else None
        ),
        "approved_by_id": org.approved_by_id,
        "created_at": (
            org.created_at.isoformat()
            if org.created_at
            else None
        ),
        "updated_at": (
            org.updated_at.isoformat()
            if org.updated_at
            else None
        ),
    }


# ============================================================
# USER SCOPE
# ============================================================

def _get_user_in_scope(
    db: Session,
    current_user: User,
    user_id: int,
):
    """
    ADMIN is a platform-wide role: it can manage any user.
    """
    query = db.query(User).filter(
        User.id == user_id
    )

    return query.first()


# ============================================================
# ORGANIZATION SCOPE
# ============================================================

def _get_org_in_scope(
    db: Session,
    current_user: User,
    org_id: int,
):
    """
    ADMIN:
        Can access every organization (platform-wide
        administration).

    Other roles (defensive — routes are admin-gated):
        Own organization only.
    """

    org = (
        db.query(Organization)
        .filter(
            Organization.id == org_id
        )
        .first()
    )

    if not org:
        return None

    # ADMIN = platform-wide
    if _is_admin(current_user):
        return org

    # Own organization
    if org.id == current_user.organization_id:
        return org

    raise HTTPException(
        status_code=403,
        detail=(
            "You are not authorized to access "
            "this organization."
        ),
    )


# ============================================================
# USER MANAGEMENT
# ============================================================

@router.get("/users")
def list_users(
    limit: int = Query(
        100,
        ge=1,
        le=500,
    ),
    offset: int = Query(
        0,
        ge=0,
    ),
    current_user: User = Depends(
        RoleChecker(ADMIN_ROLES)
    ),
    db: Session = Depends(get_db),
):
    """
    ADMIN:
        All users (platform-wide).
    """

    query = db.query(User)

    total = query.count()

    users = (
        query
        .order_by(User.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return {
        "items": [
            {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "phone": user.phone,
                "role": user.role,
                "organization_id": user.organization_id,
                "is_active": user.is_active,
                "last_login": (
                    user.last_login.isoformat()
                    if user.last_login
                    else None
                ),
                "created_at": (
                    user.created_at.isoformat()
                    if user.created_at
                    else None
                ),
            }
            for user in users
        ],
        "total": total,
    }


@router.patch("/users/{user_id}")
def update_user(
    user_id: int,
    body: UserUpdate,
    current_user: User = Depends(
        RoleChecker(ADMIN_ROLES)
    ),
    db: Session = Depends(get_db),
):
    user = _get_user_in_scope(
        db,
        current_user,
        user_id,
    )

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found.",
        )

    if user.id == current_user.id:
        raise HTTPException(
            status_code=400,
            detail=(
                "Cannot modify your own account "
                "through admin API."
            ),
        )

    # --------------------------------------------------------
    # ROLE
    # --------------------------------------------------------

    if body.role is not None:

        valid_roles = VALID_ROLES

        if body.role not in valid_roles:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Invalid role. Allowed roles: "
                    f"{sorted(valid_roles)}"
                ),
            )

        user.role = body.role

    # --------------------------------------------------------
    # ACTIVE
    # --------------------------------------------------------

    if body.is_active is not None:
        user.is_active = body.is_active

    # --------------------------------------------------------
    # ORGANIZATION
    # --------------------------------------------------------

    if body.organization_id is not None:

        target_org = (
            db.query(Organization)
            .filter(
                Organization.id
                == body.organization_id
            )
            .first()
        )

        if not target_org:
            raise HTTPException(
                status_code=404,
                detail="Target organization not found.",
            )

        if target_org.status != "APPROVED":
            raise HTTPException(
                status_code=400,
                detail=(
                    "User cannot be assigned to a "
                    "non-approved organization."
                ),
            )

        user.organization_id = target_org.id

    # --------------------------------------------------------
    # PHONE
    # --------------------------------------------------------

    if body.phone is not None:
        user.phone = body.phone

    db.commit()
    db.refresh(user)

    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "phone": user.phone,
        "role": user.role,
        "organization_id": user.organization_id,
        "is_active": user.is_active,
    }


# ============================================================
# CREATE USER
# ============================================================

@router.post(
    "/users",
    status_code=201,
)
def create_admin_user(
    body: UserCreateAdmin,
    current_user: User = Depends(
        RoleChecker(ADMIN_ROLES)
    ),
    db: Session = Depends(get_db),
):
    existing_user = get_user_by_username(
        db,
        body.username,
    )

    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Username already registered.",
        )

    if body.email:
        existing_email = (
            db.query(User)
            .filter(
                User.email
                == str(body.email).lower().strip()
            )
            .first()
        )

        if existing_email:
            raise HTTPException(
                status_code=409,
                detail=(
                    "Email already registered to "
                    "another user."
                ),
            )

    _validate_password_strength(body.password)

    if body.role not in VALID_ROLES:
        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid role. Allowed roles: "
                f"{sorted(VALID_ROLES)}"
            ),
        )

    if not _can_manage_role(
        current_user,
        body.role,
    ):
        raise HTTPException(
            status_code=403,
            detail=(
                "Invalid role for provisioning."
            ),
        )

    # --------------------------------------------------------
    # ORGANIZATION RESOLUTION
    #
    # ADMIN (platform-wide):
    #   - organization_id omitted → new user joins the
    #     admin's own organization (when the admin has one).
    #   - organization_id provided → must be an APPROVED
    #     organization.
    # --------------------------------------------------------

    if body.organization_id is not None:

        target_org = (
            db.query(Organization)
            .filter(
                Organization.id
                == body.organization_id
            )
            .first()
        )

        if not target_org:
            raise HTTPException(
                status_code=404,
                detail="Organization not found.",
            )

        if target_org.status != "APPROVED":
            raise HTTPException(
                status_code=400,
                detail=(
                    "Users can only be created "
                    "inside approved organizations."
                ),
            )

        org_id = target_org.id

    else:

        org_id = current_user.organization_id

        if org_id is None:
            raise HTTPException(
                status_code=400,
                detail=(
                    "organization_id is required when "
                    "the admin account does not belong "
                    "to an organization."
                ),
            )

    # --------------------------------------------------------
    # CREATE
    # --------------------------------------------------------

    new_user = auth_create_user(
        db=db,
        username=body.username,
        password=body.password,
        email=body.email,
        phone=body.phone,
        role=Role(body.role),
        organization_id=org_id,
    )

    return {
        "id": new_user.id,
        "username": new_user.username,
        "email": new_user.email,
        "phone": new_user.phone,
        "role": new_user.role,
        "organization_id": new_user.organization_id,
        "is_active": new_user.is_active,
    }


# ============================================================
# DELETE USER
# ============================================================

@router.delete(
    "/users/{user_id}",
    status_code=204,
)
def delete_user(
    user_id: int,
    current_user: User = Depends(
        RoleChecker(ADMIN_ROLES)
    ),
    db: Session = Depends(get_db),
):
    user = _get_user_in_scope(
        db,
        current_user,
        user_id,
    )

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found.",
        )

    if user.id == current_user.id:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete your own account.",
        )

    db.delete(user)
    db.commit()

    return None


# ============================================================
# ORGANIZATION LIST
# ============================================================

@router.get("/organizations")
def list_organizations(
    current_user: User = Depends(
        RoleChecker(ADMIN_ROLES)
    ),
    db: Session = Depends(get_db),
):
    """
    ADMIN:
        All organizations (platform-wide administration,
        including pending registrations for approval).
    """

    orgs = (
        db.query(Organization)
        .order_by(
            Organization.created_at.desc()
        )
        .all()
    )

    result = []

    for org in orgs:

        data = _org_to_dict(org)

        data["user_count"] = (
            db.query(
                sa_func.count(User.id)
            )
            .filter(
                User.organization_id
                == org.id
            )
            .scalar()
            or 0
        )

        result.append(data)

    return result


# ============================================================
# CREATE ORGANIZATION
# ============================================================

@router.post(
    "/organizations",
    status_code=201,
)
def create_organization(
    body: OrganizationCreate,
    current_user: User = Depends(
        RoleChecker(ADMIN_ROLES)
    ),
    db: Session = Depends(get_db),
):
    """
    Direct organization creation is an ADMIN
    (platform-level) operation.

    Normal client registration creates PENDING organizations.
    """

    existing = (
        db.query(Organization)
        .filter(
            Organization.name == body.name
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=409,
            detail=(
                "Organization with this name "
                "already exists."
            ),
        )

    org = Organization(
        name=body.name,
        org_type=body.org_type,
        registration_number=body.registration_number,
        country=body.country,
        state=body.state,
        city=body.city,
        address=body.address,
        website=body.website,
        phone=body.phone,
        email=body.email,
        contact_person=body.contact_person,
        status="APPROVED",
        approved_at=datetime.now(timezone.utc),
        approved_by_id=current_user.id,
    )

    db.add(org)
    db.commit()
    db.refresh(org)

    return _org_to_dict(org)


# ============================================================
# UPDATE / APPROVE ORGANIZATION
# ============================================================

@router.patch(
    "/organizations/{org_id}"
)
def update_organization(
    org_id: int,
    body: OrganizationUpdate,
    current_user: User = Depends(
        RoleChecker(ADMIN_ROLES)
    ),
    db: Session = Depends(get_db),
):
    """
    Organization governance.

    ADMIN:
        - Full organization governance
          (approve/reject/update any organization).
    """

    org = _get_org_in_scope(
        db,
        current_user,
        org_id,
    )

    if not org:
        raise HTTPException(
            status_code=404,
            detail="Organization not found.",
        )

    # ========================================================
    # STATUS CHANGE
    # ========================================================

    if body.status is not None:

        new_status = body.status.upper()

        valid_statuses = {
            "PENDING",
            "APPROVED",
            "REJECTED",
        }

        if new_status not in valid_statuses:
            raise HTTPException(
                status_code=400,
                detail=(
                    "status must be one of "
                    f"{sorted(valid_statuses)}"
                ),
            )

        # ----------------------------------------------------
        # APPLY STATUS
        # ----------------------------------------------------

        org.status = new_status

        if new_status == "APPROVED":

            org.approved_at = (
                datetime.now(timezone.utc)
            )

            org.approved_by_id = (
                current_user.id
            )

        elif new_status == "REJECTED":

            org.approved_at = None
            org.approved_by_id = None

        elif new_status == "PENDING":

            org.approved_at = None
            org.approved_by_id = None

    # ========================================================
    # ORGANIZATION DETAILS
    # ========================================================

    # ADMIN has full organization governance.

    # ========================================================
    # APPLY DETAILS
    # ========================================================

    if body.name is not None:
        org.name = body.name

    if body.org_type is not None:
        org.org_type = body.org_type

    if body.registration_number is not None:
        org.registration_number = (
            body.registration_number
        )

    if body.country is not None:
        org.country = body.country

    if body.state is not None:
        org.state = body.state

    if body.city is not None:
        org.city = body.city

    if body.address is not None:
        org.address = body.address

    if body.website is not None:
        org.website = body.website

    if body.phone is not None:
        org.phone = body.phone

    if body.email is not None:
        org.email = body.email

    if body.contact_person is not None:
        org.contact_person = (
            body.contact_person
        )

    db.commit()
    db.refresh(org)

    return _org_to_dict(org)


# ============================================================
# REQUEST QUEUE HELPERS
# ============================================================

def _request_queue_item(
    db: Session,
    request: ServiceRequest,
) -> dict:

    workflow = (
        db.query(WorkflowInstance)
        .filter(
            WorkflowInstance.service_request_id
            == request.id
        )
        .order_by(
            WorkflowInstance.created_at.desc()
        )
        .first()
    )

    assignee = (
        db.query(User)
        .filter(
            User.id == request.assigned_to_id
        )
        .first()
        if request.assigned_to_id
        else None
    )

    latest_assignment = None

    if workflow:
        latest_assignment = (
            db.query(Assignment)
            .filter(
                Assignment.workflow_instance_id
                == workflow.id
            )
            .order_by(
                Assignment.created_at.desc()
            )
            .first()
        )

    org = (
        db.query(Organization)
        .filter(
            Organization.id
            == request.organization_id
        )
        .first()
    )

    assigned_team = None

    if assignee:

        if (
            assignee.role
            == Role.ANALYST.value
        ):
            assigned_team = "TraceLab"

        elif (
            assignee.role
            == Role.INVOSPACE.value
        ):
            assigned_team = "InvoSpace"

        else:
            assigned_team = assignee.role

    return {
        "id": request.id,
        "organization_id": request.organization_id,
        "organization_name": (
            org.name
            if org
            else None
        ),
        "title": request.title,
        "description": request.description,
        "request_type": request.request_type,
        "status": request.status,
        "assigned_to_id": request.assigned_to_id,
        "assigned_user": (
            assignee.username
            if assignee
            else None
        ),
        "assigned_team": assigned_team,
        "priority": (
            "HIGH"
            if request.request_type
            == "INVESTIGATION"
            else "MEDIUM"
        ),
        "due_at": (
            latest_assignment.due_at.isoformat()
            if (
                latest_assignment
                and latest_assignment.due_at
            )
            else None
        ),
        "workflow_instance_id": (
            workflow.id
            if workflow
            else None
        ),
        "current_stage": (
            workflow.current_stage
            if workflow
            else None
        ),
        "current_status": (
            workflow.current_status
            if workflow
            else request.status
        ),
        "created_at": (
            request.created_at.isoformat()
            if request.created_at
            else None
        ),
        "updated_at": (
            request.updated_at.isoformat()
            if request.updated_at
            else None
        ),
    }


def _service_request_workflow(
    db: Session,
    request_id: int,
    org_id: int,
):
    return (
        db.query(WorkflowInstance)
        .filter(
            WorkflowInstance.service_request_id
            == request_id,
            WorkflowInstance.organization_id
            == org_id,
        )
        .order_by(
            WorkflowInstance.created_at.desc()
        )
        .first()
    )


def _record_workflow_event(
    db: Session,
    workflow: WorkflowInstance,
    actor_id: int,
    action: str,
    from_status: str,
    to_status: str,
    note: Optional[str],
):
    db.add(
        ActivityTimeline(
            organization_id=workflow.organization_id,
            workflow_instance_id=workflow.id,
            actor_id=actor_id,
            action=action,
            from_status=from_status,
            to_status=to_status,
            details=note,
        )
    )


def _service_request_scope_query(
    db: Session,
    current_user: User,
):
    """
    ADMIN is platform-wide: sees service requests of
    every organization.
    """
    return db.query(ServiceRequest)


def _service_request_for_review(
    db: Session,
    current_user: User,
    request_id: int,
):
    return (
        db.query(ServiceRequest)
        .filter(
            ServiceRequest.id == request_id
        )
        .first()
    )


# ============================================================
# REQUEST QUEUE
# ============================================================

@router.get("/request-queue")
def request_queue(
    status: Optional[str] = Query(None),
    current_user: User = Depends(
        RoleChecker(ADMIN_ROLES)
    ),
    db: Session = Depends(get_db),
):

    q = _service_request_scope_query(
        db,
        current_user,
    )

    if status:
        q = q.filter(
            ServiceRequest.status
            == status.upper()
        )

    items = (
        q.order_by(
            ServiceRequest.created_at.desc()
        )
        .all()
    )

    grouped = {
        key: 0
        for key in [
            "SUBMITTED",
            "APPROVED",
            "REJECTED",
            "IN_PROGRESS",
            "COMPLETED",
        ]
    }

    for request in (
        _service_request_scope_query(
            db,
            current_user,
        ).all()
    ):
        grouped[request.status] = (
            grouped.get(request.status, 0) + 1
        )

    return {
        "items": [
            _request_queue_item(
                db,
                request,
            )
            for request in items
        ],
        "counts": grouped,
        "total": len(items),
    }


# ============================================================
# SERVICE REQUEST REVIEW
# ============================================================

@router.patch(
    "/service-requests/{request_id}/review"
)
def review_service_request(
    request_id: int,
    body: RequestReviewAction,
    current_user: User = Depends(
        RoleChecker(ADMIN_ROLES)
    ),
    db: Session = Depends(get_db),
):

    request = _service_request_for_review(
        db,
        current_user,
        request_id,
    )

    if not request:
        raise HTTPException(
            status_code=404,
            detail="Service request not found.",
        )

    org_id = request.organization_id

    workflow = _service_request_workflow(
        db,
        request.id,
        org_id,
    )

    action = body.action.upper()

    valid_actions = {
        "ACCEPT",
        "REJECT",
        "ASSIGN_TRACELAB",
        "ASSIGN_INVOSPACE",
        "REASSIGN",
    }

    if action not in valid_actions:
        raise HTTPException(
            status_code=400,
            detail=(
                f"action must be one of "
                f"{sorted(valid_actions)}"
            ),
        )

    old_status = request.status

    old_stage = (
        workflow.current_stage
        if workflow
        else None
    )

    # ========================================================
    # ACCEPT
    # ========================================================

    if action == "ACCEPT":

        request.status = "APPROVED"

        if workflow:

            workflow.current_status = "APPROVED"
            workflow.current_stage = "ADMIN_REVIEW"
            workflow.last_note = (
                body.note
                or "Request accepted"
            )

            _record_workflow_event(
                db,
                workflow,
                current_user.id,
                "TRANSITION",
                old_status,
                request.status,
                body.note
                or "Request accepted",
            )

    # ========================================================
    # REJECT
    # ========================================================

    elif action == "REJECT":

        request.status = "REJECTED"

        if workflow:

            workflow.current_status = "REJECTED"
            workflow.current_stage = "ADMIN_REVIEW"
            workflow.last_note = (
                body.note
                or "Request rejected"
            )

            _record_workflow_event(
                db,
                workflow,
                current_user.id,
                "TRANSITION",
                old_status,
                request.status,
                body.note
                or "Request rejected",
            )

    # ========================================================
    # ASSIGNMENT
    # ========================================================

    else:

        if not body.assignee_id:
            raise HTTPException(
                status_code=400,
                detail=(
                    "assignee_id is required "
                    "for assignment."
                ),
            )

        assignee = (
            db.query(User)
            .filter(
                User.id == body.assignee_id,
                User.is_active.is_(True),
            )
            .first()
        )

        if not assignee:
            raise HTTPException(
                status_code=404,
                detail=(
                    "Assignee not found "
                    "(or account is inactive)."
                ),
            )

        # ----------------------------------------------------
        # Staff (analyst / invospace) may live in an internal
        # organization while the request belongs to a client
        # organization. ADMIN is platform-wide, so assignment
        # across organizations is intentional and allowed.
        # ----------------------------------------------------

        if action == "ASSIGN_TRACELAB":

            if assignee.role != Role.ANALYST.value:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "TraceLab assignment requires "
                        "a TRACE_LAB_ANALYST."
                    ),
                )

            target_stage = "TRACE_LAB"

        elif action == "ASSIGN_INVOSPACE":

            if (
                assignee.role
                != Role.INVOSPACE.value
            ):
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "InvoSpace assignment requires "
                        "an INVESTIGATOR."
                    ),
                )

            target_stage = "INVOSPACE"

        else:

            if assignee.role == Role.ANALYST.value:
                target_stage = "TRACE_LAB"

            elif (
                assignee.role
                == Role.INVOSPACE.value
            ):
                target_stage = "INVOSPACE"

            else:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Request can only be assigned "
                        "to TRACE_LAB_ANALYST or "
                        "INVESTIGATOR."
                    ),
                )

        request.assigned_to_id = assignee.id
        request.assigned_by_id = current_user.id
        request.assigned_at = datetime.now(timezone.utc)

        if target_stage == "TRACE_LAB":
            request.assigned_analyst_id = assignee.id
            request.assigned_invospace_id = None
        else:
            request.assigned_invospace_id = assignee.id
            request.assigned_analyst_id = None

        request.status = "IN_PROGRESS"

        if workflow:

            workflow.assignee_id = assignee.id
            workflow.owner_id = current_user.id
            workflow.current_status = "IN_PROGRESS"
            workflow.current_stage = target_stage
            workflow.last_note = (
                body.note
                or f"Assigned to {assignee.username}"
            )

            db.add(
                Assignment(
                    organization_id=org_id,
                    workflow_instance_id=workflow.id,
                    entity_type="SERVICE_REQUEST",
                    entity_id=request.id,
                    assignee_id=assignee.id,
                    assigned_by_id=current_user.id,
                    status="ACTIVE",
                    due_at=body.due_at,
                )
            )

            _record_workflow_event(
                db,
                workflow,
                current_user.id,
                "ASSIGN",
                old_stage or old_status,
                target_stage,
                body.note
                or f"Assigned to {assignee.username}",
            )

    # ========================================================
    # ADMIN NOTE
    # ========================================================

    if body.note:
        request.admin_notes = body.note

    # ========================================================
    # AUDIT
    # ========================================================

    if workflow:

        db.add(
            ActivityTimeline(
                organization_id=org_id,
                workflow_instance_id=workflow.id,
                actor_id=current_user.id,
                action="REQUEST_REVIEW",
                from_status=old_status,
                to_status=request.status,
                details=body.note,
            )
        )

    db.commit()

    # Notify the assignee so the task shows up in their
    # notifications feed immediately.
    if action in (
        "ASSIGN_TRACELAB",
        "ASSIGN_INVOSPACE",
        "REASSIGN",
    ):
        from services.notification_service import (
            notify_request_assigned,
        )

        notify_request_assigned(
            db,
            org_id=org_id,
            assignee_id=assignee.id,
            request_id=request.id,
            request_title=request.title,
            team="TraceLab"
            if target_stage == "TRACE_LAB"
            else "InvoSpace",
        )
        db.commit()

    return _request_queue_item(
        db,
        request,
    )


# ============================================================
# REPORT QUEUE
# ============================================================

@router.get("/report-queue")
def report_queue(
    status: Optional[str] = Query(None),
    current_user: User = Depends(
        RoleChecker(ADMIN_ROLES)
    ),
    db: Session = Depends(get_db),
):

    q = db.query(ClientReport)

    if status:
        q = q.filter(
            ClientReport.status
            == status.upper()
        )

    items = (
        q.order_by(
            ClientReport.created_at.desc()
        )
        .all()
    )

    return {
        "items": [
            {
                "id": report.id,
                "title": report.title,
                "status": report.status,
                "report_type": report.report_type,
                "is_released": report.is_released,
                "case_id": report.case_id,
                "service_request_id": (
                    report.service_request_id
                ),
                "created_at": (
                    report.created_at.isoformat()
                    if report.created_at
                    else None
                ),
                "updated_at": (
                    report.updated_at.isoformat()
                    if report.updated_at
                    else None
                ),
            }
            for report in items
        ],
        "total": len(items),
    }


# ============================================================
# REPORT REVIEW
# ============================================================

@router.patch(
    "/reports/{report_id}/review"
)
def review_report(
    report_id: int,
    body: ReportReviewAction,
    current_user: User = Depends(
        RoleChecker(ADMIN_ROLES)
    ),
    db: Session = Depends(get_db),
):

    query = (
        db.query(ClientReport)
        .filter(
            ClientReport.id == report_id
        )
    )

    report = query.first()

    if not report:
        raise HTTPException(
            status_code=404,
            detail="Report not found.",
        )

    action = body.action.upper()

    valid_actions = {
        "APPROVE",
        "REQUEST_CHANGES",
        "REJECT",
        "RELEASE",
    }

    if action not in valid_actions:
        raise HTTPException(
            status_code=400,
            detail=(
                f"action must be one of "
                f"{sorted(valid_actions)}"
            ),
        )

    workflow = None

    if report.workflow_instance_id:

        workflow = (
            db.query(WorkflowInstance)
            .filter(
                WorkflowInstance.id
                == report.workflow_instance_id,
                WorkflowInstance.organization_id
                == report.organization_id,
            )
            .first()
        )

    previous_status = report.status

    # --------------------------------------------------------
    # APPROVE
    # --------------------------------------------------------

    if action == "APPROVE":

        report.status = "APPROVED"

        if workflow:
            workflow.current_status = "APPROVED"
            workflow.current_stage = "REPORT_REVIEW"
            workflow.last_note = (
                body.note
                or "Report approved"
            )

    # --------------------------------------------------------
    # REQUEST CHANGES
    # --------------------------------------------------------

    elif action == "REQUEST_CHANGES":

        report.status = "CHANGES_REQUESTED"

        if workflow:
            workflow.current_status = (
                "CHANGES_REQUESTED"
            )
            workflow.current_stage = "REPORT_REVIEW"
            workflow.last_note = (
                body.note
                or "Changes requested"
            )

    # --------------------------------------------------------
    # REJECT
    # --------------------------------------------------------

    elif action == "REJECT":

        report.status = "REJECTED"

        if workflow:
            workflow.current_status = "REJECTED"
            workflow.current_stage = "REPORT_REVIEW"
            workflow.last_note = (
                body.note
                or "Report rejected"
            )

    # --------------------------------------------------------
    # RELEASE
    # --------------------------------------------------------

    elif action == "RELEASE":

        if report.status != "APPROVED":
            raise HTTPException(
                status_code=400,
                detail=(
                    "Only an APPROVED report "
                    "can be released."
                ),
            )

        if not report.file_path:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Cannot release a report "
                    "without an uploaded file."
                ),
            )

        report.status = "RELEASED"
        report.is_released = True
        report.released_at = (
            datetime.now(timezone.utc)
        )
        report.released_by_id = (
            current_user.id
        )

        if workflow:

            workflow.current_status = "CLOSED"
            workflow.current_stage = (
                "REPORT_RELEASED"
            )
            workflow.last_note = (
                body.note
                or "Report released to client"
            )

    # --------------------------------------------------------
    # AUDIT
    # --------------------------------------------------------

    if workflow:

        db.add(
            ActivityTimeline(
                organization_id=report.organization_id,
                workflow_instance_id=workflow.id,
                actor_id=current_user.id,
                action="REPORT_REVIEW",
                from_status=previous_status,
                to_status=report.status,
                details=body.note,
            )
        )

    db.commit()
    db.refresh(report)

    return {
        "id": report.id,
        "status": report.status,
        "is_released": report.is_released,
        "released_at": (
            report.released_at.isoformat()
            if report.released_at
            else None
        ),
    }


# ============================================================
# OPERATIONS QUEUE
# ============================================================

@router.get("/operations-queue")
def operations_queue(
    limit: int = Query(
        20,
        ge=1,
        le=100,
    ),
    current_user: User = Depends(
        RoleChecker(ADMIN_ROLES)
    ),
    db: Session = Depends(get_db),
):

    query = db.query(WorkflowInstance)

    workflows = (
        query
        .order_by(
            WorkflowInstance.created_at.desc()
        )
        .limit(limit)
        .all()
    )

    items = []

    for workflow in workflows:

        entry = {
            "id": workflow.id,
            "type": "WORKFLOW",
            "title": "Workflow item",
            "current_status": (
                workflow.current_status
            ),
            "current_stage": (
                workflow.current_stage
            ),
            "last_note": workflow.last_note,
            "created_at": (
                workflow.created_at.isoformat()
                if workflow.created_at
                else None
            ),
        }

        if workflow.service_request_id:

            sr = (
                db.query(ServiceRequest)
                .filter(
                    ServiceRequest.id
                    == workflow.service_request_id,
                    ServiceRequest.organization_id
                    == workflow.organization_id,
                )
                .first()
            )

            if sr:

                entry["title"] = sr.title
                entry["service_request_id"] = sr.id
                entry["request_status"] = sr.status

        if workflow.case_id:

            case = (
                db.query(Case)
                .filter(
                    Case.id == workflow.case_id,
                    Case.organization_id
                    == workflow.organization_id,
                )
                .first()
            )

            if case:

                entry["case_id"] = case.id
                entry["case_title"] = case.title

        items.append(entry)

    return {
        "items": items,
        "total": len(items),
    }


# ============================================================
# DASHBOARD
# ============================================================

@router.get("/dashboard")
def admin_dashboard(
    current_user: User = Depends(
        RoleChecker(ADMIN_ROLES)
    ),
    db: Session = Depends(get_db),
):
    """
    Dashboard statistics (platform-wide for ADMIN).
    """

    # ADMIN sees platform-wide statistics.
    org_id = None

    user_query = db.query(User)
    case_query = db.query(Case)
    alert_query = db.query(Alert)
    request_query = db.query(ServiceRequest)
    org_query = db.query(Organization)

    if org_id is not None:

        user_query = user_query.filter(
            User.organization_id == org_id
        )

        case_query = case_query.filter(
            Case.organization_id == org_id
        )

        alert_query = alert_query.filter(
            Alert.organization_id == org_id
        )

        request_query = request_query.filter(
            ServiceRequest.organization_id
            == org_id
        )

        org_query = org_query.filter(
            Organization.id == org_id
        )

    total_users = user_query.count()

    total_orgs = org_query.count()

    total_cases = case_query.count()

    open_cases = (
        case_query
        .filter(
            Case.status.in_(
                [
                    "OPEN",
                    "INVESTIGATING",
                    "REVIEW",
                ]
            )
        )
        .count()
    )

    total_alerts = alert_query.count()

    new_alerts = (
        alert_query
        .filter(
            Alert.status == "NEW"
        )
        .count()
    )

    total_requests = request_query.count()

    pending_requests = (
        request_query
        .filter(
            ServiceRequest.status.in_(
                [
                    "SUBMITTED",
                    "PENDING",
                ]
            )
        )
        .count()
    )

    # --------------------------------------------------------
    # PENDING ORGANIZATIONS
    #
    # IMPORTANT:
    # This is intentionally NOT tenant-filtered for ADMIN.
    # Pending registrations have not yet entered an approved
    # operational tenant.
    # --------------------------------------------------------

    pending_orgs = (
        db.query(Organization)
        .filter(
            Organization.status == "PENDING"
        )
        .count()
    )

    return {
        "total_users": total_users,
        "total_organizations": total_orgs,
        "total_cases": total_cases,
        "open_cases": open_cases,
        "total_alerts": total_alerts,
        "new_alerts": new_alerts,
        "total_requests": total_requests,
        "pending_requests": pending_requests,
        "pending_organizations": pending_orgs,
    }