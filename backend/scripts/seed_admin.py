import os
import sys
import argparse
from sqlalchemy.orm import Session

# Add the backend directory to sys.path so we can import our modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db.database import SessionLocal, init_db
from models.user import User
from models.organization import Organization
from models.role import Role
from services.auth_service import create_user

def seed_admin(username: str, password: str, email: str):
    db: Session = SessionLocal()
    try:
        # Create Internal Organization
        org = db.query(Organization).filter(Organization.name == "Internal TraceAcc").first()
        if not org:
            org = Organization(name="Internal TraceAcc")
            db.add(org)
            db.commit()
            db.refresh(org)
            print("Created Internal TraceAcc organization.")
        else:
            print("Internal TraceAcc organization already exists.")
            
        # Create Admin (top-level role)
        admin = db.query(User).filter(User.username == username).first()
        if not admin:
            create_user(
                db=db,
                username=username,
                password=password,
                email=email,
                role=Role.ADMIN,
                organization_id=org.id
            )
            print(f"Created ADMIN user: {username}")
        else:
            print(f"User {username} already exists.")
            
    except Exception as e:
        print(f"Error seeding database: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed initial ADMIN user.")
    parser.add_argument("--username", type=str, default="admin", help="Admin username")
    parser.add_argument("--password", type=str, default="admin123", help="Admin password")
    parser.add_argument("--email", type=str, default="admin@traceacc.io", help="Admin email")
    args = parser.parse_args()
    
    seed_admin(args.username, args.password, args.email)
