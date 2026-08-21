"""
auth_service.py — Authentication and JWT services.

Responsibilities:
    - Password hashing and verification
    - User lookup by username or email
    - User creation
    - Authentication
    - Login tracking
    - JWT creation and decoding
    - Password changes
"""

from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import or_
from sqlalchemy.orm import Session

from config.settings import settings
from models.user import User
from models.role import Role


# ============================================================
# PASSWORD CONTEXT
# ============================================================

pwd_context = CryptContext(
    schemes=["pbkdf2_sha256"],
    deprecated="auto",
)


# ============================================================
# PASSWORD
# ============================================================

def get_password_hash(password: str) -> str:
    """Generate a secure PBKDF2-SHA256 password hash."""
    return pwd_context.hash(password)


def verify_password(
    plain_password: str,
    hashed_password: str,
) -> bool:
    """Verify a plaintext password against its stored hash."""
    return pwd_context.verify(
        plain_password,
        hashed_password,
    )


# ============================================================
# USER LOOKUP
# ============================================================

def get_user_by_username(
    db: Session,
    username: str,
) -> Optional[User]:
    """
    Find a user using either:
        - username
        - email

    This allows the login form to accept either value.
    """

    login_value = username.strip()

    if not login_value:
        return None

    return (
        db.query(User)
        .filter(
            or_(
                User.username == login_value,
                User.email == login_value.lower(),
            )
        )
        .first()
    )


# ============================================================
# CREATE USER
# ============================================================

def create_user(
    db: Session,
    username: str,
    password: str,
    email: Optional[str] = None,
    phone: Optional[str] = None,
    role: Role = Role.CLIENT_USER,
    organization_id: Optional[int] = None,
) -> User:
    """
    Create a new user.

    Password is always stored as a PBKDF2-SHA256 hash.
    """

    clean_username = username.strip()

    clean_email = (
        str(email).lower().strip()
        if email
        else None
    )

    user = User(
        username=clean_username,
        password=get_password_hash(password),
        email=clean_email,
        phone=phone,
        role=role.value,
        organization_id=organization_id,
        is_active=True,
        failed_login_count=0,
        locked_until=None,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return user


# ============================================================
# AUTHENTICATE USER
# ============================================================

def authenticate_user(
    db: Session,
    username: str,
    password: str,
) -> Optional[User]:
    """
    Authenticate a user using username OR email.

    Returns:
        User object on success
        None on failure
    """

    # --------------------------------------------------------
    # NORMALIZE LOGIN INPUT
    # --------------------------------------------------------

    login_value = username.strip()

    if not login_value or not password:
        return None

    # --------------------------------------------------------
    # FIND USER
    # --------------------------------------------------------

    user = get_user_by_username(
        db,
        login_value,
    )

    if not user:
        return None

    # --------------------------------------------------------
    # ACTIVE CHECK
    # --------------------------------------------------------

    if not user.is_active:
        return None

    # --------------------------------------------------------
    # ACCOUNT LOCK CHECK
    # --------------------------------------------------------

    now = datetime.now(timezone.utc)

    if user.locked_until:

        locked_until = user.locked_until

        # Handle databases that return naive datetime
        if locked_until.tzinfo is None:
            locked_until = locked_until.replace(
                tzinfo=timezone.utc
            )

        if locked_until > now:
            return None

    # --------------------------------------------------------
    # PASSWORD CHECK
    # --------------------------------------------------------

    try:
        password_valid = verify_password(
            password,
            user.password,
        )

    except Exception:
        return None

    # --------------------------------------------------------
    # INVALID PASSWORD
    # --------------------------------------------------------

    if not password_valid:

        user.failed_login_count = (
            user.failed_login_count + 1
        )

        # Lock account after 5 failed attempts
        if user.failed_login_count >= 5:
            user.locked_until = (
                now + timedelta(minutes=15)
            )

        db.commit()

        return None

    # --------------------------------------------------------
    # SUCCESS
    # --------------------------------------------------------

    return user


# ============================================================
# RECORD SUCCESSFUL LOGIN
# ============================================================

def mark_login_success(
    db: Session,
    user: User,
) -> User:
    """
    Reset failed-login state and record successful login.
    """

    now = datetime.now(timezone.utc)

    user.failed_login_count = 0
    user.locked_until = None
    user.last_login = now

    db.commit()
    db.refresh(user)

    return user


# ============================================================
# JWT
# ============================================================

def create_access_token(
    user: User,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Create JWT access token for authenticated user."""

    expire = datetime.now(timezone.utc) + (
        expires_delta
        or timedelta(
            minutes=settings.access_token_expire_minutes
        )
    )

    to_encode = {
        "sub": user.username,
        "exp": expire,
        "role": user.role,
        "org_id": user.organization_id,
    }

    return jwt.encode(
        to_encode,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )


# ============================================================
# DECODE JWT
# ============================================================

def decode_access_token(
    token: str,
) -> Optional[dict]:
    """Decode and validate JWT access token."""

    try:

        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[
                settings.jwt_algorithm
            ],
        )

        return payload

    except JWTError:
        return None


# ============================================================
# CHANGE PASSWORD
# ============================================================

def change_password(
    db: Session,
    user: User,
    new_password: str,
) -> User:
    """Change the authenticated user's password."""

    user.password = get_password_hash(
        new_password
    )

    # Reset login lock state after password change
    user.failed_login_count = 0
    user.locked_until = None

    db.commit()
    db.refresh(user)

    return user