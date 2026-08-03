import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from main import app
from db.database import Base, get_db
import models.user
import models.organization
import models.case
import models.analysis_job
import models.audit_log
from models.organization import Organization
from models.user import User
from models.role import Role
from services.auth_service import get_password_hash

# Set up an in-memory database for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

@pytest.fixture(scope="module", autouse=True)
def setup_db():
    db = TestingSessionLocal()
    
    # Create Org A and Org B
    org_a = Organization(name="Bank A")
    org_b = Organization(name="Bank B")
    db.add_all([org_a, org_b])
    db.commit()
    
    # Create User A and User B
    user_a = User(
        username="usera", password=get_password_hash("test"),
        role=Role.INVESTIGATOR, organization_id=org_a.id, is_active=True, failed_login_count=0
    )
    user_b = User(
        username="userb", password=get_password_hash("test"),
        role=Role.INVESTIGATOR, organization_id=org_b.id, is_active=True, failed_login_count=0
    )
    db.add_all([user_a, user_b])
    db.commit()
    db.close()


def test_tenant_isolation_cases():
    # Login as User A
    response = client.post("/auth/login", data={"username": "usera", "password": "test"})
    token_a = response.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}
    
    # User A creates a case
    case_data = {"title": "Org A Case", "priority": "HIGH"}
    response = client.post("/cases", json=case_data, headers=headers_a)
    assert response.status_code == 201
    case_id = response.json()["id"]
    
    # Login as User B
    response = client.post("/auth/login", data={"username": "userb", "password": "test"})
    token_b = response.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}
    
    # User B tries to read User A's case
    response = client.get(f"/cases/{case_id}", headers=headers_b)
    assert response.status_code == 404  # Not found due to isolation filter
    
    # User B tries to list cases, should be empty
    response = client.get("/cases", headers=headers_b)
    assert response.status_code == 200
    assert len(response.json()["items"]) == 0
