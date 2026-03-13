"""Celery configuration and tasks."""

from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "projectflow",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=[
        "app.tasks.notifications",
        "app.tasks.reports",
        "app.tasks.exports",
    ],
)

# Celery configuration
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,  # 1 hour
    worker_prefetch_multiplier=1,
    task_acks_late=True,
    result_expires=86400,  # 24 hours
)

# Beat schedule for periodic tasks
celery_app.conf.beat_schedule = {
    "cleanup-old-notifications": {
        "task": "app.tasks.notifications.cleanup_old_notifications",
        "schedule": 86400.0,  # Daily
    },
    "send-due-date-reminders": {
        "task": "app.tasks.notifications.send_due_date_reminders",
        "schedule": 3600.0,  # Hourly
    },
}
