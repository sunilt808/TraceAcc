"""
case.py — Investigation Case model.

An analyst can create a case to track a suspicious account or ring
for further investigation. Cases can be assigned, commented on,
and closed.
"""
from sqlalchemy import Column, Integer, String, DateTime, JSON, ForeignKey, Text
from sqlalchemy.sql import func
from db.database import Base


class Case(Base):
    __tablename__ = "cases"

    id              = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    created_by_id   = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    assignee_id     = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    workflow_instance_id = Column(Integer, ForeignKey("workflow_instances.id"), nullable=True, index=True)
    title         = Column(String(255), nullable=False)
    description   = Column(Text, nullable=True)
    # OPEN | INVESTIGATING | REVIEW | CLOSED | ESCALATED
    status        = Column(String(50), default="OPEN", index=True)
    # LOW | MEDIUM | HIGH | CRITICAL
    priority      = Column(String(20), default="MEDIUM")
    # Final decision: NO_ACTION | SAR_FILED | REFERRED_TO_LAW_ENFORCEMENT | MONITORING
    decision      = Column(String(50), nullable=True)
    # Linked account IDs or ring IDs (stored as JSON list)
    linked_accounts = Column(JSON, nullable=True)
    linked_rings    = Column(JSON, nullable=True)
    # Analysis job that triggered this case
    analysis_job_id = Column(Integer, ForeignKey("analysis_jobs.id"), nullable=True)
    notes           = Column(Text, nullable=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(DateTime(timezone=True), onupdate=func.now())
    status_updated_at = Column(DateTime(timezone=True), server_default=func.now())
    closed_at       = Column(DateTime(timezone=True), nullable=True)
