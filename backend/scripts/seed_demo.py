import sys
import os

# Add backend directory to sys path so imports work
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from sqlalchemy.orm import Session
from db.database import SessionLocal, init_db
from models.user import User
from models.organization import Organization
from services.auth_service import get_password_hash
from models.role import Role
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def seed_demo_data(db: Session):
    logger.info("Initializing DB tables if they don't exist...")
    init_db()

    # 1. Check if organization exists
    org = db.query(Organization).filter(Organization.name == "Demo Corp").first()
    if not org:
        logger.info("Creating demo organization...")
        org = Organization(
            name="Demo Corp"
        )
        db.add(org)
        db.commit()
        db.refresh(org)
    
    org_id = org.id

    # 2. Seed Users
    users_to_seed = [
        {"username": "admin", "password": "password123", "role": Role.ADMIN, "org": org_id},
        {"username": "client", "password": "password123", "role": Role.CLIENT, "org": org_id},
        {"username": "analyst", "password": "password123", "role": Role.ANALYST, "org": org_id},
        {"username": "invospace", "password": "password123", "role": Role.INVOSPACE, "org": org_id},
    ]

    for u_data in users_to_seed:
        user = db.query(User).filter(User.username == u_data["username"]).first()
        if not user:
            logger.info(f"Creating user {u_data['username']} with role {u_data['role'].value}...")
            new_user = User(
                username=u_data["username"],
                password=get_password_hash(u_data["password"]),
                email=f"{u_data['username']}@democorp.com",
                role=u_data["role"].value,
                organization_id=u_data["org"],
                is_active=True
            )
            db.add(new_user)

    db.commit()
    logger.info("Demo data seeding completed successfully.")

if __name__ == "__main__":
    db = SessionLocal()
    try:
        seed_demo_data(db)
    finally:
        db.close()
