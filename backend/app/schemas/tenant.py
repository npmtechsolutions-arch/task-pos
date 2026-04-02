"""Tenant schemas for request/response validation."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.tenant import TenantStatus
from app.schemas.user import UserCreate


class TenantBase(BaseModel):
    """Base tenant schema."""

    name: str = Field(..., min_length=2, max_length=255)
    slug: str = Field(..., min_length=2, max_length=100, pattern=r"^[a-z0-9-]+$")


class TenantCreate(TenantBase):
    """Tenant creation schema."""
    pass


class OrganizationSignup(BaseModel):
    """Unified schema for registering a whole organization."""
    tenant: TenantCreate
    user: UserCreate


class TenantUpdate(BaseModel):
    """Tenant update schema."""

    name: Optional[str] = None
    plan: Optional[str] = None
    status: Optional[TenantStatus] = None
    settings: Optional[dict] = None
    branding: Optional[dict] = None


class TenantResponse(TenantBase):
    """Tenant response schema."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    plan: str
    status: TenantStatus
    settings: dict
    branding: dict
    created_at: datetime
    updated_at: datetime
