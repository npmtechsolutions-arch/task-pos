"""Authentication service."""

from datetime import datetime, timedelta
from typing import Optional, Tuple

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logging import get_logger
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_password,
)
from app.models.user import User
from app.schemas.user import TokenResponse, UserLoginRequest
from app.services.user import UserService

logger = get_logger(__name__)


class AuthService:
    """Authentication service class."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.user_service = UserService(db)

    async def authenticate(
        self, login_data: UserLoginRequest
    ) -> Optional[Tuple[User, TokenResponse]]:
        """Authenticate user and return tokens."""
        user = await self.user_service.get_by_email(login_data.email)

        if not user:
            logger.warning("Login attempt with non-existent email", email=login_data.email)
            return None

        if not user.is_active:
            logger.warning("Login attempt for inactive user", user_id=user.id)
            return None

        if not verify_password(login_data.password, user.password_hash):
            logger.warning("Login attempt with invalid password", user_id=user.id)
            return None

        # Update last login
        await self.user_service.update_last_login(user.id)

        # Generate tokens
        tokens = await self._generate_tokens(user)

        logger.info("User authenticated successfully", user_id=user.id)
        return user, tokens

    async def refresh_tokens(self, refresh_token: str) -> Optional[TokenResponse]:
        """Refresh access token using refresh token."""
        payload = decode_token(refresh_token)

        if not payload or payload.get("type") != "refresh":
            return None

        user_id = payload.get("sub")
        if not user_id:
            return None

        user = await self.user_service.get_by_id(user_id)
        if not user or not user.is_active:
            return None

        tokens = await self._generate_tokens(user)
        logger.info("Tokens refreshed", user_id=user.id)
        return tokens

    async def _generate_tokens(self, user: User) -> TokenResponse:
        """Generate access and refresh tokens."""
        extra_claims = {
            "email": user.email,
            "role": user.role.value,
            "full_name": user.full_name,
        }

        access_token = create_access_token(
            subject=user.id,
            extra_claims=extra_claims,
        )

        refresh_token = create_refresh_token(subject=user.id)

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=settings.jwt_access_token_expire_minutes * 60,
            user=user,  # type: ignore
        )

    async def verify_token(self, token: str) -> Optional[dict]:
        """Verify and decode access token."""
        payload = decode_token(token)

        if not payload or payload.get("type") != "access":
            return None

        # Check expiration
        exp = payload.get("exp")
        if exp and datetime.utcnow().timestamp() > exp:
            return None

        return payload

    async def logout(self, user_id: str) -> bool:
        """Handle user logout (can be extended for token blacklisting)."""
        logger.info("User logged out", user_id=user_id)
        return True
