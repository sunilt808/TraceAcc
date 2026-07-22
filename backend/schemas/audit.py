from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class AuditLogOut(BaseModel):
    id: int
    timestamp: datetime
    event_type: str
    event_action: str
    event_status: str
    user_id: Optional[int] = None
    username: Optional[str] = None
    ip_address: Optional[str] = None
    endpoint: Optional[str] = None
    method: Optional[str] = None
    details: Optional[str] = None
    error_message: Optional[str] = None
    duration_ms: Optional[int] = None

    class Config:
        from_attributes = True


class AuditStatsOut(BaseModel):
    total_events: int
    success_count: int
    failure_count: int
    error_count: int
    login_count: int
    analyze_count: int


class AuditLogListResponse(BaseModel):
    items: list[AuditLogOut]
    total: int
    limit: int
    offset: int
