"""
investigation_hypothesis.py — Investigative hypotheses on a case.

InvoSpace creates hypotheses to track possible explanations and
links them to supporting/contradicting evidence.

Statuses: OPEN | SUPPORTED | REJECTED | INCONCLUSIVE
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.sql import func
from db.database import Base


class InvestigationHypothesis(Base):
    __tablename__ = "investigation_hypotheses"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=False, index=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    # OPEN | SUPPORTED | REJECTED | INCONCLUSIVE
    status = Column(String(50), default="OPEN", nullable=False, index=True)

    # IDs of Evidence records supporting/contradicting this hypothesis
    supporting_evidence_ids = Column(JSON, nullable=True)
    contradicting_evidence_ids = Column(JSON, nullable=True)

    # IDs of InvestigationFinding records linked to this hypothesis
    linked_finding_ids = Column(JSON, nullable=True)

    notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
