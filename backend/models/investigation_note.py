"""
investigation_note.py — Notes created by InvoSpace investigators on a case.

Separate from CaseEvent (which is system/timeline events).
InvestigationNotes are analyst-level internal narrative entries.
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from db.database import Base


class InvestigationNote(Base):
    __tablename__ = "investigation_notes"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=False, index=True)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    title = Column(String(255), nullable=True)
    content = Column(Text, nullable=False)
    
    # INTERNAL | SUMMARY | OBSERVATION | FLAG
    note_type = Column(String(50), default="INTERNAL", nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
