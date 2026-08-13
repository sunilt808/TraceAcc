"""
service_request.py - Model for client service requests.

Clients submit service requests for AML analysis or investigation.
Admin reviews and routes them.

States (controlled, no arbitrary changes):
  SUBMITTED → UNDER_REVIEW → NEEDS_INFORMATION → APPROVED →
  ASSIGNED_ANALYST | ASSIGNED_INVOSPACE →
  ANALYSIS_IN_PROGRESS | INVESTIGATION_IN_PROGRESS →
  ALERT_ESCALATED →
  REPORT_SUBMITTED → ADMIN_REVIEW → REVISION_REQUIRED →
  APPROVED → RELEASED | CLOSED | REJECTED
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from db.database import Base


class ServiceRequest(Base):
    __tablename__ = "service_requests"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    # Assignment tracking (separate fields for analyst vs invospace)
    assigned_to_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)  # legacy
    assigned_analyst_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    assigned_invospace_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    assigned_by_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    assigned_at = Column(DateTime(timezone=True), nullable=True)

    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    # ANALYSIS | INVESTIGATION | AUDIT
    request_type = Column(String(50), default="ANALYSIS", nullable=False)

    # Controlled state machine (see docstring above)
    status = Column(String(50), default="SUBMITTED", nullable=False, index=True)

    # Dataset info (from upload)
    dataset_path = Column(String(500), nullable=True)
    dataset_filename = Column(String(255), nullable=True)

    # Report path (final released report)
    report_path = Column(String(500), nullable=True)

    # Admin notes
    admin_notes = Column(Text, nullable=True)

    # Information request tracking
    information_requested_at = Column(DateTime(timezone=True), nullable=True)
    information_provided_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
