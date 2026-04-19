import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.tenant import Tenant, TenantStatus

logger = logging.getLogger(__name__)

async def seed_tenants(session: AsyncSession) -> Tenant:
    """Seed default tenant."""
    logger.info("Seeding Tenants...")
    
    tenant_slug = "projectflow"
    
    result = await session.execute(select(Tenant).where(Tenant.slug == tenant_slug))
    tenant = result.scalars().first()
    
    if not tenant:
        tenant = Tenant(
            name="ProjectFlow Corp.",
            slug=tenant_slug,
            plan="enterprise",
            status=TenantStatus.ACTIVE
        )
        session.add(tenant)
        await session.flush()
        logger.info(f"Created Tenant: {tenant.name}")
    else:
        logger.info(f"Tenant {tenant.name} already exists.")
        
    return tenant
