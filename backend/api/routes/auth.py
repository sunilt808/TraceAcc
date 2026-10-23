"""
auth.py — Authentication API for TraceAcc Pro.

Endpoints:
    POST /auth/login            OAuth2 password form login (username OR email)
    POST /auth/register         Bootstrap registration (first user becomes ADMIN)
    POST /auth/client-register  Public client self-registration (org + CLIENT_USER)
    GET  /auth/me               Current user profile (+ org context)
    POST /auth/change-password  Change own password
    POST /auth/logout           Audit-logged sign out (client discards token)

Security:
    - PBKDF2-SHA256 hashing via auth_service
    - Account lockout after 5 failed attempts (15 min) with remaining-time feedback
    - JWT HS256 bearer tokens
    - Every login/logout/password event is written to the audit log
"""
from datetime import datetime, timezone

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Request,
    status,
)
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from api.deps import get_current_user
from db.database import get_db
from models.user import User
from models.role import Role
from models.organization import Organization
from schemas.auth import (
    ClientRegistration,
    PasswordChange,
    Token,
    UserOut,
)
from services.auth_service import (
    authenticate_user,
    change_password as svc_change_password,
    create_access_token,
    create_user,
    get_password_hash,
    get_user_by_username,
    mark_login_success,
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
# HELPERS
# ============================================================

def _user_out(user: User) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "phone": user.phone,
        "role": user.role,
        "organization_id": user.organization_id,
        "is_active": user.is_active,
        "last_login": user.last_login.isoformat() if user.last_login else None,
    }


def _lockout_remaining_minutes(user: User) -> int | None:
    """Return whole minutes left on an active lockout, or None."""
    if not user.locked_until:
        return None
    locked_until = user.locked_until
    if locked_until.tzinfo is None:
        locked_until = locked_until.replace(tzinfo=timezone.utc)
    remaining = (locked_until - datetime.now(timezone.utc)).total_seconds()
    if remaining <= 0:
        return None
    return int(remaining // 60) + 1


def _validate_password_strength(password: str) -> None:
    """
    Minimum enterprise policy:
      >= 8 chars, at least one letter and one digit.
    """
    if len(password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters long.",
        )
    if not any(c.isalpha() for c in password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must contain at least one letter.",
        )
    if not any(c.isdigit() for c in password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must contain at least one digit.",
        )


# ============================================================
# LOGIN
# ============================================================

@router.post("/login", response_model=Token)
def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """
    Authenticate with username OR email.

    Returns a JWT access token plus the authenticated profile.
    Failed attempts feed the account lockout counter.
    """
    username = form_data.username.strip()
    password = form_data.password

    # ---- Unknown user -------------------------------------
    user = get_user_by_username(db, username)

    if not user:
        log_event(
            db=db,
            event_type=EventType.AUTH,
            event_action=EventAction.LOGIN_FAILED,
            event_status=EventStatus.ERROR,
            username=username,
            request=request,
            details={"reason": "unknown_user"},
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # ---- Locked account ------------------------------------
    remaining = _lockout_remaining_minutes(user)
    if remaining is not None:
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail=(
                f"Account temporarily locked due to repeated failed "
                f"logins. Try again in ~{remaining} minute(s)."
            ),
        )

    # ---- Inactive account ----------------------------------
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been deactivated. Contact your administrator.",
        )

    # ---- Bad password --------------------------------------
    if not verify_password(password, user.password):
        user.failed_login_count = (user.failed_login_count or 0) + 1
        just_locked = False
        if user.failed_login_count >= 5:
            user.locked_until = datetime.now(timezone.utc).replace(
                microsecond=0
            ) + __import__("datetime").timedelta(minutes=15)
            just_locked = True

        db.commit()

        log_event(
            db=db,
            event_type=EventType.AUTH,
            event_action=EventAction.LOGIN_FAILED,
            event_status=EventStatus.ERROR,
            user_id=user.id,
            username=user.username,
            request=request,
            details={
                "failed_count": user.failed_login_count,
                "just_locked": just_locked,
            },
        )

        if just_locked:
            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail=(
                    "Too many failed attempts. Account locked for 15 minutes."
                ),
            )

        attempts_left = max(0, 5 - user.failed_login_count)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=(
                f"Incorrect username or password. "
                f"{attempts_left} attempt(s) remaining before lockout."
            ),
            headers={"WWW-Authenticate": "Bearer"},
        )

    # ---- Success -------------------------------------------
    mark_login_success(db, user)
    token = create_access_token(user)

    log_event(
        db=db,
        event_type=EventType.AUTH,
        event_action=EventAction.LOGIN,
        event_status=EventStatus.SUCCESS,
        user_id=user.id,
        username=user.username,
        request=request,
        details={"role": user.role},
    )

    return Token(access_token=token)


# ============================================================
# REGISTER (bootstrap / internal provisioning fallback)
# ============================================================

