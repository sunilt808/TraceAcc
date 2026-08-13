"""
technical_report.py — Technical Analysis Report created by ANALYST.

This is the INTERNAL report submitted by TraceLab to Admin.
It is NEVER directly exposed to the client.

Client only sees the final ClientReport after Admin approval/release.

Statuses: DRAFT | SUBMITTED | UNDER_REVIEW | REVISION_REQUIRED | APPROVED | REJECTED
"""
from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey, JSON, Boolean
from sqlalchemy.sql import func
from db.database import Base


class TechnicalReport(Base):
    __tablename__ = "technical_reports"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    service_request_id = Column(Integer, ForeignKey("service_requests.id"), nullable=False, index=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id"), nullable=True, index=True)
    analysis_job_id = Column(Integer, ForeignKey("analysis_jobs.id"), nullable=True, index=True)
    analyst_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    title = Column(String(255), nullable=False)
    
    # Analysis summary
    dataset_summary = Column(JSON, nullable=True)
    transaction_analysis = Column(JSON, nullable=True)
    pattern_findings = Column(JSON, nullable=True)
    graph_findings = Column(JSON, nullable=True)
    behaviour_findings = Column(JSON, nullable=True)
    temporal_findings = Column(JSON, nullable=True)
    ml_findings = Column(JSON, nullable=True)

    # Overall risk
    risk_score = Column(Float, nullable=True)
    risk_level = Column(String(20), nullable=True)  # LOW | MEDIUM | HIGH | CRITICAL
    risk_factors = Column(JSON, nullable=True)

    # Alerts generated during analysis
    alert_ids = Column(JSON, nullable=True)  # list of Alert.id

    # Analyst recommendation
    escalation_recommended = Column(Boolean, default=False, nullable=False)
    escalation_reason = Column(Text, nullable=True)
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
