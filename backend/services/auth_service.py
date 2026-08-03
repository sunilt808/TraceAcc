from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from config.settings import settings
from models.user import User
from models.role import Role

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_user_by_username(db: Session, username: str) -> Optional[User]:
    return db.query(User).filter(User.username == username).first()


def create_user(
    db: Session, 
    username: str, 
    password: str, 
    email: Optional[str] = None, 
    role: Role = Role.CLIENT_USER, 
    organization_id: Optional[int] = None
) -> User:
    user = User(
        username=username, 
        password=get_password_hash(password),
        email=email,
        role=role.value,
        organization_id=organization_id
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, username: str, password: str) -> Optional[User]:
    user = get_user_by_username(db, username)
    if not user:
        return None
        
    if not user.is_active:
        return None
        
    now = datetime.now(timezone.utc)
    if user.locked_until:
        locked_until = user.locked_until
        if locked_until.tzinfo is None:
            locked_until = locked_until.replace(tzinfo=timezone.utc)
        if locked_until > now:
            return None
        
    if not verify_password(password, user.password):
        user.failed_login_count += 1
        if user.failed_login_count >= 5:
            user.locked_until = now + timedelta(minutes=15)
        db.commit()
        return None
        
    # Success, reset counters
    user.failed_login_count = 0
    user.locked_until = None
    user.last_login = now
    db.commit()
    return user


def create_access_token(user: User, expires_delta: Optional[timedelta] = None) -> str:
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    )
    to_encode = {
        "sub": user.username, 
        "exp": expire,
        "role": user.role,
        "org_id": user.organization_id
    }
    return jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        return payload
    except JWTError:
        return None


def change_password(db: Session, user: User, new_password: str) -> User:
    user.password = get_password_hash(new_password)
    db.commit()
    db.refresh(user)
    return user
