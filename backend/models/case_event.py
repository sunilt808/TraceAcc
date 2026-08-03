"""
case_event.py - Model for tracking case timeline events.
"""
from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime
from sqlalchemy.sql import func
from db.database import Base

class CaseEvent(Base):
    __tablename__ = "case_events"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    event_type = Column(String(50), nullable=False) # STATUS_CHANGE, COMMENT, EVIDENCE_UPLOAD, ASSIGNMENT, SYSTEM_ACTION
    content = Column(Text, nullable=True) # Could be a comment or a JSON string of details
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
