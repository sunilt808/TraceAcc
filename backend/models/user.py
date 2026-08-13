"""
user.py — User model for TraceAcc Pro.

Users belong to an organization/workspace unless they are
platform-level SUPER_ADMIN users.

Roles:
    CLIENT_USER
    ADMIN
    TRACE_LAB_ANALYST
    INVESTIGATOR
    SUPER_ADMIN
"""

from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    DateTime,
    ForeignKey,
)
from sqlalchemy.sql import func

from db.database import Base
from models.role import Role


class User(Base):
    __tablename__ = "users"

    # ========================================================
    # PRIMARY KEY
    # ========================================================

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    # ========================================================
    # LOGIN IDENTITY
    # ========================================================

    username = Column(
        String(150),
        unique=True,
        index=True,
        nullable=False,
    )

    email = Column(
        String(255),
        unique=True,
        index=True,
        nullable=True,
    )

    phone = Column(
        String(20),
        nullable=True,
    )

    # ========================================================
    # AUTHENTICATION
    # ========================================================

    password = Column(
        String(255),
        nullable=False,
    )

    # ========================================================
    # RBAC
    # ========================================================

    role = Column(
        String(50),
        default=Role.CLIENT_USER.value,
        nullable=False,
        index=True,
    )

    # ========================================================
    # TENANT / ORGANIZATION
    # ========================================================

    organization_id = Column(
        Integer,
        ForeignKey(
            "organizations.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    # ========================================================
    # ACCOUNT STATUS
    # ========================================================

    is_active = Column(
        Boolean,
        default=True,
        nullable=False,
        index=True,
    )

    # ========================================================
    # SECURITY
    # ========================================================

    failed_login_count = Column(
        Integer,
        default=0,
        nullable=False,
    )

    locked_until = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    mfa_secret = Column(
        String(64),
        nullable=True,
    )

    # ========================================================
    # LOGIN TRACKING
    # ========================================================

    last_login = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    # ========================================================
    # AUDIT TIMESTAMPS
    # ========================================================

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )