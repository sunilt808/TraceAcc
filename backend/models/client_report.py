"""
client_report.py - Final report delivered to clients by Admin.

This is the ONLY report the client ever sees.
It is assembled by Admin from TechnicalReport or InvestigationReport content.

Statuses: DRAFT | READY_FOR_REVIEW | UNDER_REVIEW | CHANGES_REQUESTED | APPROVED | SIGNED | RELEASED | REJECTED

Client can ONLY access RELEASED reports.

The digital seal represents Admin's application-level approval.
"""
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from db.database import Base


class ClientReport(Base):
    __tablename__ = "client_reports"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=True, index=True)
    service_request_id = Column(Integer, ForeignKey("service_requests.id"), nullable=True, index=True)
    workflow_instance_id = Column(Integer, ForeignKey("workflow_instances.id"), nullable=True, index=True)

    # Source reports (internal — not exposed to client)
    technical_report_id = Column(Integer, ForeignKey("technical_reports.id"), nullable=True, index=True)
    investigation_report_id = Column(Integer, ForeignKey("investigation_reports.id"), nullable=True, index=True)

    title = Column(String(255), nullable=False)
    summary = Column(Text, nullable=True)

    # ANALYSIS | INVESTIGATION | COMPLIANCE
    report_type = Column(String(50), default="ANALYSIS", nullable=False)

    # DRAFT | READY_FOR_REVIEW | UNDER_REVIEW | CHANGES_REQUESTED | APPROVED | SIGNED | RELEASED | REJECTED
    status = Column(String(50), default="DRAFT", nullable=False, index=True)

    file_path = Column(String(500), nullable=True)
    generated_by_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    # Admin review
    reviewed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)

    # Digital signature / seal (Admin approval)
    signed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    signed_at = Column(DateTime(timezone=True), nullable=True)
    seal_id = Column(String(100), nullable=True)          # unique seal identifier
    signature_hash = Column(String(255), nullable=True)   # application-level hash

    # Release (only after signing)
    is_released = Column(Boolean, default=False, nullable=False)
    released_at = Column(DateTime(timezone=True), nullable=True)
    released_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
