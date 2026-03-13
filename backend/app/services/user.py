"""User service for business logic."""

from datetime import datetime
from typing import List, Optional

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.core.security import get_password_hash, verify_password
from app.models.user import User, UserRole, UserStatus
from app.schemas.user import UserCreate, UserUpdate

logger = get_logger(__name__)


class UserService:
    """User service class."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, user_id: str) -> Optional[User]:
        """Get user by ID."""
        result = await self.db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> Optional[User]:
        """Get user by email."""
        result = await self.db.execute(
            select(User).where(User.email == email.lower())
        )
        return result.scalar_one_or_none()

    async def get_active_users(
        self,
        skip: int = 0,
        limit: int = 100,
        search: Optional[str] = None,
    ) -> tuple[List[User], int]:
        """Get active users with optional search."""
        query = select(User).where(User.is_active == True)

        if search:
            search_filter = or_(
                User.first_name.ilike(f"%{search}%"),
                User.last_name.ilike(f"%{search}%"),
                User.email.ilike(f"%{search}%"),
            )
            query = query.where(search_filter)

        # Get total count
        count_result = await self.db.execute(
            select(User).where(User.is_active == True)
        )
        total = len(count_result.scalars().all())

        # Get paginated results
        query = query.offset(skip).limit(limit)
        result = await self.db.execute(query)
        return result.scalars().all(), total

    async def create(self, user_data: UserCreate) -> User:
        """Create a new user."""
        logger.info("Creating new user", email=user_data.email)

        # Check if email already exists
        existing = await self.get_by_email(user_data.email)
        if existing:
            raise ValueError("Email already registered")

        # Create user
        user = User(
            email=user_data.email.lower(),
            password_hash=get_password_hash(user_data.password),
            first_name=user_data.first_name,
            last_name=user_data.last_name,
            timezone=user_data.timezone,
            language=user_data.language,
            role=user_data.role,
            status=UserStatus.ACTIVE,
            is_active=True,
        )

        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)

        logger.info("User created successfully", user_id=user.id)
        return user

    async def update(self, user_id: str, user_data: UserUpdate) -> Optional[User]:
        """Update user."""
        user = await self.get_by_id(user_id)
        if not user:
            return None

        update_data = user_data.model_dump(exclude_unset=True)

        for field, value in update_data.items():
            setattr(user, field, value)

        user.updated_at = datetime.utcnow()
        await self.db.commit()
        await self.db.refresh(user)

        logger.info("User updated", user_id=user_id)
        return user

    async def update_last_login(self, user_id: str) -> None:
        """Update user's last login timestamp."""
        user = await self.get_by_id(user_id)
        if user:
            user.last_login_at = datetime.utcnow()
            await self.db.commit()

    async def change_password(
        self, user_id: str, current_password: str, new_password: str
    ) -> bool:
        """Change user password."""
        user = await self.get_by_id(user_id)
        if not user:
            return False

        if not verify_password(current_password, user.password_hash):
            return False

        user.password_hash = get_password_hash(new_password)
        await self.db.commit()

        logger.info("Password changed", user_id=user_id)
        return True

    async def reset_password(self, user_id: str, new_password: str) -> bool:
        """Reset user password (admin action)."""
        user = await self.get_by_id(user_id)
        if not user:
            return False

        user.password_hash = get_password_hash(new_password)
        await self.db.commit()

        logger.info("Password reset", user_id=user_id)
        return True

    async def deactivate(self, user_id: str) -> bool:
        """Deactivate user."""
        user = await self.get_by_id(user_id)
        if not user:
            return False

        user.is_active = False
        user.status = UserStatus.INACTIVE
        await self.db.commit()

        logger.info("User deactivated", user_id=user_id)
        return True

    async def verify_email(self, user_id: str) -> bool:
        """Mark user email as verified."""
        user = await self.get_by_id(user_id)
        if not user:
            return False

        user.is_verified = True
        user.email_verified_at = datetime.utcnow()
        if user.status == UserStatus.PENDING:
            user.status = UserStatus.ACTIVE
        await self.db.commit()

        logger.info("Email verified", user_id=user_id)
        return True

    async def update_avatar(self, user_id: str, avatar_url: str) -> bool:
        """Update user avatar."""
        user = await self.get_by_id(user_id)
        if not user:
            return False

        user.avatar_url = avatar_url
        await self.db.commit()
        return True
