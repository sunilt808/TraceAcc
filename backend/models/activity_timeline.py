from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from db.database import Base


class ActivityTimeline(Base):
    __tablename__ = "activity_timeline"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    workflow_instance_id = Column(Integer, ForeignKey("workflow_instances.id"), nullable=False, index=True)
    actor_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    action = Column(String(100), nullable=False)
    from_status = Column(String(50), nullable=True)
    to_status = Column(String(50), nullable=True)
    details = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
