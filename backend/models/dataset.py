"""
dataset.py — Dataset model for TraceAcc Pro.

Represents an uploaded CSV/Excel file tied to a ServiceRequest.
Goes through a validation pipeline before entering analysis.

States:
  UPLOADED → VALIDATING → VALID/INVALID → PROCESSING → PROCESSED/FAILED
"""
from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey, JSON
from sqlalchemy.sql import func
from db.database import Base


class Dataset(Base):
    __tablename__ = "datasets"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    service_request_id = Column(Integer, ForeignKey("service_requests.id"), nullable=False, index=True)
    uploaded_by_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    # File info
    original_filename = Column(String(255), nullable=False)
    storage_path = Column(String(500), nullable=False)
    file_size_bytes = Column(Integer, nullable=True)
    mime_type = Column(String(100), nullable=True)

    # State machine: UPLOADED | VALIDATING | VALID | INVALID | PROCESSING | PROCESSED | FAILED
    status = Column(String(50), default="UPLOADED", nullable=False, index=True)

    # Validation results
    row_count = Column(Integer, nullable=True)
    valid_row_count = Column(Integer, nullable=True)
    invalid_row_count = Column(Integer, nullable=True)
    duplicate_count = Column(Integer, nullable=True)
    validation_errors = Column(JSON, nullable=True)   # list of error descriptions
    validation_warnings = Column(JSON, nullable=True)
    validated_at = Column(DateTime(timezone=True), nullable=True)
    validated_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Processing summary (populated after analysis)
    processing_summary = Column(JSON, nullable=True)
    processed_at = Column(DateTime(timezone=True), nullable=True)

    # Metadata
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
