"""
case.py — Investigation Case model for TraceAcc Pro.

Lifecycle States:
  SUBMITTED | OPEN | ASSIGNED | IN_PROGRESS | PENDING_REVIEW
  | RETURNED_FOR_REVISION | APPROVED | CLOSED | REOPENED | CANCELLED

Origins:
  CLIENT_UPLOAD | LIVESHIELD_SIMULATION | MANUAL_INTERNAL | ALERT_ESCALATION
"""
from sqlalchemy import Column, Integer, String, DateTime, Float, JSON, ForeignKey, Text, Boolean
from sqlalchemy.sql import func
from db.database import Base


class Case(Base):
    __tablename__ = "cases"

    id              = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    service_request_id = Column(Integer, ForeignKey("service_requests.id"), nullable=True, index=True)
    alert_id        = Column(Integer, ForeignKey("alerts.id"), nullable=True, index=True)
    simulation_id   = Column(Integer, ForeignKey("liveshield_simulations.id", ondelete="SET NULL"), nullable=True, index=True)

    # Origin and synthetic distinction
    case_origin     = Column(String(50), default="MANUAL_INTERNAL", nullable=False, index=True) # CLIENT_UPLOAD | LIVESHIELD_SIMULATION | MANUAL_INTERNAL | ALERT_ESCALATION
    is_synthetic    = Column(Boolean, default=False, nullable=False, index=True)

    # Creator
    created_by_id   = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    # Assigned investigator (InvoSpace / TraceLab user)
    assigned_investigator_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)

    # Legacy / workflow
    assignee_id     = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    workflow_instance_id = Column(Integer, ForeignKey("workflow_instances.id"), nullable=True, index=True)

    title         = Column(String(255), nullable=False)
    description   = Column(Text, nullable=True)

    # Workflow State Machine:
    # SUBMITTED | OPEN | ASSIGNED | IN_PROGRESS | PENDING_REVIEW
    # | RETURNED_FOR_REVISION | APPROVED | CLOSED | REOPENED | CANCELLED
    status        = Column(String(50), default="OPEN", nullable=False, index=True)

    # LOW | MEDIUM | HIGH | CRITICAL
    priority      = Column(String(20), default="MEDIUM", nullable=False)

    # Risk scores — keep both
    tracelab_risk_score  = Column(Float, nullable=True)   # original TraceLab risk — never overwrite
    investigation_risk_score = Column(Float, nullable=True)  # InvoSpace reassessment

    # Investigation decision
    # NO_SUSPICION | SUSPICIOUS_ACTIVITY | ESCALATE | INSUFFICIENT_INFORMATION | INCONCLUSIVE
    decision      = Column(String(50), nullable=True)
    decision_reason = Column(Text, nullable=True)
    decision_at   = Column(DateTime(timezone=True), nullable=True)

    # Admin closure review and independence
    closure_reviewed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    closure_reviewed_at   = Column(DateTime(timezone=True), nullable=True)
    closure_notes         = Column(Text, nullable=True)
    self_approval_exception = Column(Boolean, default=False, nullable=False)
    self_approval_reason   = Column(Text, nullable=True)

    # Related entities
    linked_accounts = Column(JSON, nullable=True)
    linked_entities = Column(JSON, nullable=True)
    linked_rings    = Column(JSON, nullable=True)

    # Linked analysis
    analysis_job_id = Column(Integer, ForeignKey("analysis_jobs.id"), nullable=True)

    notes           = Column(Text, nullable=True)
    due_date        = Column(DateTime(timezone=True), nullable=True)

    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(DateTime(timezone=True), onupdate=func.now())
    status_updated_at = Column(DateTime(timezone=True), server_default=func.now())
    closed_at       = Column(DateTime(timezone=True), nullable=True)
