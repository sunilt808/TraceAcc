from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from db.database import Base


class Assignment(Base):
    __tablename__ = "assignments"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    workflow_instance_id = Column(Integer, ForeignKey("workflow_instances.id"), nullable=False, index=True)
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(Integer, nullable=False)
    assignee_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    assigned_by_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    status = Column(String(50), default="ACTIVE", nullable=False)
    due_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
