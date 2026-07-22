from sqlalchemy import Column, Integer, String, Text, DateTime, Index
from datetime import datetime, timezone

from db.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    
    # Event classification
    event_type = Column(String(50), nullable=False, index=True)  # AUTH, ANALYZE, SYSTEM, ERROR
    event_action = Column(String(100), nullable=False, index=True)  # login, register, analyze, password_change, etc.
    event_status = Column(String(20), nullable=False, index=True)  # success, failure, error
    
    # User context (nullable for anonymous/system events)
    user_id = Column(Integer, nullable=True, index=True)
    username = Column(String(150), nullable=True, index=True)
    
    # Request context
    ip_address = Column(String(45), nullable=True)  # IPv6 compatible
    user_agent = Column(String(500), nullable=True)
    endpoint = Column(String(255), nullable=True)
    method = Column(String(10), nullable=True)
    
    # Event details
    details = Column(Text, nullable=True)  # JSON string for additional context
    error_message = Column(Text, nullable=True)
    
    # Performance tracking
    duration_ms = Column(Integer, nullable=True)

    __table_args__ = (
        Index('ix_audit_user_timestamp', 'user_id', 'timestamp'),
        Index('ix_audit_type_action', 'event_type', 'event_action'),
    )
