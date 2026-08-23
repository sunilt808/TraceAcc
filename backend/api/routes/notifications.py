from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from core.permissions import require_any_permission
from db.database import get_db
from models.user import User
from models.notification import Notification

router = APIRouter(prefix="/notifications", tags=["notifications"])

@router.get("")
def list_notifications(
    current_user: User = Depends(require_any_permission("notification.view", "notification.manage", "alert.view_assigned", "case.view_assigned", "report.view_internal")),
    db: Session = Depends(get_db),
):
    # Every user can see their own notifications, the permission check above is just a catch-all.
    # In reality, any logged-in user can view their own notifications.
    notifs = db.query(Notification).filter(
        Notification.recipient_id == current_user.id
    ).order_by(Notification.created_at.desc()).all()
    
    return [{"id": n.id, "title": n.title, "message": n.message, "is_read": n.is_read, "created_at": n.created_at.isoformat() if n.created_at else None} for n in notifs]

@router.post("/read-all")
def mark_all_read(
    current_user: User = Depends(require_any_permission("notification.view", "notification.manage", "alert.view_assigned", "case.view_assigned", "report.view_internal")),
    db: Session = Depends(get_db),
):
    """Mark every notification of the current user as read."""
    now = datetime.now(timezone.utc)
    count = (
        db.query(Notification)
        .filter(
            Notification.recipient_id == current_user.id,
            Notification.is_read.is_(False),
        )
        .update({"is_read": True, "read_at": now}, synchronize_session=False)
    )
    db.commit()
    return {"updated": count}


@router.post("/read-all")
def mark_all_read(
    current_user: User = Depends(require_any_permission("notification.view", "notification.manage", "alert.view_assigned", "case.view_assigned", "report.view_internal")),
    db: Session = Depends(get_db),
):
    """Mark every notification of the current user as read."""
    now = datetime.now(timezone.utc)
    count = (
        db.query(Notification)
        .filter(
            Notification.recipient_id == current_user.id,
            Notification.is_read.is_(False),
        )
        .update({"is_read": True, "read_at": now}, synchronize_session=False)
    )
    db.commit()
    return {"updated": count}


@router.patch("/{notif_id}/read")
def mark_read(
    notif_id: int,
    current_user: User = Depends(require_any_permission("notification.view", "notification.manage", "alert.view_assigned", "case.view_assigned", "report.view_internal")),
    db: Session = Depends(get_db),
):
    notif = db.query(Notification).filter(
        Notification.id == notif_id,
        Notification.recipient_id == current_user.id
    ).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found.")
        
    notif.is_read = True
    notif.read_at = datetime.now(timezone.utc)
    db.commit()
    return {"id": notif.id, "is_read": True}
