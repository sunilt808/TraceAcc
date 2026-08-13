from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional

from core.permissions import require_any_permission, ROLE_ADMIN, ROLE_CLIENT
from db.database import get_db
from models.user import User
from models.message import Message
from api.deps import get_current_user

router = APIRouter(prefix="/messages", tags=["messages"])

class MessageCreate(BaseModel):
    recipient_id: int
    service_request_id: Optional[int] = None
    subject: Optional[str] = None
    body: str

@router.post("", status_code=201)
def create_message(
    body: MessageCreate,
    current_user: User = Depends(require_any_permission("message.create", "message.create_to_admin")),
    db: Session = Depends(get_db),
):
    recipient = db.query(User).filter(User.id == body.recipient_id, User.organization_id == current_user.organization_id).first()
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient not found.")
        
    # Enforce allowed communication
    if current_user.role == ROLE_CLIENT and recipient.role != ROLE_ADMIN:
        raise HTTPException(status_code=403, detail="Clients can only message Admins.")
        
    msg = Message(
        organization_id=current_user.organization_id,
        sender_id=current_user.id,
        recipient_id=recipient.id,
        service_request_id=body.service_request_id,
        subject=body.subject,
        body=body.body
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return {"id": msg.id, "message": "Message sent"}

@router.get("")
def list_messages(
    current_user: User = Depends(require_any_permission("message.view", "message.view_own")),
    db: Session = Depends(get_db),
):
    msgs = db.query(Message).filter(
        Message.organization_id == current_user.organization_id,
        (Message.sender_id == current_user.id) | (Message.recipient_id == current_user.id)
    ).order_by(Message.created_at.desc()).all()
    
    return [{"id": m.id, "subject": m.subject, "sender_id": m.sender_id, "recipient_id": m.recipient_id, "created_at": m.created_at.isoformat() if m.created_at else None} for m in msgs]
