"""
role.py — Role definitions for TraceAcc Pro.

Operational roles:
    CLIENT_USER
    ADMIN
    TRACE_LAB_ANALYST
    INVESTIGATOR

Platform role:
    SUPER_ADMIN

SUPER_ADMIN is a platform-level administrator and inherits
ADMIN permissions wherever ADMIN access is allowed.

Database values MUST NOT be renamed because existing records
and authorization logic depend on them.
"""

import enum


class Role(str, enum.Enum):

    # ========================================================
    # OPERATIONAL ROLES
    # ========================================================

    CLIENT = "CLIENT_USER"
    ADMIN = "ADMIN"
    ANALYST = "TRACE_LAB_ANALYST"
    INVOSPACE = "INVESTIGATOR"

    # ========================================================
    # PLATFORM ROLE
    # ========================================================

    SUPER_ADMIN = "SUPER_ADMIN"

    # ========================================================
    # BACKWARD-COMPATIBILITY ALIASES
    # ========================================================

    CLIENT_USER = "CLIENT_USER"
    TRACE_LAB_ANALYST = "TRACE_LAB_ANALYST"
    INVESTIGATOR = "INVESTIGATOR"