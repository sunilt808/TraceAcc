from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from api.deps import get_bearer_token
from db.database import get_db
from schemas.auth import PasswordChange, Token, UserCreate, UserOut
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


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, request: Request, db: Session = Depends(get_db)):
    existing_user = get_user_by_username(db, payload.username)
    if existing_user:
        log_event(
            db=db,
            event_type=EventType.AUTH,
            event_action=EventAction.REGISTER,
            event_status=EventStatus.FAILURE,
            username=payload.username,
            request=request,
            details={"reason": "username_exists"},
        )
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already exists")
    
    user = create_user(db, payload.username, payload.password)
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


@router.post("/login", response_model=Token)
def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        log_event(
            db=db,
            event_type=EventType.AUTH,
            event_action=EventAction.LOGIN_FAILED,
            event_status=EventStatus.FAILURE,
            username=form_data.username,
            request=request,
            details={"reason": "invalid_credentials"},
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(subject=user.username)
    log_event(
        db=db,
        event_type=EventType.AUTH,
        event_action=EventAction.LOGIN,
        event_status=EventStatus.SUCCESS,
        user_id=user.id,
        username=user.username,
        request=request,
    )
    return Token(access_token=access_token)


@router.get("/me", response_model=UserOut)
def me(request: Request, token: str = Depends(get_bearer_token), db: Session = Depends(get_db)):
    username = decode_access_token(token)
    if not username:
        log_event(
            db=db,
            event_type=EventType.AUTH,
            event_action=EventAction.TOKEN_INVALID,
            event_status=EventStatus.FAILURE,
            request=request,
            details={"reason": "invalid_or_expired_token"},
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = get_user_by_username(db, username)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

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


@router.post("/change-password", response_model=UserOut)
def change_user_password(
    payload: PasswordChange,
    request: Request,
    token: str = Depends(get_bearer_token),
    db: Session = Depends(get_db),
):
    username = decode_access_token(token)
    if not username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = get_user_by_username(db, username)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if not verify_password(payload.current_password, user.password):
        log_event(
            db=db,
            event_type=EventType.PROFILE,
            event_action=EventAction.PASSWORD_CHANGE_FAILED,
            event_status=EventStatus.FAILURE,
            user_id=user.id,
            username=user.username,
            request=request,
            details={"reason": "incorrect_current_password"},
        )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")

    result = change_password(db, user, payload.new_password)
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
