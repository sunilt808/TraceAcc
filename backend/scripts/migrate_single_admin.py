"""
migrate_single_admin.py — One-time data migration.

Consolidates the platform to exactly FOUR roles:
    CLIENT_USER, ADMIN, TRACE_LAB_ANALYST, INVESTIGATOR

Actions:
  1. Users with the retired SUPER_ADMIN role become ADMIN
     (ADMIN is now the top-level role with all admin powers).
  2. Users without an organization are assigned to the first
     APPROVED organization so they can actually access their
     workspace (previously they were locked out of every API).

Idempotent: safe to run multiple times.

Usage:
    python scripts/migrate_single_admin.py [--db path/to/app.db]
"""
import os
import sys
import argparse

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session

from db.database import SessionLocal, init_db
from models.user import User
from models.organization import Organization


LEGACY_SUPER_ADMIN = "SUPER_ADMIN"


def migrate(db: Session):
    init_db()

    # --------------------------------------------------------
    # 1. SUPER_ADMIN -> ADMIN
    # --------------------------------------------------------
    legacy = (
        db.query(User)
        .filter(User.role == LEGACY_SUPER_ADMIN)
        .all()
    )

    for user in legacy:
        user.role = "ADMIN"
        print(f"Role migrated: {user.username} SUPER_ADMIN -> ADMIN")

    # --------------------------------------------------------
    # 2. Assign an organization to org-less users
    # --------------------------------------------------------
    fallback_org = (
        db.query(Organization)
        .filter(Organization.status == "APPROVED")
        .order_by(Organization.id.asc())
        .first()
    )

    if fallback_org is None:
        print("WARNING: no APPROVED organization exists; "
              "org-less users could not be fixed.")
    else:
        orphans = (
            db.query(User)
            .filter(User.organization_id.is_(None))
            .all()
        )
        for user in orphans:
            user.organization_id = fallback_org.id
            print(
                f"Org assigned: {user.username} -> "
                f"{fallback_org.name} (#{fallback_org.id})"
            )

    db.commit()
    print("Migration complete.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Migrate to single-admin four-role model."
    )
    parser.add_argument("--db", type=str, default=None,
                        help="Unused placeholder; DATABASE_URL/.env decides the DB")
    args = parser.parse_args()

    db: Session = SessionLocal()
    try:
        migrate(db)
    except Exception as exc:
        print(f"Migration failed: {exc}")
        db.rollback()
        raise
    finally:
        db.close()
