"""
organization.py - Organization / Tenant model.

Every client belongs to an organization.
Admin must approve the organization before the client can use the system.

Statuses: PENDING → APPROVED | REJECTED
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from db.database import Base


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), unique=True, index=True, nullable=False)

    # Organization details
    org_type = Column(String(100), nullable=True)          # Bank, FinTech, Company, General Business
    registration_number = Column(String(100), nullable=True)
    country = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    city = Column(String(100), nullable=True)
    address = Column(Text, nullable=True)
    website = Column(String(255), nullable=True)
    phone = Column(String(30), nullable=True)
    email = Column(String(255), nullable=True)
    contact_person = Column(String(255), nullable=True)    # Primary contact name

    # Admin approval status: PENDING | APPROVED | REJECTED
    status = Column(String(50), default="PENDING", nullable=False, index=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    approved_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
