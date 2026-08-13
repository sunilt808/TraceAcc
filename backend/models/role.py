"""
role.py — Role definitions for TraceAcc Pro.

Four operational roles:
  CLIENT    (DB: CLIENT_USER)
  ADMIN     (DB: ADMIN)
  ANALYST   (DB: TRACE_LAB_ANALYST)
  INVOSPACE (DB: INVESTIGATOR)

SUPER_ADMIN is a legacy/platform role treated as ADMIN.
Do NOT introduce it as a fifth operational role.
"""
import enum


class Role(str, enum.Enum):
    # Operational roles (DB values — do NOT rename)
    CLIENT    = "CLIENT_USER"         # External clients
    ADMIN     = "ADMIN"               # Operations / communication hub
    ANALYST   = "TRACE_LAB_ANALYST"  # TraceLab detection & analysis
    INVOSPACE = "INVESTIGATOR"        # Deep investigation & case management
    
    # Legacy/platform role — treated as ADMIN in all permission checks
    SUPER_ADMIN = "SUPER_ADMIN"

    # Legacy aliases (kept for backward compat with any code using old names)
    CLIENT_USER       = "CLIENT_USER"
    TRACE_LAB_ANALYST = "TRACE_LAB_ANALYST"
    INVESTIGATOR      = "INVESTIGATOR"