@router.post("/register", response_model=UserOut, status_code=201)
def register(
    body: dict,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Open bootstrap registration.

    Behaviour:
      - If NO users exist yet, the first registrant becomes
        ADMIN (the top-level platform role).
      - Once any user exists, open registration is disabled — all further
        accounts are provisioned by an Admin via /admin/users.
    """
    username = str(body.get("username", "")).strip()
    password = str(body.get("password", ""))
    email = body.get("email")

    if len(username) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters.")
    _validate_password_strength(password)

    any_user = db.query(User).first()
    caller = None
    auth_hdr = request.headers.get("Authorization")
    if auth_hdr and auth_hdr.startswith("Bearer "):
        token = auth_hdr.split(" ")[1]
        try:
            from services.auth_service import decode_access_token
            payload = decode_access_token(token)
            caller = get_user_by_username(db, payload.get("sub"))
        except Exception:
            caller = None

    is_authorized_admin = caller and caller.role in ("ADMIN", "SUPER_ADMIN")
    if any_user is not None and not is_authorized_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Open registration is closed. Accounts are provisioned by an "
                "administrator, or clients may self-register via /auth/client-register."
            ),
        )

    if get_user_by_username(db, username):
        raise HTTPException(status_code=409, detail="Username already registered.")

    target_role = body.get("role", Role.ADMIN.value if any_user is None else Role.CLIENT_USER.value)
    if isinstance(target_role, Role):
        target_role = target_role.value

    user = create_user(
        db=db,
        username=username,
        password=password,
        email=email,
        role=target_role,
        organization_id=body.get("organization_id"),
    )

    log_event(
        db=db,
        event_type=EventType.AUTH,
        event_action=EventAction.REGISTER,
        event_status=EventStatus.SUCCESS,
        user_id=user.id,
        username=user.username,
        request=request,
        details={"bootstrap": True, "role": user.role},
    )

    return _user_out(user)


# ============================================================
# CLIENT SELF-REGISTRATION
# ============================================================

@router.post("/client-register", status_code=201)
def client_register(
    body: ClientRegistration,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Public client self-registration.

    Creates:
      1. A PENDING Organization (awaiting Admin approval)
      2. A CLIENT_USER account bound to that organization

    The account can log in immediately but the organization must be
    approved by an Admin before operational data flows.
    """
    if body.password != body.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match.")

    _validate_password_strength(body.password)

    # Login identity = organization email
    login_email = str(body.org_email).lower().strip()

    if get_user_by_username(db, login_email):
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists.",
        )

    existing_org = (
        db.query(Organization)
        .filter(Organization.name == body.org_name.strip())
        .first()
    )
    if existing_org:
        raise HTTPException(
            status_code=409,
            detail="An organization with this name already exists.",
        )

    org = Organization(
        name=body.org_name.strip(),
        org_type=body.org_type,
        registration_number=body.registration_number,
        email=login_email,
        phone=body.phone,
        contact_person=body.contact_person,
        status="PENDING",
    )
    db.add(org)
    db.flush()

    user = create_user(
        db=db,
        username=login_email,
        password=body.password,
        email=login_email,
        phone=body.phone,
        role=Role.CLIENT_USER,
        organization_id=org.id,
    )

    db.commit()
    db.refresh(org)

    log_event(
        db=db,
        event_type=EventType.AUTH,
        event_action=EventAction.REGISTER,
        event_status=EventStatus.SUCCESS,
        user_id=user.id,
        username=user.username,
        request=request,
        details={"organization_id": org.id, "pending_approval": True},
    )

    return {
        "message": (
            "Registration successful. Your organization is pending admin approval."
        ),
        "organization_id": org.id,
        "organization_status": org.status,
        "username": user.username,
    }


# ============================================================
# ME
# ============================================================

@router.get("/me")
def me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Current authenticated profile including organization context."""
    org = None
    if current_user.organization_id:
        org_row = (
            db.query(Organization)
            .filter(Organization.id == current_user.organization_id)
            .first()
        )
        if org_row:
            org = {
                "id": org_row.id,
                "name": org_row.name,
                "status": org_row.status,
            }

    return {**_user_out(current_user), "organization": org}


# ============================================================
# CHANGE PASSWORD
# ============================================================

@router.post("/change-password")
def change_password(
    body: PasswordChange,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Change own password after verifying the current one."""
    if not verify_password(body.current_password, current_user.password):
        log_event(
            db=db,
            event_type=EventType.AUTH,
            event_action=EventAction.PASSWORD_CHANGE_FAILED,
            event_status=EventStatus.ERROR,
            user_id=current_user.id,
            username=current_user.username,
            request=request,
            details={"reason": "wrong_current_password"},
        )
        raise HTTPException(status_code=400, detail="Current password is incorrect.")

    _validate_password_strength(body.new_password)

    svc_change_password(db, current_user, body.new_password)

    log_event(
        db=db,
        event_type=EventType.AUTH,
        event_action=EventAction.PASSWORD_CHANGE,
        event_status=EventStatus.SUCCESS,
        user_id=current_user.id,
        username=current_user.username,
        request=request,
    )

    return {"message": "Password changed successfully."}


# ============================================================
# LOGOUT
# ============================================================

@router.post("/logout")
def logout(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Sign out. Tokens are stateless, so the client discards it;
    the server records the audit event.
    """
    log_event(
        db=db,
        event_type=EventType.AUTH,
        event_action=EventAction.LOGOUT,
        event_status=EventStatus.SUCCESS,
        user_id=current_user.id,
        username=current_user.username,
        request=request,
    )
    return {"message": "Logged out successfully."}
