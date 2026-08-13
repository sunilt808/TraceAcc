def test_login_and_rbac(setup_db, client):
    # Test valid login
    response = client.post("/auth/login", data={"username": "admin", "password": "admin123"})
    assert response.status_code == 200
    token = response.json()["access_token"]
    
    # Test me endpoint
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/auth/me", headers=headers)
    assert response.status_code == 200
    assert response.json()["username"] == "admin"
    assert response.json()["role"] == "SUPER_ADMIN"
    
def test_failed_login_lockout(setup_db, client):
    # Try logging in with wrong password 5 times
    for _ in range(5):
        response = client.post("/auth/login", data={"username": "client1", "password": "wrongpassword"})
        assert response.status_code == 401
        
    # 6th time should fail even with correct password because of lockout
    response = client.post("/auth/login", data={"username": "client1", "password": "client123"})
    assert response.status_code == 401

    # Unlock the user so subsequent tests don't fail
    from models.user import User
    user = setup_db.query(User).filter(User.username == "client1").first()
    if user:
        user.failed_login_count = 0
        user.locked_until = None
        setup_db.commit()

def test_rbac_register(setup_db, client):
    # client1 (CLIENT_USER) tries to register a new user
    login_resp = client.post("/auth/login", data={"username": "client2", "password": "client123"})
    token = login_resp.json()["access_token"]
    
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "username": "newuser",
        "password": "password123",
        "email": "new@new.com",
        "role": "CLIENT_USER"
    }
    response = client.post("/auth/register", json=payload, headers=headers)
    assert response.status_code == 403
    
    # admin (SUPER_ADMIN) tries to register a new user
    login_resp_admin = client.post("/auth/login", data={"username": "admin", "password": "admin123"})
    token_admin = login_resp_admin.json()["access_token"]
    headers_admin = {"Authorization": f"Bearer {token_admin}"}
    
    response2 = client.post("/auth/register", json=payload, headers=headers_admin)
    assert response2.status_code == 201
    assert response2.json()["username"] == "newuser"
