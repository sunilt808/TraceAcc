from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from api.deps import get_bearer_token, get_current_user, RoleChecker
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


router = APIRouter(prefix="/auth", tags=["auth"])


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

    Admin approval is required before the client can log in.
    """

    # ========================================================
    # 1. VALIDATE PASSWORD
    # ========================================================

    if payload.password != payload.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Passwords do not match",
        )

    # ========================================================
    # 2. CHECK ORGANIZATION NAME
    # ========================================================

    existing_org = (
        db.query(Organization)
        .filter(Organization.name == payload.org_name)
        .first()
    )

    if existing_org:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An organization with this name already exists",
        )

    # ========================================================
    # 3. CHECK EMAIL
    #
    # New registration uses org_email as the user's email.
    # ========================================================

    email = str(payload.org_email).lower().strip()

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

    # ========================================================
    # 4. CREATE ORGANIZATION
    #
    # Only the reduced registration fields are collected.
    # The remaining organization information can be completed
    # later by Admin.
    # ========================================================

    org = Organization(
        name=payload.org_name,
        org_type=payload.org_type,
        registration_number=payload.registration_number,
        phone=payload.phone,
        email=email,
        contact_person=payload.contact_person,
        status="PENDING",
    )

    db.add(org)
    db.flush()

    # ========================================================
    # 5. GENERATE USERNAME
    #
    # Example:
    # compliance@abcfinancial.com
    #        ↓
    # compliance
    # ========================================================

    username = email.split("@")[0]

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
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Username already taken. "
                    "Please use a different email."
                ),
            )

    # ========================================================
    # 6. CREATE CLIENT USER
    # ========================================================

    user = create_user(
        db=db,
        username=username,
        password=payload.password,
        email=email,
        phone=payload.phone,
        role=Role.CLIENT_USER,
        organization_id=org.id,
    )

    # ========================================================
    # 7. AUDIT LOG
    # ========================================================

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
            "organization_name": payload.org_name,
        },
    )

    # ========================================================
    # 8. RETURN CREATED USER
    # ========================================================

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
    Generic registration endpoint.

    Public registration is forced to CLIENT_USER.
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

    # Force client role for public registration
    payload.role = Role.CLIENT_USER

    # ========================================================
    # CREATE PENDING ORGANIZATION
    # ========================================================

    org = Organization(
        name=f"{payload.username}'s Organization",
        contact_person=payload.username,
        status="PENDING",
    )

    db.add(org)
    db.flush()

    # ========================================================
    # CREATE USER
    # ========================================================

    user = create_user(
        db=db,
        username=payload.username,
        password=payload.password,
        email=payload.email,
        phone=payload.phone,
        role=payload.role,
        organization_id=org.id,
    )

    # ========================================================
    # AUDIT LOG
    # ========================================================

    log_event(
        db=db,
        event_type=EventType.AUTH,
        event_action=EventAction.REGISTER,
        event_status=EventStatus.SUCCESS,
        user_id=user.id,
        username=user.username,
        request=request,
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
    """

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
                "reason": "invalid_credentials",
            },
        )

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
            headers={
                "WWW-Authenticate": "Bearer",
            },
        )

    # ========================================================
    # CHECK ORGANIZATION APPROVAL
    #
    # Platform admins without organization_id can log in.
    # Client users require APPROVED organization.
    # ========================================================

    if user.organization_id:

        org = (
            db.query(Organization)
            .filter(
                Organization.id == user.organization_id
            )
            .first()
        )

        if org and org.status != "APPROVED":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "Your organization is pending approval. "
                    "Please contact the administrator."
                ),
            )

    # ========================================================
    # CREATE TOKEN
    # ========================================================

    access_token = create_access_token(
        user=user,
    )

    # ========================================================
    # AUDIT LOG
    # ========================================================

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
    )


# ============================================================
# CURRENT USER
# ============================================================

@router.get(
    "/me",
    response_model=UserOut,
)
def me(
    request: Request,
    token: str = Depends(get_bearer_token),
    db: Session = Depends(get_db),
):
    """
    Return the currently authenticated user.
    """

    payload = decode_access_token(token)

    username = (
        payload.get("sub")
        if payload
        else None
    )

    if not username:

        log_event(
            db=db,
            event_type=EventType.AUTH,
            event_action=EventAction.TOKEN_INVALID,
            event_status=EventStatus.FAILURE,
            request=request,
            details={
                "reason": "invalid_or_expired_token",
            },
        )

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={
                "WWW-Authenticate": "Bearer",
            },
        )

    # ========================================================
    # FIND USER
    # ========================================================

    user = get_user_by_username(
        db,
        username,
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # ========================================================
    # AUDIT LOG
    # ========================================================

    log_event(
        db=db,
        event_type=EventType.PROFILE,
        event_action=EventAction.PROFILE_VIEW,
        event_status=EventStatus.SUCCESS,
        user_id=user.id,
        username=user.username,
        request=request,
    )

    return user


# ============================================================
# CHANGE PASSWORD
# ============================================================

@router.post(
    "/change-password",
    response_model=UserOut,
)
def change_user_password(
    payload: PasswordChange,
    request: Request,
    token: str = Depends(get_bearer_token),
    db: Session = Depends(get_db),
):
    """
    Change password for authenticated user.
    """

    payload_dict = decode_access_token(token)

    username = (
        payload_dict.get("sub")
        if payload_dict
        else None
    )

    if not username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={
                "WWW-Authenticate": "Bearer",
            },
        )

    # ========================================================
    # FIND USER
    # ========================================================

    user = get_user_by_username(
        db,
        username,
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # ========================================================
    # VERIFY CURRENT PASSWORD
    # ========================================================

    if not verify_password(
        payload.current_password,
        user.password,
    ):

        log_event(
            db=db,
            event_type=EventType.PROFILE,
            event_action=EventAction.PASSWORD_CHANGE_FAILED,
            event_status=EventStatus.FAILURE,
            user_id=user.id,
            username=user.username,
            request=request,
            details={
                "reason": "incorrect_current_password",
            },
        )

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    # ========================================================
    # CHANGE PASSWORD
    # ========================================================

    result = change_password(
        db,
        user,
        payload.new_password,
    )

    # ========================================================
    # AUDIT LOG
    # ========================================================

    log_event(
        db=db,
        event_type=EventType.PROFILE,
        event_action=EventAction.PASSWORD_CHANGE,
        event_status=EventStatus.SUCCESS,
        user_id=user.id,
        username=user.username,
        request=request,
    )

    return result