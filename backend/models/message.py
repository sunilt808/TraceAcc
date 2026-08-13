"""
message.py — Client ↔ Admin messaging system.

ALLOWED:
  CLIENT → ADMIN
  ADMIN → CLIENT

FORBIDDEN (enforced at API layer):
  CLIENT ↔ ANALYST
  CLIENT ↔ INVOSPACE

Messages are linked to a ServiceRequest for context.
"""
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from db.database import Base


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    service_request_id = Column(Integer, ForeignKey("service_requests.id"), nullable=True, index=True)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=True, index=True)

    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    recipient_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    # Message type
    # INFORMATION_REQUEST | INFORMATION_RESPONSE | STATUS_UPDATE | GENERAL
    message_type = Column(String(50), default="GENERAL", nullable=False)

    subject = Column(String(255), nullable=True)
    body = Column(Text, nullable=False)

    is_read = Column(Boolean, default=False, nullable=False, index=True)
    read_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
