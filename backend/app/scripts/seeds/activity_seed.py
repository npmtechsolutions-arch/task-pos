import logging
import uuid
import random
from typing import Dict, List
from datetime import datetime, timedelta
from faker import Faker
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tenant import Tenant
from app.models.user import User
from app.models.task import Task, TaskComment, TimeEntry

logger = logging.getLogger(__name__)
fake = Faker()

async def seed_activities(session: AsyncSession, tenant: Tenant, users: Dict[str, User], tasks: List[Task]):
    """Seed Comments, Notifications, Time Log, Calendar Events."""
    logger.info("Seeding Comments and Time Log...")
    
    all_users = list(users.values())
    
    for task in tasks:
        # Add 2-3 Comments per task
        num_comments = random.randint(2, 3)
        for i in range(num_comments):
            author = random.choice(all_users)
            comment = TaskComment(
                id=str(uuid.uuid4()),
                tenant_id=tenant.id,
                task_id=task.id,
                author_id=author.id,
                content=fake.paragraph()
            )
            session.add(comment)
            
        # Add 2 TimeEntries per task
        for i in range(2):
            user = random.choice(all_users)
            duration = random.randint(30, 180) # 30 min to 3 hours
            time_entry = TimeEntry(
                id=str(uuid.uuid4()),
                tenant_id=tenant.id,
                task_id=task.id,
                user_id=user.id,
                started_at=datetime.utcnow() - timedelta(days=random.randint(1, 10)),
                duration_minutes=duration,
                description=f"Worked on {task.title[:10]}..."
            )
            session.add(time_entry)
            
    await session.flush()
    logger.info("Created comments and time entries.")

    # Import CalendarEvent dynamically if it exists or use Notification
    try:
        from app.models.notification import Notification, NotificationType
        from app.models.calendar import CalendarEvent, CalendarEventType
        
        logger.info("Seeding Calendar Events and Notifications...")
        for user in all_users:
            for i in range(3):
                notification = Notification(
                    id=str(uuid.uuid4()),
                    user_id=user.id,
                    notification_type=NotificationType.TASK_ASSIGNED,
                    title="Task Update",
                    message=fake.sentence(),
                )
                session.add(notification)
                
            # Calendar Event
            event = CalendarEvent(
                id=str(uuid.uuid4()),
                title=random.choice(["Sprint Planning", "Review Meeting", "Standup"]),
                start_date=datetime.utcnow() + timedelta(days=random.randint(1, 5)),
                end_date=datetime.utcnow() + timedelta(days=random.randint(1, 5), hours=1),
                created_by=users["pm"].id,
                event_type=CalendarEventType.MEETING
            )
            session.add(event)
        await session.flush()
    except Exception as e:
        logger.warning(f"Skipping Notification/Calendar mock due to model mismatch: {e}")

