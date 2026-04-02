"""User schemas for request/response validation."""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.user import UserRole, UserStatus


class UserBase(BaseModel):
    """Base user schema."""

    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    timezone: str = "UTC"
    language: str = "en"


class UserCreate(UserBase):
    """User creation schema."""

    password: str = Field(..., min_length=5, max_length=100)
    role: UserRole = UserRole.MEMBER
    tenant_id: Optional[str] = None


class UserUpdate(BaseModel):
    """User update schema."""

    first_name: Optional[str] = None
    last_name: Optional[str] = None
    timezone: Optional[str] = None
    language: Optional[str] = None
    phone: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    preferences: Optional[dict] = None
    notification_settings: Optional[dict] = None


class UserResponse(UserBase):
    """User response schema."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    avatar_url: Optional[str] = None
    status: UserStatus
    role: UserRole
    is_active: bool
    is_verified: bool
    last_login_at: Optional[datetime] = None
    created_at: datetime
    full_name: str
    initials: str


class UserProfileResponse(UserResponse):
    """Detailed user profile response."""

    phone: Optional[str] = None
    bio: Optional[str] = None
    preferences: dict
    notification_settings: dict
    mfa_enabled: bool


class UserListResponse(BaseModel):
    """User list response schema."""

    items: List[UserResponse]
    total: int
    page: int
    per_page: int


class ChangePasswordRequest(BaseModel):
    """Change password request schema."""

    current_password: str
    new_password: str = Field(..., min_length=8, max_length=100)


class UserLoginRequest(BaseModel):
    """User login request schema."""

    email: str
    password: str


class TokenResponse(BaseModel):
    """Token response schema."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse


class RefreshTokenRequest(BaseModel):
    """Refresh token request schema."""

    refresh_token: str


class PasswordResetRequest(BaseModel):
    """Password reset request schema."""

    email: EmailStr


class PasswordResetConfirm(BaseModel):
    """Password reset confirmation schema."""

    token: str
    new_password: str = Field(..., min_length=8, max_length=100)
