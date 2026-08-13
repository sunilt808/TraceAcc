"""
notification.py — Notification model for TraceAcc Pro.

Notifications are generated automatically by the system when
workflow events occur. Each role receives relevant notifications.

Examples:
  CLIENT:    report released, information requested
  ADMIN:     new request, analyst report submitted, alert escalated
  ANALYST:   request assigned, revision requested
  INVOSPACE: case assigned, alert assigned, revision requested
"""
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from db.database import Base


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    recipient_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    # Notification type for grouping/icons
    notification_type = Column(String(100), nullable=False, index=True)
    # e.g.: REQUEST_SUBMITTED, REQUEST_ASSIGNED, REPORT_RELEASED, ALERT_ESCALATED,
    #       CASE_ASSIGNED, REVISION_REQUESTED, INFORMATION_REQUESTED

    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=True)

    # Optional link to related resource
    resource_type = Column(String(50), nullable=True)  # SERVICE_REQUEST, CASE, REPORT, ALERT
    resource_id = Column(Integer, nullable=True)

    is_read = Column(Boolean, default=False, nullable=False, index=True)
    read_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
