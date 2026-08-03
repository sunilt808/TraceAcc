from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from db.database import Base


class WorkflowInstance(Base):
    __tablename__ = "workflow_instances"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    service_request_id = Column(Integer, ForeignKey("service_requests.id"), nullable=True, index=True)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=True, index=True)
    report_id = Column(Integer, ForeignKey("client_reports.id"), nullable=True, index=True)

    current_status = Column(String(50), default="SUBMITTED", nullable=False, index=True)
    current_stage = Column(String(50), default="REQUEST_CREATED", nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    assignee_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    last_note = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
