"""
notification_service.py — Workflow event → Notification fan-out.

Single helper every route uses to notify users about workflow events.
Keeps recipient resolution rules in ONE place:

  - REQUEST_ASSIGNED      → the assignee
  - REQUEST_REVIEWED      → the request creator (client)
  - ALERT_ESCALATED       → all ADMINs of the org
  - ALERT_ROUTED          → the investigator assignee
  - CASE_CREATED          → admins + case investigator
  - REPORT_SUBMITTED      → all ADMINs of the org
  - REPORT_RELEASED       → the client who created the request / case
  - INFORMATION_REQUESTED → the request creator (client)
"""
from typing import Iterable, Optional

from sqlalchemy.orm import Session

from models.notification import Notification
from models.user import User
from models.role import Role


def _insert(
    db: Session,
    org_id: int,
    recipient_id: int,
    notification_type: str,
    title: str,
    message: Optional[str] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[int] = None,
) -> None:
    db.add(
        Notification(
            organization_id=org_id,
            recipient_id=recipient_id,
            notification_type=notification_type,
            title=title,
            message=message,
            resource_type=resource_type,
            resource_id=resource_id,
        )
    )


def _org_admin_ids(db: Session, org_id: int) -> Iterable[int]:
    rows = (
        db.query(User.id)
        .filter(
            User.organization_id == org_id,
            User.role.in_([Role.ADMIN.value]),
            User.is_active.is_(True),
        )
        .all()
    )
    return [r[0] for r in rows]


# ============================================================
# PUBLIC FAN-OUT HELPERS
# ============================================================

def notify_user(
    db: Session,
    *,
    org_id: int,
    recipient_id: int,
    notification_type: str,
    title: str,
    message: Optional[str] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[int] = None,
) -> None:
    """Notify a single user."""
    if recipient_id is None:
        return
    _insert(db, org_id, recipient_id, notification_type, title, message, resource_type, resource_id)


def notify_admins(
    db: Session,
    *,
    org_id: int,
    notification_type: str,
    title: str,
    message: Optional[str] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[int] = None,
    exclude_user_id: Optional[int] = None,
) -> None:
    """Notify every active admin of an organization."""
    for admin_id in _org_admin_ids(db, org_id):
        if exclude_user_id is not None and admin_id == exclude_user_id:
            continue
        _insert(db, org_id, admin_id, notification_type, title, message, resource_type, resource_id)


def notify_request_assigned(
    db: Session,
    *,
    org_id: int,
    assignee_id: int,
    request_id: int,
    request_title: str,
    team: str,
) -> None:
    notify_user(
        db,
        org_id=org_id,
        recipient_id=assignee_id,
        notification_type="REQUEST_ASSIGNED",
        title=f"New {team} assignment",
        message=f"Service request '{request_title}' has been assigned to you.",
        resource_type="SERVICE_REQUEST",
        resource_id=request_id,
    )


def notify_request_reviewed(
    db: Session,
    *,
    org_id: int,
    client_id: int,
    request_id: int,
    request_title: str,
    decision: str,
    note: Optional[str] = None,
) -> None:
    notify_user(
        db,
        org_id=org_id,
        recipient_id=client_id,
        notification_type="REQUEST_REVIEWED",
        title=f"Request {decision}",
        message=(note or f"Your request '{request_title}' was {decision.lower()}."),
        resource_type="SERVICE_REQUEST",
        resource_id=request_id,
    )


def notify_alert_escalated(
    db: Session,
    *,
    org_id: int,
    alert_id: int,
    analyst_name: str,
    risk_score: float,
) -> None:
    notify_admins(
        db,
        org_id=org_id,
        notification_type="ALERT_ESCALATED",
        title=f"Alert #{alert_id} escalated",
        message=(
            f"{analyst_name} escalated alert #{alert_id} "
            f"(risk score {risk_score:.0f}) for routing."
        ),
        resource_type="ALERT",
        resource_id=alert_id,
    )


def notify_alert_routed(
    db: Session,
    *,
    org_id: int,
    alert_id: int,
    investigator_id: int,
    risk_score: float,
) -> None:
    notify_user(
        db,
        org_id=org_id,
        recipient_id=investigator_id,
        notification_type="ALERT_ROUTED",
        title=f"Alert #{alert_id} routed to you",
        message=(
            f"Admin routed escalated alert #{alert_id} "
            f"(risk score {risk_score:.0f}) to InvoSpace — convert it to a case."
        ),
        resource_type="ALERT",
        resource_id=alert_id,
    )


def notify_case_created(
    db: Session,
    *,
    org_id: int,
    case_id: int,
    case_title: str,
    investigator_id: int,
) -> None:
    notify_admins(
        db,
        org_id=org_id,
        notification_type="CASE_CREATED",
        title=f"Case #{case_id} opened",
        message=f"Investigator opened case '{case_title}' from a routed alert.",
        resource_type="CASE",
        resource_id=case_id,
    )
    if investigator_id:
        notify_user(
            db,
            org_id=org_id,
            recipient_id=investigator_id,
            notification_type="CASE_ASSIGNED",
            title=f"Case #{case_id} assigned to you",
            message=f"You are the assigned investigator on '{case_title}'.",
            resource_type="CASE",
            resource_id=case_id,
        )


def notify_report_submitted(
    db: Session,
    *,
    org_id: int,
    report_id: int,
    report_title: str,
    submitter_name: str,
) -> None:
    notify_admins(
        db,
        org_id=org_id,
        notification_type="REPORT_SUBMITTED",
        title=f"Report ready for review",
        message=f"{submitter_name} submitted '{report_title}' for admin review.",
        resource_type="REPORT",
        resource_id=report_id,
    )


def notify_report_released(
    db: Session,
    *,
    org_id: int,
    report_id: int,
    report_title: str,
    client_id: Optional[int],
) -> None:
    if not client_id:
        return
    notify_user(
        db,
        org_id=org_id,
        recipient_id=client_id,
        notification_type="REPORT_RELEASED",
        title="Report released",
        message=f"'{report_title}' has been approved and released to your portal.",
        resource_type="REPORT",
        resource_id=report_id,
    )


def notify_information_requested(
    db: Session,
    *,
    org_id: int,
    client_id: int,
    request_id: int,
    request_title: str,
    note: Optional[str] = None,
) -> None:
    notify_user(
        db,
        org_id=org_id,
        recipient_id=client_id,
        notification_type="INFORMATION_REQUESTED",
        title="Information requested",
        message=(
            note
            or f"Admin needs more information on your request '{request_title}'."
        ),
        resource_type="SERVICE_REQUEST",
        resource_id=request_id,
    )
