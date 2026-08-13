"""
transaction.py — Parsed transaction records from uploaded datasets.

After a Dataset passes validation, individual transaction rows
are stored here for analysis and reporting.
"""
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Index
from sqlalchemy.sql import func
from db.database import Base


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id"), nullable=False, index=True)
    service_request_id = Column(Integer, ForeignKey("service_requests.id"), nullable=False, index=True)

    # Core transaction fields (CSV columns)
    transaction_id = Column(String(100), nullable=True, index=True)   # original ID from CSV
    sender_account = Column(String(100), nullable=False, index=True)
    receiver_account = Column(String(100), nullable=False, index=True)
    sender_name = Column(String(255), nullable=True)
    receiver_name = Column(String(255), nullable=True)
    amount = Column(Float, nullable=False)
    currency = Column(String(10), default="USD")
    transaction_date = Column(DateTime(timezone=True), nullable=False, index=True)
    transaction_type = Column(String(50), nullable=True)   # WIRE, ACH, CASH, etc.
    description = Column(String(500), nullable=True)
    channel = Column(String(50), nullable=True)            # ONLINE, BRANCH, ATM
    country_sender = Column(String(5), nullable=True)
    country_receiver = Column(String(5), nullable=True)
    
    # Risk classification (set during analysis)
    is_suspicious = Column(Integer, default=0)             # 0/1 flag
    risk_score = Column(Float, nullable=True)
    risk_flags = Column(String(500), nullable=True)        # comma-sep pattern names

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_txn_sender_date", "sender_account", "transaction_date"),
        Index("ix_txn_receiver_date", "receiver_account", "transaction_date"),
        Index("ix_txn_org_dataset", "organization_id", "dataset_id"),
    )
