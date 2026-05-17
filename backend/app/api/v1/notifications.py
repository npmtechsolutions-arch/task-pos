"""Notification API routes."""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.core.logging import get_logger
from app.schemas.notification import (
    MarkReadRequest,
    NotificationListResponse,
    NotificationPreferenceResponse,
    NotificationPreferenceUpdate,
    NotificationResponse,
)
from app.services.notification import NotificationService

logger = get_logger(__name__)
router = APIRouter()


@router.get("", response_model=NotificationListResponse)
async def list_notifications(
    unread_only: bool = Query(False),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> NotificationListResponse:
    """List notifications for current user."""
    notification_service = NotificationService(db)
    notifications, total, unread_count = await notification_service.list_notifications(
        user_id=current_user.id,
        tenant_id=current_user.tenant_id,
        unread_only=unread_only,
        page=page,
        per_page=per_page,
    )

    return NotificationListResponse(
        items=[NotificationResponse.model_validate(n) for n in notifications],
        total=total,
        unread_count=unread_count,
        page=page,
        per_page=per_page,
    )


@router.get("/unread-count")
async def get_unread_count(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get unread notification count — single COUNT(*) query, no list fetch."""
    from sqlalchemy import func, select as sa_select
    from app.models.notification import Notification

    result = await db.execute(
        sa_select(func.count(Notification.id)).where(
            Notification.user_id == current_user.id,
            Notification.is_read == False,
        )
    )
    count = result.scalar() or 0
    return {"unread_count": count}


@router.put("/read")
async def mark_as_read(
    mark_data: MarkReadRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Mark notifications as read."""
    notification_service = NotificationService(db)
    count = await notification_service.mark_as_read(
        user_id=current_user.id,
        notification_ids=mark_data.notification_ids,
    )

    return {"message": f"Marked {count} notifications as read"}


@router.put("/read-all")
async def mark_all_as_read(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Mark all notifications as read."""
    notification_service = NotificationService(db)
    count = await notification_service.mark_as_read(user_id=current_user.id)

    return {"message": f"Marked {count} notifications as read"}


@router.delete("/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_notification(
    notification_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete notification."""
    notification_service = NotificationService(db)
    notification = await notification_service.get_by_id(notification_id)

    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )

    # Can only delete own notifications
    if notification.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )

    await db.delete(notification)
    await db.commit()


# Preferences

@router.get("/preferences", response_model=NotificationPreferenceResponse)
async def get_preferences(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> NotificationPreferenceResponse:
    """Get notification preferences."""
    notification_service = NotificationService(db)
    preferences = await notification_service.get_preferences(current_user.id)

    if not preferences:
        preferences = await notification_service.create_default_preferences(
            current_user.id
        )

    return NotificationPreferenceResponse.model_validate(preferences)


@router.put("/preferences", response_model=NotificationPreferenceResponse)
async def update_preferences(
    pref_data: NotificationPreferenceUpdate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> NotificationPreferenceResponse:
    """Update notification preferences."""
    notification_service = NotificationService(db)
    preferences = await notification_service.update_preferences(
        current_user.id, pref_data
    )

    return NotificationPreferenceResponse.model_validate(preferences)
