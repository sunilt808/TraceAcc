"""
role.py — Role definitions for TraceAcc Pro.

There are exactly FOUR roles in the platform:

    CLIENT_USER        → Client portal users
    ADMIN              → Full administrative access (user/org management,
                         request review, assignment, report approval, audit)
    TRACE_LAB_ANALYST  → TraceLab analyst workspace
    INVESTIGATOR       → InvoSpace investigator workspace

Database values MUST NOT be renamed because existing records
and authorization logic depend on them.
"""

import enum


class Role(str, enum.Enum):

    CLIENT = "CLIENT_USER"
    ADMIN = "ADMIN"
    ANALYST = "TRACE_LAB_ANALYST"
    INVOSPACE = "INVESTIGATOR"

    # ========================================================
    # BACKWARD-COMPATIBILITY ALIASES
    # ========================================================

    CLIENT_USER = "CLIENT_USER"
    TRACE_LAB_ANALYST = "TRACE_LAB_ANALYST"
    INVESTIGATOR = "INVESTIGATOR"


# Legacy DB value that may still exist in old databases.
# It is treated as ADMIN everywhere (see api/deps.py) and
# migrated to ADMIN by scripts/migrate_single_admin.py.
LEGACY_SUPER_ADMIN = "SUPER_ADMIN"
