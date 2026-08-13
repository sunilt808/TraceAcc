"""
investigation_report.py — Investigation Report created by INVOSPACE.

This is the INTERNAL report from InvoSpace submitted to Admin.
It is NEVER directly exposed to the client.

Client only sees the final ClientReport after Admin approval/sign/release.

Statuses: DRAFT | SUBMITTED | UNDER_REVIEW | REVISION_REQUIRED | APPROVED | REJECTED
"""
from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey, JSON, Boolean
from sqlalchemy.sql import func
from db.database import Base


class InvestigationReport(Base):
    __tablename__ = "investigation_reports"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=False, index=True)
    service_request_id = Column(Integer, ForeignKey("service_requests.id"), nullable=True, index=True)
    investigator_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    title = Column(String(255), nullable=False)

    # Case & investigation details
    case_summary = Column(JSON, nullable=True)
    alert_details = Column(JSON, nullable=True)
    entity_details = Column(JSON, nullable=True)
    investigation_scope = Column(Text, nullable=True)

    # Findings
    transaction_findings = Column(JSON, nullable=True)
    graph_findings = Column(JSON, nullable=True)
    behaviour_findings = Column(JSON, nullable=True)
    temporal_findings = Column(JSON, nullable=True)
    evidence_summary = Column(JSON, nullable=True)

    # Linked investigation artifacts (IDs)
    hypothesis_ids = Column(JSON, nullable=True)
    finding_ids = Column(JSON, nullable=True)
    evidence_ids = Column(JSON, nullable=True)

    # Risk assessment
    tracelab_risk_score = Column(Float, nullable=True)    # original — never overwritten
    investigation_risk_score = Column(Float, nullable=True)
    investigation_risk_level = Column(String(20), nullable=True)
    risk_factors = Column(JSON, nullable=True)

    # Decision
    # NO_SUSPICION | SUSPICIOUS_ACTIVITY | ESCALATE | INSUFFICIENT_INFORMATION | INCONCLUSIVE
    decision = Column(String(50), nullable=True, index=True)
    decision_reason = Column(Text, nullable=True)
    supporting_evidence_ids = Column(JSON, nullable=True)

    # Investigator conclusion
    conclusion = Column(Text, nullable=True)

    # DRAFT | SUBMITTED | UNDER_REVIEW | REVISION_REQUIRED | APPROVED | REJECTED
    status = Column(String(50), default="DRAFT", nullable=False, index=True)

    # Admin review
    reviewed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    admin_notes = Column(Text, nullable=True)

    # Version tracking
    version = Column(Integer, default=1, nullable=False)

    submitted_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
