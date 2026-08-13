"""
alert.py - Alert model for TraceAcc Pro.

IMPORTANT:
  Only ANALYST (TRACE_LAB_ANALYST) creates Alerts.
  Only ADMIN can route an escalated Alert to InvoSpace.
  InvoSpace then creates a Case from the Alert.

Alert != Case.

Statuses:
  NEW | UNDER_REVIEW | ESCALATED | CONVERTED_TO_CASE | DISMISSED | CLOSED
"""
from sqlalchemy import Column, Integer, String, Float, Text, JSON, ForeignKey, DateTime
from sqlalchemy.sql import func
from db.database import Base


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    service_request_id = Column(Integer, ForeignKey("service_requests.id"), nullable=True, index=True)
    analysis_job_id = Column(Integer, ForeignKey("analysis_jobs.id"), nullable=True, index=True)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=True, index=True)
    workflow_instance_id = Column(Integer, ForeignKey("workflow_instances.id"), nullable=True, index=True)

    # Alert classification
    # e.g.: CIRCULAR_TRANSACTION, FAN_IN, FAN_OUT, LAYERING, BURST_ACTIVITY,
    #        STRUCTURING, VELOCITY_ANOMALY, BEHAVIOUR_DEVIATION, ML_ANOMALY
    alert_type = Column(String(100), nullable=False)
    pattern_type = Column(String(100), nullable=True)  # more specific pattern name

    risk_score = Column(Float, default=0.0)
    severity = Column(String(20), default="MEDIUM")  # LOW | MEDIUM | HIGH | CRITICAL

    # NEW | UNDER_REVIEW | ESCALATED | CONVERTED_TO_CASE | DISMISSED | CLOSED
    status = Column(String(50), default="NEW", nullable=False, index=True)

    # Detection context
    trigger_reason = Column(Text, nullable=True)
    detection_reason = Column(JSON, nullable=True)   # detailed context from AML engines
    related_transactions = Column(JSON, nullable=True)
    related_entities = Column(JSON, nullable=True)
    related_accounts = Column(JSON, nullable=True)

    # Created by (must be ANALYST)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)

    # Assignment (set by Admin when routing to INVOSPACE)
    assignee_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)

    # Escalation tracking (ANALYST escalates → ADMIN; ADMIN routes → INVOSPACE)
    escalated_by_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    escalated_at = Column(DateTime(timezone=True), nullable=True)
    escalation_reason = Column(Text, nullable=True)
    escalation_priority = Column(String(20), nullable=True)  # LOW | MEDIUM | HIGH | CRITICAL

    # Admin routing (when Admin routes ESCALATED alert to InvoSpace)
    routed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    routed_at = Column(DateTime(timezone=True), nullable=True)
    routed_to_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)  # InvoSpace user

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
