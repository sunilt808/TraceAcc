import sys
import os

# Add the backend directory to the path so we can import modules
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from db.database import SessionLocal, init_db
from services.auth_service import create_user
from models.user import User
from models.organization import Organization
from models.role import Role

def seed_super_admin():
    init_db()
    db = SessionLocal()
    try:
        # Check and create organization
        org = db.query(Organization).filter(Organization.id == 1).first()
        if not org:
            org = Organization(id=1, name="TraceAcc Corp")
            db.add(org)
            db.commit()

        test_users = [
            {"username": "admin", "role": Role.SUPER_ADMIN},
            {"username": "client", "role": Role.CLIENT_USER},
            {"username": "analyst", "role": Role.TRACE_LAB_ANALYST},
            {"username": "investigator", "role": Role.INVESTIGATOR},
            {"username": "auditor", "role": Role.AUDITOR},
        ]

        for user_data in test_users:
            existing_user = db.query(User).filter(User.username == user_data["username"]).first()
            if not existing_user:
                print(f"Creating {user_data['username']}...")
                create_user(
                    db=db,
                    username=user_data["username"],
                    password="Password123!",
                    email=f"{user_data['username']}@traceacc.com",
                    role=user_data["role"],
                    organization_id=1
                )
        print("All test users seeded successfully!")
    except Exception as e:
        print(f"Error seeding admin: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_super_admin()
