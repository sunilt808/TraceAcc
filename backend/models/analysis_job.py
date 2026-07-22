"""
analysis_job.py — Analysis job tracking model.

Stores metadata about each CSV analysis run:
who ran it, when, how long, how many accounts/rings found.
"""
from sqlalchemy import Column, Integer, String, Float, DateTime, JSON, ForeignKey
from sqlalchemy.sql import func
from db.database import Base


class AnalysisJob(Base):
    __tablename__ = "analysis_jobs"

    id                       = Column(Integer, primary_key=True, index=True)
    user_id                  = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    filename                 = Column(String(255), nullable=False)
    status                   = Column(String(50), default="completed")   # completed | failed
    total_accounts           = Column(Integer, default=0)
    total_transactions       = Column(Integer, default=0)
    suspicious_accounts      = Column(Integer, default=0)
    fraud_rings              = Column(Integer, default=0)
    processing_time_seconds  = Column(Float,   default=0.0)
    # JSON column for extra metadata (detector counts, etc.)
    meta                     = Column(JSON, nullable=True)
    error_message            = Column(String(500), nullable=True)
    created_at               = Column(DateTime(timezone=True), server_default=func.now())
