"""
alert.py - Alert model for detected suspicious activities.
"""
from sqlalchemy import Column, Integer, String, Float, JSON, ForeignKey, DateTime
from sqlalchemy.sql import func
from db.database import Base

class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    analysis_job_id = Column(Integer, ForeignKey("analysis_jobs.id"), nullable=True, index=True)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=True, index=True)
    
    alert_type = Column(String(100), nullable=False) # e.g., 'BURST_ACTIVITY', 'RAPID_MOVER'
    risk_score = Column(Float, default=0.0)
    severity = Column(String(20), default="MEDIUM") # LOW, MEDIUM, HIGH, CRITICAL
    status = Column(String(50), default="NEW") # NEW, TRIAGED, FALSE_POSITIVE, ESCALATED
    
    detection_reason = Column(JSON, nullable=True) # Context from AML engines
    related_accounts = Column(JSON, nullable=True) # Account IDs flagged in this alert
    assignee_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
