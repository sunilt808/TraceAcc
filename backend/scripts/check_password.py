from passlib.context import CryptContext

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto"
)

stored_hash = input("Paste the admin password hash: ").strip()

for password in [
    "Password123!",
    "Password123",
    "Admin123!",
    "Admin@123",
    "admin123",
]:
    try:
        if pwd_context.verify(password, stored_hash):
            print(f"\nMATCH FOUND: {password}")
            break
    except Exception as e:
        print("Hash verification error:", e)
        break
else:
    print("\nNo match found.")