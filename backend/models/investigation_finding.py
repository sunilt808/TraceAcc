"""
investigation_finding.py — Formal findings recorded during investigation.

A Finding is a structured conclusion about a specific entity,
transaction, pattern or relationship. It becomes the basis for
the Investigation Report conclusion.
"""
from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey, JSON
from sqlalchemy.sql import func
from db.database import Base


class InvestigationFinding(Base):
    __tablename__ = "investigation_findings"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=False, index=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)

    # SUSPICIOUS_TRANSACTION | SUSPICIOUS_NETWORK | IDENTITY_DISCREPANCY
    # BEHAVIOUR_ANOMALY | PATTERN_MATCH | RISK_FACTOR | EXCULPATORY | OTHER
    finding_type = Column(String(50), default="OTHER", nullable=False, index=True)

    # CONFIRMED | PROBABLE | INCONCLUSIVE | REFUTED
    confidence = Column(String(50), default="INCONCLUSIVE", nullable=False)

    # Risk contribution
    risk_contribution = Column(Float, default=0.0, nullable=False)

    # Linked resources (IDs as JSON lists)
    linked_entity_ids = Column(JSON, nullable=True)
    linked_transaction_ids = Column(JSON, nullable=True)
    linked_evidence_ids = Column(JSON, nullable=True)
    linked_hypothesis_ids = Column(JSON, nullable=True)

    # AML pattern reference if applicable
    aml_pattern = Column(String(100), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
