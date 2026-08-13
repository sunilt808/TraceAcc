"""
report_version.py — Versioned history of TechnicalReports and InvestigationReports.

Never overwrite existing report content.
Every revision creates a new ReportVersion entry.
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from db.database import Base


class ReportVersion(Base):
    __tablename__ = "report_versions"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)

    # One of technical_report_id or investigation_report_id must be set
    technical_report_id = Column(Integer, ForeignKey("technical_reports.id"), nullable=True, index=True)
    investigation_report_id = Column(Integer, ForeignKey("investigation_reports.id"), nullable=True, index=True)

    version_number = Column(Integer, nullable=False)

    # Snapshot of the report content at this version
    content_snapshot = Column(Text, nullable=True)   # JSON dump of report content

    # DRAFT | SUBMITTED | REVISION_REQUIRED | APPROVED | REJECTED
    status_at_version = Column(String(50), nullable=False)

    change_reason = Column(Text, nullable=True)   # admin's revision request reason
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
