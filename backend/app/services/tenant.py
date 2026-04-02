"""Tenant service for organization lifecycle."""

from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.models.tenant import Tenant, TenantStatus
from app.models.user import UserRole
from app.schemas.tenant import TenantCreate, TenantUpdate, OrganizationSignup

logger = get_logger(__name__)


class TenantService:
    """Tenant service class."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, tenant_id: str) -> Optional[Tenant]:
        """Get tenant by ID."""
        result = await self.db.execute(select(Tenant).where(Tenant.id == tenant_id))
        return result.scalar_one_or_none()

    async def get_by_slug(self, slug: str) -> Optional[Tenant]:
        """Get tenant by slug."""
        result = await self.db.execute(select(Tenant).where(Tenant.slug == slug))
        return result.scalar_one_or_none()

    async def create(self, tenant_data: TenantCreate) -> Tenant:
        """Create a new tenant."""
        logger.info("Creating new tenant", name=tenant_data.name, slug=tenant_data.slug)

        existing = await self.get_by_slug(tenant_data.slug)
        if existing:
            raise ValueError(f"Tenant with slug '{tenant_data.slug}' already exists")

        tenant = Tenant(
            name=tenant_data.name,
            slug=tenant_data.slug,
            status=TenantStatus.ACTIVE,
        )

        self.db.add(tenant)
        await self.db.commit()
        await self.db.refresh(tenant)

        logger.info("Tenant created successfully", tenant_id=tenant.id)
        return tenant

    async def update(self, tenant_id: str, tenant_data: TenantUpdate) -> Optional[Tenant]:
        """Update tenant."""
        tenant = await self.get_by_id(tenant_id)
        if not tenant:
            return None

        update_data = tenant_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(tenant, field, value)

        await self.db.commit()
        await self.db.refresh(tenant)

        logger.info("Tenant updated", tenant_id=tenant_id)
        return tenant

    async def register_organization(self, signup_data: OrganizationSignup) -> Tenant:
        """Register a new organization and its first user (Owner).."""
        from app.services.user import UserService

        logger.info("Registering new organization", org_name=signup_data.tenant.name)

        # 1. Create Tenant
        tenant = await self.create(signup_data.tenant)

        # 2. Create Owner User
        user_service = UserService(self.db)
        signup_data.user.tenant_id = tenant.id
        signup_data.user.role = UserRole.OWNER
        
        await user_service.create(signup_data.user)

        logger.info("Organization registered successfully", tenant_id=tenant.id)
        return tenant
