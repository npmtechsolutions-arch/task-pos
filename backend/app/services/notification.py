"""Notification service for managing notifications."""

from datetime import datetime
from typing import List, Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.models.notification import (
    Notification,
    NotificationChannel,
    NotificationPreference,
    NotificationType,
)
from app.schemas.notification import (
    NotificationCreate,
    NotificationPreferenceUpdate,
    NotificationResponse,
)
from app.websocket.manager import manager

logger = get_logger(__name__)


class NotificationService:
    """Notification service class."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, notification_id: str) -> Optional[Notification]:
        """Get notification by ID."""
        result = await self.db.execute(
            select(Notification).where(Notification.id == notification_id)
        )
        return result.scalar_one_or_none()

    async def list_notifications(
        self,
        user_id: str,
        unread_only: bool = False,
        page: int = 1,
        per_page: int = 20,
    ) -> tuple[List[Notification], int, int]:
        """List notifications for user."""
        query = select(Notification).where(Notification.user_id == user_id)

        if unread_only:
            query = query.where(Notification.is_read == False)

        # Get unread count
        unread_query = select(func.count()).where(
            Notification.user_id == user_id,
            Notification.is_read == False,
        )
        unread_result = await self.db.execute(unread_query)
        unread_count = unread_result.scalar() or 0

        # Get total count
        total_query = select(func.count()).where(Notification.user_id == user_id)
        total_result = await self.db.execute(total_query)
        total = total_result.scalar() or 0

        # Apply pagination and ordering
        query = query.order_by(Notification.created_at.desc())
        query = query.offset((page - 1) * per_page).limit(per_page)

        result = await self.db.execute(query)
        return result.scalars().all(), total, unread_count

    async def create(self, notification_data: NotificationCreate) -> Notification:
        """Create a new notification."""
        notification = Notification(
            user_id=notification_data.user_id,
            notification_type=notification_data.notification_type,
            title=notification_data.title,
            message=notification_data.message,
            project_id=notification_data.project_id,
            task_id=notification_data.task_id,
            comment_id=notification_data.comment_id,
            metadata=notification_data.metadata or {},
            channels=[ch.value for ch in notification_data.channels],
            action_url=notification_data.action_url,
        )

        self.db.add(notification)
        await self.db.commit()
        await self.db.refresh(notification)

        # Broadcast via WebSocket immediately
        try:
            ws_payload = NotificationResponse.model_validate(notification).model_dump(mode="json")
            await manager.send_to_user(
                notification.user_id,
                {"type": "NEW_NOTIFICATION", "data": ws_payload}
            )
        except Exception as e:
            logger.error("Failed to broadcast WebSocket notification", error=str(e))

        # TODO: Send to external channels (email, push) via Celery

        logger.info(
            "Notification created",
            notification_id=notification.id,
            user_id=notification_data.user_id,
            type=notification_data.notification_type.value,
        )
        return notification

    async def mark_as_read(
        self, user_id: str, notification_ids: Optional[List[str]] = None
    ) -> int:
        """Mark notifications as read."""
        if notification_ids:
            # Mark specific notifications
            result = await self.db.execute(
                select(Notification).where(
                    Notification.id.in_(notification_ids),
                    Notification.user_id == user_id,
                    Notification.is_read == False,
                )
            )
            notifications = result.scalars().all()
        else:
            # Mark all as read
            result = await self.db.execute(
                select(Notification).where(
                    Notification.user_id == user_id,
                    Notification.is_read == False,
                )
            )
            notifications = result.scalars().all()

        for notification in notifications:
            notification.is_read = True
            notification.read_at = datetime.utcnow()

        await self.db.commit()

        logger.info(
            "Notifications marked as read",
            user_id=user_id,
            count=len(notifications),
        )
        return len(notifications)

    async def delete_old_notifications(
        self, user_id: str, days: int = 30
    ) -> int:
        """Delete old notifications."""
        cutoff_date = datetime.utcnow() - __import__("datetime").timedelta(days=days)

        result = await self.db.execute(
            select(Notification).where(
                Notification.user_id == user_id,
                Notification.created_at < cutoff_date,
                Notification.is_read == True,
            )
        )
        notifications = result.scalars().all()

        for notification in notifications:
            await self.db.delete(notification)

        await self.db.commit()
        return len(notifications)

    # Notification preferences

    async def get_preferences(self, user_id: str) -> Optional[NotificationPreference]:
        """Get notification preferences for user."""
        result = await self.db.execute(
            select(NotificationPreference).where(
                NotificationPreference.user_id == user_id
            )
        )
        return result.scalar_one_or_none()

    async def create_default_preferences(self, user_id: str) -> NotificationPreference:
        """Create default notification preferences for user."""
        preferences = NotificationPreference(user_id=user_id)
        self.db.add(preferences)
        await self.db.commit()
        await self.db.refresh(preferences)
        return preferences

    async def update_preferences(
        self, user_id: str, data: NotificationPreferenceUpdate
    ) -> Optional[NotificationPreference]:
        """Update notification preferences."""
        preferences = await self.get_preferences(user_id)
        if not preferences:
            preferences = await self.create_default_preferences(user_id)

        update_data = data.model_dump(exclude_unset=True)

        for field, value in update_data.items():
            setattr(preferences, field, value)

        preferences.updated_at = datetime.utcnow()
        await self.db.commit()
        await self.db.refresh(preferences)

        return preferences

    # Helper methods for creating specific notification types

    async def notify_task_assigned(
        self,
        user_id: str,
        task_id: str,
        task_title: str,
        project_id: str,
        project_name: str,
        assigned_by_name: str,
    ) -> Notification:
        """Create task assigned notification."""
        return await self.create(
            NotificationCreate(
                user_id=user_id,
                notification_type=NotificationType.TASK_ASSIGNED,
                title="New task assigned",
                message=f"{assigned_by_name} assigned you to '{task_title}' in {project_name}",
                project_id=project_id,
                task_id=task_id,
                action_url=f"/projects/{project_id}/tasks/{task_id}",
            )
        )

    async def notify_task_commented(
        self,
        user_id: str,
        task_id: str,
        task_title: str,
        project_id: str,
        commenter_name: str,
        comment_preview: str,
    ) -> Notification:
        """Create task commented notification."""
        return await self.create(
            NotificationCreate(
                user_id=user_id,
                notification_type=NotificationType.TASK_COMMENTED,
                title="New comment on task",
                message=f"{commenter_name} commented on '{task_title}': {comment_preview[:100]}",
                project_id=project_id,
                task_id=task_id,
                action_url=f"/projects/{project_id}/tasks/{task_id}",
            )
        )

    async def notify_task_due_soon(
        self,
        user_id: str,
        task_id: str,
        task_title: str,
        project_id: str,
        hours_remaining: int,
    ) -> Notification:
        """Create task due soon notification."""
        return await self.create(
            NotificationCreate(
                user_id=user_id,
                notification_type=NotificationType.TASK_DUE_SOON,
                title="Task due soon",
                message=f"'{task_title}' is due in {hours_remaining} hours",
                project_id=project_id,
                task_id=task_id,
                action_url=f"/projects/{project_id}/tasks/{task_id}",
            )
        )

    async def notify_project_invitation(
        self,
        user_id: str,
        project_id: str,
        project_name: str,
        inviter_name: str,
    ) -> Notification:
        """Create project invitation notification."""
        return await self.create(
            NotificationCreate(
                user_id=user_id,
                notification_type=NotificationType.PROJECT_INVITATION,
                title="Project invitation",
                message=f"{inviter_name} invited you to join '{project_name}'",
                project_id=project_id,
                action_url=f"/projects/{project_id}",
            )
        )

    async def notify_user_hired(
        self, admin_id: str, new_user_name: str, new_user_id: str
    ) -> Notification:
        """Create user hired notification for admins."""
        return await self.create(
            NotificationCreate(
                user_id=admin_id,
                notification_type=NotificationType.USER_HIRED,
                title="New Employee Joined",
                message=f"{new_user_name} has joined the company",
                action_url=f"/hr/employees/{new_user_id}",
            )
        )

    async def notify_user_fired(
        self, admin_id: str, fired_user_name: str
    ) -> Notification:
        """Create user fired notification for admins."""
        return await self.create(
            NotificationCreate(
                user_id=admin_id,
                notification_type=NotificationType.USER_FIRED,
                title="Employee Removed",
                message=f"{fired_user_name} has been deactivated",
                action_url="/admin/users",
            )
        )

    async def notify_message(
        self, receiver_id: str, sender_name: str, message_preview: str, room_id: str
    ) -> Notification:
        """Create instant message notification."""
        return await self.create(
            NotificationCreate(
                user_id=receiver_id,
                notification_type=NotificationType.MESSAGE,
                title="New Message",
                message=f"{sender_name} sent you a message: {message_preview[:50]}",
                action_url="/chat", # generic nav to chat page
            )
        )
