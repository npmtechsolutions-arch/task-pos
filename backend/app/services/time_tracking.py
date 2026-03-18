"""Time tracking and timesheet service."""

from datetime import date, datetime
from typing import Dict, Any, List

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.task import Task, TimeEntry
from app.models.timesheet import Timesheet, TimesheetEntry, TimesheetStatus

class TimeTrackingService:
    """Service to handle time logging, estimation variance, and timesheet flows."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def log_time(self, task_id: str, user_id: str, duration_minutes: int, description: str = "") -> TimeEntry:
        """
        Create a new time entry, update the task's actual_hours, and update the daily TimesheetEntry.
        """
        # Fetch task
        stmt = select(Task).where(Task.id == task_id)
        result = await self.db.execute(stmt)
        task = result.scalar_one()

        entry = TimeEntry(
            task_id=task_id,
            user_id=user_id,
            started_at=datetime.utcnow(),
            duration_minutes=duration_minutes,
            description=description,
            is_billable=True
        )
        self.db.add(entry)

        # Update actual task hours
        duration_hours = duration_minutes / 60.0
        task.actual_hours += duration_hours

        # Update Timesheet aggregation
        await self._upsert_timesheet_entry(user_id, task_id, task.project_id, duration_hours, description)
        
        await self.db.flush()
        return entry

    async def _upsert_timesheet_entry(self, user_id: str, task_id: str, project_id: str, hours: float, description: str) -> None:
        """Internally manage weekly timesheet rows."""
        today = date.today()
        
        # 1. Find or create week Timesheet
        from datetime import timedelta
        # Get start of week (Monday)
        start_of_week = today - timedelta(days=today.weekday())
        end_of_week = start_of_week + timedelta(days=6)

        ts_stmt = select(Timesheet).where(
            Timesheet.user_id == user_id,
            Timesheet.period_start == start_of_week
        )
        ts_res = await self.db.execute(ts_stmt)
        timesheet = ts_res.scalar_one_or_none()

        if not timesheet:
            timesheet = Timesheet(
                user_id=user_id,
                period_start=start_of_week,
                period_end=end_of_week,
                status=TimesheetStatus.DRAFT,
                total_hours=0.0,
                billable_hours=0.0
            )
            self.db.add(timesheet)
            await self.db.flush()

        # 2. Upsert daily TimesheetEntry
        te_stmt = select(TimesheetEntry).where(
            TimesheetEntry.timesheet_id == timesheet.id,
            TimesheetEntry.date_logged == today,
            TimesheetEntry.task_id == task_id
        )
        te_res = await self.db.execute(te_stmt)
        entry = te_res.scalar_one_or_none()

        if entry:
            entry.hours += hours
            if description and not entry.description:
                entry.description = description
        else:
            new_entry = TimesheetEntry(
                timesheet_id=timesheet.id,
                task_id=task_id,
                project_id=project_id,
                date_logged=today,
                hours=hours,
                description=description
            )
            self.db.add(new_entry)

        timesheet.total_hours += hours
        timesheet.billable_hours += hours

    @classmethod
    def calculate_variance(cls, estimated_hours: float, actual_hours: float) -> Dict[str, Any]:
        """
        Calculate estimation variance to improve future planning accuracy.
        Variance = Actual Time - Estimated Time.
        """
        if not estimated_hours:
            return {
                "estimated": 0.0,
                "actual": actual_hours,
                "variance_hours": actual_hours,
                "variance_percentage": 100.0 if actual_hours > 0 else 0.0,
                "accuracy": "No Estimate"
            }

        variance = actual_hours - estimated_hours
        variance_pct = (variance / estimated_hours) * 100.0

        if variance_pct > 20.0:
            accuracy = "Underestimated"
        elif variance_pct < -20.0:
            accuracy = "Overestimated"
        else:
            accuracy = "Accurate"

        return {
            "estimated": round(estimated_hours, 2),
            "actual": round(actual_hours, 2),
            "variance_hours": round(variance, 2),
            "variance_percentage": round(variance_pct, 1),
            "accuracy": accuracy
        }
