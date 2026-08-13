def test_debug_login(setup_db, client):
    from models.user import User
    from services.auth_service import authenticate_user
    u = setup_db.query(User).filter_by(username="admin").first()
    print("\n--- DEBUG INFO ---")
    print("User found in DB directly:", u)
    if u:
        print("Username:", u.username)
        print("Role:", u.role)
        print("Hashed pass:", u.password)
        print("Is active:", u.is_active)
    
    auth_u = authenticate_user(setup_db, "admin", "admin123")
    print("Authenticate user result:", auth_u)
    
    response = client.post("/auth/login", data={"username": "admin", "password": "admin123"})
    print("Login endpoint response:", response.status_code, response.text)
    assert response.status_code == 200
