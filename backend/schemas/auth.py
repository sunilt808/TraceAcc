from pydantic import BaseModel, Field, EmailStr
from typing import Optional

from models.role import Role


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=150)
    password: str = Field(min_length=8, max_length=128)
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    role: Role = Role.CLIENT_USER
    organization_id: Optional[int] = None


class UserOut(BaseModel):
    id: int
    username: str
    email: Optional[str] = None
    phone: Optional[str] = None
    role: str
    organization_id: Optional[int] = None
    is_active: bool

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class PasswordChange(BaseModel):
    current_password: str = Field(min_length=1)
    new_password: str = Field(min_length=8, max_length=128)


class ClientRegistration(BaseModel):
    """
    Public client self-registration.

    Creates:
    - Organization
    - CLIENT_USER account
    - Organization/User relationship
    """

    # =========================================================
    # ORGANIZATION DETAILS
    # =========================================================

    org_name: str = Field(
        min_length=2,
        max_length=255
    )

    org_type: Optional[str] = None

    registration_number: Optional[str] = None

    # =========================================================
    # PRIMARY CONTACT / USER DETAILS
    # =========================================================

    contact_person: str = Field(
        min_length=2,
        max_length=255
    )

    org_email: EmailStr

    phone: Optional[str] = None

    # =========================================================
    # AUTHENTICATION
    # =========================================================

    password: str = Field(
        min_length=8,
        max_length=128
    )

    confirm_password: str = Field(
        min_length=8,
        max_length=128
    )