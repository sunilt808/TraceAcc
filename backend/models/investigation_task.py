"""
investigation_task.py — Checklist tasks for InvoSpace investigation.

Tracks investigative steps to ensure nothing is missed.
Statuses: PENDING | IN_PROGRESS | COMPLETED | SKIPPED
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.sql import func
from db.database import Base


class InvestigationTask(Base):
    __tablename__ = "investigation_tasks"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=False, index=True)
    assigned_to_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    
    # PENDING | IN_PROGRESS | COMPLETED | SKIPPED
    status = Column(String(50), default="PENDING", nullable=False, index=True)

    # Task category
    # REVIEW_TRANSACTIONS | REVIEW_COUNTERPARTIES | REVIEW_GRAPH | REVIEW_BEHAVIOUR
    # REVIEW_TEMPORAL | REVIEW_EVIDENCE | REVIEW_ALERTS | RISK_ASSESSMENT
    # PREPARE_CONCLUSION | PREPARE_REPORT | CUSTOM
    task_type = Column(String(50), default="CUSTOM", nullable=False)
    
    is_mandatory = Column(Boolean, default=False, nullable=False)
    due_date = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
