import logging
import uuid
from typing import Dict
from faker import Faker
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.user import User, UserRole, UserStatus
from app.models.tenant import Tenant
from passlib.context import CryptContext

logger = logging.getLogger(__name__)
fake = Faker()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

async def seed_users(session: AsyncSession, tenant: Tenant) -> Dict[str, User]:
    """Seed system users."""
    logger.info("Seeding Users...")
    
    users_dict = {}

    users_data = [
        {
            "email": "admin@projectflow.com",
            "first_name": "Super",
            "last_name": "Admin",
            "password": "Admin@123",
            "role": UserRole.ADMIN,
            "key": "admin"
        },
        {
            "email": "pm@projectflow.com",
            "first_name": "Project",
            "last_name": "Manager",
            "password": "Password@123",
            "role": UserRole.MANAGER,
            "key": "pm"
        },
        {
            "email": "dev1@projectflow.com",
            "first_name": "Senior",
            "last_name": "Developer",
            "password": "Password@123",
            "role": UserRole.MEMBER,
            "key": "dev1"
        },
        {
            "email": "designer@projectflow.com",
            "first_name": "Lead",
            "last_name": "Designer",
            "password": "Password@123",
            "role": UserRole.MEMBER,
            "key": "designer"
        },
        {
            "email": "tester@projectflow.com",
            "first_name": "QA",
            "last_name": "Engineer",
            "password": "Password@123",
            "role": UserRole.MEMBER,
            "key": "tester"
        },
    ]

    for ud in users_data:
        result = await session.execute(select(User).where(User.email == ud["email"]))
        user = result.scalars().first()

        if not user:
            user = User(
                id=str(uuid.uuid4()),
                tenant_id=tenant.id,
                email=ud["email"],
                first_name=ud["first_name"],
                last_name=ud["last_name"],
                password_hash=get_password_hash(ud["password"]),
                role=ud["role"],
                status=UserStatus.ACTIVE,
                is_active=True,
                is_verified=True,
            )
            session.add(user)
            logger.info(f"Created User: {user.email} as {user.role.value}")
        else:
            logger.info(f"User {user.email} already exists.")
            
        users_dict[ud["key"]] = user

    await session.flush()
    return users_dict
