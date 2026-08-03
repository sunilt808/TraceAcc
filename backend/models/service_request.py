"""
service_request.py - Model for client service requests.

Clients (banks, financial institutions) submit service requests 
for AML analysis, investigation reviews, or compliance audits.
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from db.database import Base


class ServiceRequest(Base):
    __tablename__ = "service_requests"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    assigned_to_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)

    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    # ANALYSIS | INVESTIGATION | AUDIT
    request_type = Column(String(50), default="ANALYSIS", nullable=False)
    # PENDING | APPROVED | IN_PROGRESS | COMPLETED | REJECTED
    status = Column(String(50), default="PENDING", nullable=False, index=True)

    dataset_path = Column(String(500), nullable=True)
    dataset_filename = Column(String(255), nullable=True)
    report_path = Column(String(500), nullable=True)

    admin_notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
