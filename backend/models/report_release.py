"""
report_release.py — Versioned Report Release Records for Client Access.
Tracks official administrative release of specific, immutable investigation report versions to client organizations.
"""
from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Text
from sqlalchemy.sql import func
from db.database import Base


class ReportRelease(Base):
    __tablename__ = "report_releases"

    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("cases.id", ondelete="CASCADE"), nullable=False, index=True)
    client_report_id = Column(Integer, ForeignKey("client_reports.id", ondelete="CASCADE"), nullable=True, index=True)
    version_number = Column(Integer, default=1, nullable=False)
    recipient_organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    released_by_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    released_at = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True, nullable=False)
    signature_hash = Column(String(255), nullable=True)
    seal_id = Column(String(100), nullable=True)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    revoked_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    revocation_reason = Column(Text, nullable=True)
