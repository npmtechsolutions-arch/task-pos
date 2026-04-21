"""User API routes."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db, require_admin
from app.core.logging import get_logger
from app.schemas.user import (
    ChangePasswordRequest,
    UserCreate,
    UserListResponse,
    UserProfileResponse,
    UserResponse,
    UserUpdate,
)
from app.services.user import UserService

logger = get_logger(__name__)
router = APIRouter()


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """Register a new user account (public endpoint)."""
    user_service = UserService(db)
    try:
        user = await user_service.create(user_data)
        return UserResponse.model_validate(user)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get("", response_model=UserListResponse)
async def list_users(
    search: Optional[str] = Query(None, description="Search by name or email"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserListResponse:
    """List users with optional search."""
    user_service = UserService(db)
    users, total = await user_service.get_active_users(
        skip=(page - 1) * per_page,
        limit=per_page,
        search=search,
        tenant_id=current_user.tenant_id,
    )

    return UserListResponse(
        items=[UserResponse.model_validate(u) for u in users],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.get("/search", response_model=UserListResponse)
async def search_users_quick(
    q: str = Query(..., min_length=1, description="Name or email fragment"),
    limit: int = Query(15, ge=1, le=30),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserListResponse:
    """Fast tenant-scoped user lookup for pickers (small limit, indexed-friendly ILIKE)."""
    user_service = UserService(db)
    users, total = await user_service.get_active_users(
        skip=0,
        limit=limit,
        search=q,
        tenant_id=current_user.tenant_id,
    )
    return UserListResponse(
        items=[UserResponse.model_validate(u) for u in users],
        total=total,
        page=1,
        per_page=limit,
    )


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """Create a new user."""
    user_service = UserService(db)

    try:
        user = await user_service.create(user_data)
        return UserResponse.model_validate(user)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get("/me", response_model=UserProfileResponse)
async def get_current_user_profile(
    current_user=Depends(get_current_user),
) -> UserProfileResponse:
    """Get current user profile."""
    return UserProfileResponse.model_validate(current_user)


@router.put("/me", response_model=UserProfileResponse)
async def update_current_user(
    user_data: UserUpdate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserProfileResponse:
    """Update current user profile."""
    user_service = UserService(db)
    updated_user = await user_service.update(current_user.id, user_data)

    if not updated_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return UserProfileResponse.model_validate(updated_user)


@router.post("/me/change-password")
async def change_password(
    password_data: ChangePasswordRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Change current user password."""
    user_service = UserService(db)
    success = await user_service.change_password(
        current_user.id,
        password_data.current_password,
        password_data.new_password,
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    return {"message": "Password changed successfully"}


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """Get user by ID."""
    user_service = UserService(db)
    user = await user_service.get_by_id(user_id)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return UserResponse.model_validate(user)


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    user_data: UserUpdate,
    current_user=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """Update user (admin only)."""
    user_service = UserService(db)
    updated_user = await user_service.update(user_id, user_data)

    if not updated_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return UserResponse.model_validate(updated_user)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: str,
    current_user=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Deactivate user (admin only)."""
    user_service = UserService(db)
    success = await user_service.deactivate(user_id)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
