"""
auth.py — Authentication API.

Responsibilities:
    - Client self-registration
    - User registration
    - Login
    - Current-user lookup
    - Password change

Client registration workflow:

    Registration
        ↓
    Organization = PENDING
        ↓
    Admin/Super Admin approval
        ↓
    Organization = APPROVED
        ↓
    Client login allowed
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from api.deps import get_bearer_token, get_current_user
from db.database import get_db

from schemas.auth import (
    PasswordChange,
    Token,
    UserCreate,
    UserOut,
    ClientRegistration,
)

from models.user import User
from models.role import Role
from models.organization import Organization

from services.auth_service import (
    authenticate_user,
    change_password,
    create_access_token,
    create_user,
    decode_access_token,
    get_user_by_username,
    verify_password,
)

from services.audit_service import (
    log_event,
    EventType,
    EventAction,
    EventStatus,
)


router = APIRouter(
    prefix="/auth",
    tags=["auth"],
)


# ============================================================
# CLIENT SELF REGISTRATION
# ============================================================

@router.post(
    "/client-register",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
)
def client_register(
    payload: ClientRegistration,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Public client self-registration.

    Creates:
        1. Organization with PENDING status
        2. CLIENT_USER linked to that organization

    The organization MUST be approved by an administrator
    before the client can log in.
    """

    # --------------------------------------------------------
    # 1. PASSWORD VALIDATION
    # --------------------------------------------------------

    if payload.password != payload.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Passwords do not match",
        )

    # --------------------------------------------------------
    # 2. NORMALIZE INPUT
    # --------------------------------------------------------

    org_name = payload.org_name.strip()
    email = str(payload.org_email).lower().strip()
    contact_person = payload.contact_person.strip()

    if not org_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Organization name is required",
        )

    # --------------------------------------------------------
    # 3. CHECK ORGANIZATION
    # --------------------------------------------------------

    existing_org = (
        db.query(Organization)
        .filter(Organization.name == org_name)
        .first()
    )

    if existing_org:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An organization with this name already exists",
        )

    # --------------------------------------------------------
    # 4. CHECK EMAIL
    # --------------------------------------------------------

    existing_user = (
        db.query(User)
        .filter(User.email == email)
        .first()
    )

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This email is already registered",
        )

    # --------------------------------------------------------
    # 5. CREATE ORGANIZATION
    #
    # IMPORTANT:
    # New client organizations are PENDING.
    # They must NOT be automatically approved.
    # --------------------------------------------------------

    org = Organization(
        name=org_name,
        org_type=payload.org_type,
        registration_number=payload.registration_number,
        phone=payload.phone,
        email=email,
        contact_person=contact_person,

        # Correct workflow:
        status="PENDING",

        approved_at=None,
        approved_by_id=None,
    )

    db.add(org)
    db.flush()

    # --------------------------------------------------------
    # 6. GENERATE USERNAME
    # --------------------------------------------------------

    username = email.split("@")[0].strip()

    existing_username = get_user_by_username(
        db,
        username,
    )

    if existing_username:
        username = email

        existing_username = get_user_by_username(
            db,
            username,
        )

        if existing_username:
            db.rollback()

            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Username already taken. "
                    "Please use a different email."
                ),
            )

    # --------------------------------------------------------
    # 7. CREATE CLIENT USER
    # --------------------------------------------------------

    user = create_user(
        db=db,
        username=username,
        password=payload.password,
        email=email,
        phone=payload.phone,
        role=Role.CLIENT_USER,
        organization_id=org.id,
    )

    # --------------------------------------------------------
    # 8. AUDIT LOG
    # --------------------------------------------------------

    log_event(
        db=db,
        event_type=EventType.AUTH,
        event_action=EventAction.REGISTER,
        event_status=EventStatus.SUCCESS,
        user_id=user.id,
        username=user.username,
        request=request,
        details={
            "organization_id": org.id,
            "organization_name": org.name,
            "organization_status": org.status,
        },
    )

    return user


# ============================================================
# GENERIC USER REGISTRATION
# ============================================================

