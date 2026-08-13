"""
case.py — Investigation Case model for TraceAcc Pro.

IMPORTANT:
  Only INVOSPACE (INVESTIGATOR) can create Cases.
  Analyst cannot create Cases.
  Cases are created from:
    1. Admin assigns serious request directly to InvoSpace
    2. Admin routes an escalated Alert to InvoSpace

States: OPEN | ASSIGNED | INVESTIGATING | EVIDENCE_REVIEW | PENDING_REVIEW
        | REVISION_REQUIRED | RESOLVED | CLOSED
"""
from sqlalchemy import Column, Integer, String, DateTime, Float, JSON, ForeignKey, Text
from sqlalchemy.sql import func
from db.database import Base


class Case(Base):
    __tablename__ = "cases"

    id              = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    service_request_id = Column(Integer, ForeignKey("service_requests.id"), nullable=True, index=True)
    alert_id        = Column(Integer, ForeignKey("alerts.id"), nullable=True, index=True)

    # Creator must be INVESTIGATOR (enforced at API layer)
    created_by_id   = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    # Assigned investigator (InvoSpace user)
    assigned_investigator_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)

    # Legacy / workflow
    assignee_id     = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    workflow_instance_id = Column(Integer, ForeignKey("workflow_instances.id"), nullable=True, index=True)

    title         = Column(String(255), nullable=False)
    description   = Column(Text, nullable=True)

    # OPEN | ASSIGNED | INVESTIGATING | EVIDENCE_REVIEW | PENDING_REVIEW
    # REVISION_REQUIRED | RESOLVED | CLOSED
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
