import pytest
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from main import app
from db.database import Base, get_db
import models.user
import models.organization
import models.case
import models.analysis_job
import models.audit_log
from models.user import User
from models.organization import Organization
from models.role import Role
from services.auth_service import create_user

# Setup test DB (in-memory SQLite)
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="session")
def setup_db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    # Create orgs
    org1 = Organization(name="Org1")
    org2 = Organization(name="Org2")
    internal = Organization(name="Internal TraceAcc")
    db.add_all([org1, org2, internal])
    db.commit()
    db.refresh(org1)
    db.refresh(org2)
    db.refresh(internal)
    
    # Create users
    create_user(db, "admin", "admin123", "admin@internal.io", Role.SUPER_ADMIN, internal.id)
    create_user(db, "analyst", "analyst123", "analyst@internal.io", Role.TRACE_LAB_ANALYST, internal.id)
    create_user(db, "client1", "client123", "c1@org1.io", Role.CLIENT_USER, org1.id)
    create_user(db, "client2", "client123", "c2@org2.io", Role.CLIENT_USER, org2.id)
    
    yield db
    
    db.close()
    Base.metadata.drop_all(bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c