@router.post(
    "/register",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
)
def register(
    payload: UserCreate,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Generic public registration.

    Public registration is always CLIENT_USER.

    The organization created here is PENDING.
    """

    existing_user = get_user_by_username(
        db,
        payload.username,
    )

    if existing_user:
        log_event(
            db=db,
            event_type=EventType.AUTH,
            event_action=EventAction.REGISTER,
            event_status=EventStatus.FAILURE,
            username=payload.username,
            request=request,
            details={
                "reason": "username_exists",
            },
        )

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already exists",
        )

    # --------------------------------------------------------
    # EMAIL DUPLICATE CHECK
    # --------------------------------------------------------

    if payload.email:
        existing_email = (
            db.query(User)
            .filter(
                User.email == str(payload.email).lower().strip()
            )
            .first()
        )

        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered",
            )

    # --------------------------------------------------------
    # PUBLIC REGISTRATION CANNOT SELECT PRIVILEGED ROLE
    # --------------------------------------------------------

    payload.role = Role.CLIENT_USER

    # --------------------------------------------------------
    # CREATE PENDING ORGANIZATION
    # --------------------------------------------------------

    org = Organization(
        name=f"{payload.username}'s Organization",
        contact_person=payload.username,
        email=(
            str(payload.email).lower().strip()
            if payload.email
            else None
        ),
        phone=payload.phone,
        status="PENDING",
        approved_at=None,
        approved_by_id=None,
    )

    db.add(org)
    db.flush()

    # --------------------------------------------------------
    # CREATE CLIENT USER
    # --------------------------------------------------------

    user = create_user(
        db=db,
        username=payload.username,
        password=payload.password,
        email=payload.email,
        phone=payload.phone,
        role=Role.CLIENT_USER,
        organization_id=org.id,
    )

    # --------------------------------------------------------
    # AUDIT
    # --------------------------------------------------------

    log_event(
        db=db,
        event_type=EventType.AUTH,
        event_action=EventAction.REGISTER,
        event_status=EventStatus.SUCCESS,
        user_id=user.id,
        username=user.username,
        request=request,
        details={
            "organization_id": org.id,
            "organization_status": org.status,
        },
    )

    return user


# ============================================================
# LOGIN
# ============================================================

@router.post(
    "/login",
    response_model=Token,
)
def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """
    Authenticate user and return JWT access token.

    Important:
        A client belonging to a PENDING or REJECTED
        organization cannot log in.
    """

    # --------------------------------------------------------
    # AUTHENTICATE CREDENTIALS
    # --------------------------------------------------------

    user = authenticate_user(
        db,
        form_data.username,
        form_data.password,
    )

    if not user:
        log_event(
            db=db,
            event_type=EventType.AUTH,
            event_action=EventAction.LOGIN_FAILED,
            event_status=EventStatus.FAILURE,
            username=form_data.username,
            request=request,
            details={
                "reason": "invalid_credentials_or_account_state",
            },
        )

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
            headers={
                "WWW-Authenticate": "Bearer",
            },
        )

    # --------------------------------------------------------
    # ACTIVE ACCOUNT
    # --------------------------------------------------------

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated",
        )

    # --------------------------------------------------------
    # ORGANIZATION APPROVAL
    # --------------------------------------------------------

    if user.organization_id is not None:

        org = (
            db.query(Organization)
            .filter(
                Organization.id == user.organization_id
            )
            .first()
        )

        if not org:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User organization was not found",
            )

        # ----------------------------------------------------
        # PENDING
        # ----------------------------------------------------

        if org.status == "PENDING":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "Your organization is pending approval. "
                    "Please contact the administrator."
                ),
            )

        # ----------------------------------------------------
        # REJECTED
        # ----------------------------------------------------

        if org.status == "REJECTED":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "Your organization registration was rejected. "
                    "Please contact the administrator."
                ),
            )

        # ----------------------------------------------------
        # UNKNOWN STATUS
        # ----------------------------------------------------

        if org.status != "APPROVED":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your organization is not approved",
            )

    # --------------------------------------------------------
    # CREATE TOKEN
    # --------------------------------------------------------

    access_token = create_access_token(
        user=user,
    )

    # --------------------------------------------------------
    # AUDIT LOGIN
    # --------------------------------------------------------

    log_event(
        db=db,
        event_type=EventType.AUTH,
        event_action=EventAction.LOGIN,
        event_status=EventStatus.SUCCESS,
        user_id=user.id,
        username=user.username,
        request=request,
    )

    return Token(
        access_token=access_token,
        token_type="bearer",
    )


# ============================================================
# CURRENT USER
# ============================================================

@router.get(
    "/me",
    response_model=UserOut,
)
def me(
    current_user: User = Depends(get_current_user),
    request: Request = None,
    db: Session = Depends(get_db),
):
    """
    Return currently authenticated user.
    """

    log_event(
        db=db,
        event_type=EventType.PROFILE,
        event_action=EventAction.PROFILE_VIEW,
        event_status=EventStatus.SUCCESS,
        user_id=current_user.id,
        username=current_user.username,
        request=request,
    )

    return current_user


# ============================================================
# CHANGE PASSWORD
# ============================================================

@router.post(
    "/change-password",
    response_model=UserOut,
)
def change_user_password(
    payload: PasswordChange,
    current_user: User = Depends(get_current_user),
    request: Request = None,
    db: Session = Depends(get_db),
):
    """
    Change password for authenticated user.
    """

    # --------------------------------------------------------
    # VERIFY CURRENT PASSWORD
    # --------------------------------------------------------

    if not verify_password(
        payload.current_password,
        current_user.password,
    ):
        log_event(
            db=db,
            event_type=EventType.PROFILE,
            event_action=EventAction.PASSWORD_CHANGE_FAILED,
            event_status=EventStatus.FAILURE,
            user_id=current_user.id,
            username=current_user.username,
            request=request,
            details={
                "reason": "incorrect_current_password",
            },
        )

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    # --------------------------------------------------------
    # CHANGE PASSWORD
    # --------------------------------------------------------

    result = change_password(
        db,
        current_user,
        payload.new_password,
    )

    # --------------------------------------------------------
    # AUDIT
    # --------------------------------------------------------

    log_event(
        db=db,
        event_type=EventType.PROFILE,
        event_action=EventAction.PASSWORD_CHANGE,
        event_status=EventStatus.SUCCESS,
        user_id=current_user.id,
        username=current_user.username,
        request=request,
    )

    return result