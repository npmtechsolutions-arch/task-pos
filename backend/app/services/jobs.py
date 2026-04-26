"""
Overdue & Reminder background jobs.

Runs via APScheduler inside the FastAPI lifespan (no Celery required).
Jobs:
  - Every 5 min: mark overdue tasks + send TASK_OVERDUE notifications
  - Every 15 min: send TASK_DUE_SOON reminders (1h and 24h windows)
  - Daily 00:05 UTC: delete read notifications older than 60 days
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta
from typing import List

from sqlalchemy import select

from app.core.logging import get_logger

logger = get_logger(__name__)


async def _run_overdue_check() -> None:
    """
    Find tasks past their due_date that aren't done/cancelled,
    create TASK_OVERDUE notifications (deduped per calendar day).
    """
    from app.db.session import AsyncSessionLocal
    from app.models.task import Task, TaskStatus
    from app.models.user import User
    from app.services.notification import NotificationService
    from app.schemas.notification import NotificationCreate
    from app.models.notification import NotificationType

    now = datetime.utcnow()
    today_str = now.strftime("%Y-%m-%d")

    async with AsyncSessionLocal() as db:
        # Tasks past due and not in terminal state
        result = await db.execute(
            select(Task).where(
                Task.due_date < now,
                Task.status.not_in([
                    TaskStatus.DONE,
                    TaskStatus.CANCELLED,
                ]),
            )
        )
        tasks: List[Task] = result.scalars().all()

        if not tasks:
            return

        notif_service = NotificationService(db)
        count = 0
        for task in tasks:
            recipients = []
            if task.primary_assignee_id:
                recipients.append(task.primary_assignee_id)
            if task.reporter_id and task.reporter_id not in recipients:
                recipients.append(task.reporter_id)

            for uid in recipients:
                try:
                    await notif_service.create(
                        NotificationCreate(
                            user_id=uid,
                            # One overdue notification per task per day per user
                            dedupe_key=f"overdue:{task.id}:{uid}:{today_str}",
                            notification_type=NotificationType.TASK_OVERDUE,
                            title="⚠️ Task Overdue",
                            message=f"'{task.title}' was due {task.due_date.strftime('%b %d')} and is still open.",
                            task_id=task.id,
                            project_id=task.project_id,
                            action_url=f"/tasks/{task.id}",
                        )
                    )
                    count += 1
                except Exception as e:
                    logger.debug("Overdue notif skipped (likely duplicate)", task_id=task.id, error=str(e))

        if count:
            logger.info("Overdue notifications sent", count=count, total_tasks=len(tasks))


async def _run_reminder_check() -> None:
    """
    Send TASK_DUE_SOON reminders:
      - 1-hour window: tasks due in next 60 minutes
      - 24-hour window: tasks due tomorrow (±30 min)
    """
    from app.db.session import AsyncSessionLocal
    from app.models.task import Task, TaskStatus
    from app.services.notification import NotificationService
    from app.schemas.notification import NotificationCreate
    from app.models.notification import NotificationType

    now = datetime.utcnow()

    windows = [
        ("1h",  now + timedelta(hours=1),  now + timedelta(hours=1,  minutes=15), 1),
        ("24h", now + timedelta(hours=23), now + timedelta(hours=25),             24),
    ]

    async with AsyncSessionLocal() as db:
        notif_service = NotificationService(db)

        for label, window_start, window_end, hours in windows:
            result = await db.execute(
                select(Task).where(
                    Task.due_date >= window_start,
                    Task.due_date <= window_end,
                    Task.status.not_in([TaskStatus.DONE, TaskStatus.CANCELLED]),
                )
            )
            tasks = result.scalars().all()

            for task in tasks:
                recipients = []
                if task.primary_assignee_id:
                    recipients.append(task.primary_assignee_id)

                for uid in recipients:
                    try:
                        await notif_service.create(
                            NotificationCreate(
                                user_id=uid,
                                dedupe_key=f"reminder:{label}:{task.id}:{uid}",
                                notification_type=NotificationType.TASK_DUE_SOON,
                                title=f"⏰ Due in {hours} hour{'s' if hours > 1 else ''}",
                                message=f"'{task.title}' is due soon.",
                                task_id=task.id,
                                project_id=task.project_id,
                                action_url=f"/tasks/{task.id}",
                            )
                        )
                    except Exception:
                        pass  # Already reminded


async def _cleanup_old_notifications() -> None:
    """Delete read notifications older than 60 days."""
    from app.db.session import AsyncSessionLocal
    from app.services.notification import NotificationService

    async with AsyncSessionLocal() as db:
        notif_service = NotificationService(db)
        # Use a placeholder user_id – the service's delete_old_notifications
        # accepts user_id but we call it per-user. Here we expose a broader cleanup.
        # Instead, raw delete for all users:
        from sqlalchemy import delete as sa_delete
        from app.models.notification import Notification
        cutoff = datetime.utcnow() - timedelta(days=60)
        result = await db.execute(
            sa_delete(Notification).where(
                Notification.is_read == True,
                Notification.created_at < cutoff,
            )
        )
        await db.commit()
        deleted = result.rowcount
        if deleted:
            logger.info("Old notifications cleaned up", deleted=deleted)


def start_scheduler() -> None:
    """
    Start APScheduler (AsyncIOScheduler) with all background jobs.
    Call this from the FastAPI lifespan startup.
    """
    try:
        from apscheduler.schedulers.asyncio import AsyncIOScheduler
    except ImportError:
        logger.warning(
            "APScheduler not installed — background jobs disabled. "
            "Run: pip install apscheduler"
        )
        return

    scheduler = AsyncIOScheduler(timezone="UTC")

    # Overdue check: every 5 minutes
    scheduler.add_job(
        _run_overdue_check,
        trigger="interval",
        minutes=5,
        id="overdue_check",
        max_instances=1,
        misfire_grace_time=60,
    )

    # Due-soon reminder: every 15 minutes
    scheduler.add_job(
        _run_reminder_check,
        trigger="interval",
        minutes=15,
        id="reminder_check",
        max_instances=1,
        misfire_grace_time=60,
    )

    # Cleanup: daily at 00:05 UTC
    scheduler.add_job(
        _cleanup_old_notifications,
        trigger="cron",
        hour=0,
        minute=5,
        id="notification_cleanup",
        max_instances=1,
    )

    scheduler.start()
    logger.info("Background scheduler started", jobs=["overdue_check", "reminder_check", "notification_cleanup"])
    return scheduler
