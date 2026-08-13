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

@pytest.fixture
def db_engine():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
def db(db_engine):
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=db_engine)
    session = TestingSessionLocal()
    yield session
    session.close()

@pytest.fixture
def setup_db(db):
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
    create_user(db, "admin", "admin123", "admin@internal.io", role=Role.SUPER_ADMIN, organization_id=internal.id)
    create_user(db, "analyst", "analyst123", "analyst@internal.io", role=Role.TRACE_LAB_ANALYST, organization_id=internal.id)
    create_user(db, "client1", "client123", "c1@org1.io", role=Role.CLIENT_USER, organization_id=org1.id)
    create_user(db, "client2", "client123", "c2@org2.io", role=Role.CLIENT_USER, organization_id=org2.id)
    
    return db

@pytest.fixture
def client(setup_db):
    def override_get_db():
        yield setup_db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
