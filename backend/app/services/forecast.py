"""
Resource Forecasting service.

Projects future capacity vs load week-by-week using planned (open) tasks
and historical throughput patterns.
"""

from datetime import datetime, timedelta
from typing import Dict, List, Optional

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.models.capacity import UserCapacity
from app.models.task import Task, TaskStatus
from app.models.user import User
from app.schemas.analytics import ForecastResponse, ForecastWeek

logger = get_logger(__name__)


class ForecastService:
    """Projects future workload vs capacity for resource forecasting."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_org_forecast(self, weeks: int = 8) -> ForecastResponse:
        """
        Org-level weekly forecast for the next N weeks.

        Algorithm:
          1. Load all active users + their capacities (single query)
          2. Load all open tasks with due dates (single query)
          3. For each future ISO week:
             - Sum up task hours due that week
             - Compare to total org capacity
             - Identify overloaded users (allocated > own capacity)
          4. Return week-by-week surplus/shortage list
        """
        now = datetime.utcnow()

        # ── 1. All active users + capacities ─────────────────────────────────
        users_result = await self.db.execute(
            select(
                User.id,
                User.first_name,
                User.last_name,
                func.coalesce(UserCapacity.weekly_hours, 40.0).label("cap_h"),
                func.coalesce(UserCapacity.overhead_percentage, 20.0).label("overhead"),
            )
            .outerjoin(UserCapacity, UserCapacity.user_id == User.id)
            .where(User.is_active == True)
        )
        user_rows = users_result.all()

        # user_id → effective weekly hours
        user_caps: Dict[str, float] = {
            row.id: float(row.cap_h) * (1 - float(row.overhead) / 100)
            for row in user_rows
        }
        user_names: Dict[str, str] = {
            row.id: f"{row.first_name or ''} {row.last_name or ''}".strip()
            for row in user_rows
        }
        total_org_capacity = sum(user_caps.values())

        # ── 2. All open tasks with due dates ──────────────────────────────────
        tasks_result = await self.db.execute(
            select(
                Task.primary_assignee_id,
                Task.due_date,
                Task.estimated_hours,
            ).where(
                and_(
                    Task.status.not_in([TaskStatus.DONE, TaskStatus.CANCELLED]),
                    Task.due_date != None,
                    Task.due_date >= now,
                    Task.due_date <= now + timedelta(weeks=weeks),
                )
            )
        )
        open_tasks = tasks_result.all()

        # ── 3. Bucket tasks into ISO weeks ────────────────────────────────────
        # week_key (YYYY-Www) → user_id → hours
        week_user_hours: Dict[str, Dict[str, float]] = {}
        for task in open_tasks:
            if not task.due_date:
                continue
            due = task.due_date if isinstance(task.due_date, datetime) else datetime.combine(task.due_date, datetime.min.time())
            iso = due.isocalendar()
            week_key = f"{iso[0]}-W{iso[1]:02d}"
            uid = task.primary_assignee_id
            hours = float(task.estimated_hours or 4.0)  # default 4h if not estimated

            if week_key not in week_user_hours:
                week_user_hours[week_key] = {}
            week_user_hours[week_key][uid] = week_user_hours[week_key].get(uid, 0) + hours

        # ── 4. Build weekly forecast series ──────────────────────────────────
        forecast: List[ForecastWeek] = []
        for w in range(weeks):
            week_start = now + timedelta(weeks=w)
            # Monday of that week
            monday = week_start - timedelta(days=week_start.weekday())
            iso = monday.isocalendar()
            week_key = f"{iso[0]}-W{iso[1]:02d}"

            user_alloc = week_user_hours.get(week_key, {})
            predicted_hours = sum(user_alloc.values())
            surplus = total_org_capacity - predicted_hours

            # Overloaded: any user whose allocation > their capacity
            overloaded = [
                user_names.get(uid, uid)
                for uid, hours in user_alloc.items()
                if hours > user_caps.get(uid, 40.0)
            ]

            forecast.append(ForecastWeek(
                week_start=monday.strftime("%Y-%m-%d"),
                predicted_hours=round(predicted_hours, 1),
                capacity_hours=round(total_org_capacity, 1),
                surplus_hours=round(surplus, 1),
                overloaded_users=overloaded,
            ))

        return ForecastResponse(
            user_id=None,
            weeks=weeks,
            forecast=forecast,
        )

    async def get_user_forecast(self, user_id: str, weeks: int = 8) -> ForecastResponse:
        """Per-user weekly forecast."""
        now = datetime.utcnow()

        cap_row = await self.db.execute(
            select(
                func.coalesce(UserCapacity.weekly_hours, 40.0).label("cap"),
                func.coalesce(UserCapacity.overhead_percentage, 20.0).label("overhead"),
            ).where(UserCapacity.user_id == user_id)
        )
        row = cap_row.one_or_none()
        effective_cap = float(row.cap) * (1 - float(row.overhead) / 100) if row else 32.0

        tasks_result = await self.db.execute(
            select(Task.due_date, Task.estimated_hours).where(
                and_(
                    Task.primary_assignee_id == user_id,
                    Task.status.not_in([TaskStatus.DONE, TaskStatus.CANCELLED]),
                    Task.due_date != None,
                    Task.due_date >= now,
                    Task.due_date <= now + timedelta(weeks=weeks),
                )
            )
        )
        open_tasks = tasks_result.all()

        # Bucket by week
        week_hours: Dict[str, float] = {}
        for task in open_tasks:
            due = task.due_date
            if not due:
                continue
            if not isinstance(due, datetime):
                due = datetime.combine(due, datetime.min.time())
            iso = due.isocalendar()
            wk = f"{iso[0]}-W{iso[1]:02d}"
            week_hours[wk] = week_hours.get(wk, 0) + float(task.estimated_hours or 4.0)

        forecast: List[ForecastWeek] = []
        for w in range(weeks):
            ws = now + timedelta(weeks=w)
            monday = ws - timedelta(days=ws.weekday())
            iso = monday.isocalendar()
            wk = f"{iso[0]}-W{iso[1]:02d}"
            ph = week_hours.get(wk, 0.0)
            forecast.append(ForecastWeek(
                week_start=monday.strftime("%Y-%m-%d"),
                predicted_hours=round(ph, 1),
                capacity_hours=round(effective_cap, 1),
                surplus_hours=round(effective_cap - ph, 1),
                overloaded_users=[] if ph <= effective_cap else [user_id],
            ))

        return ForecastResponse(user_id=user_id, weeks=weeks, forecast=forecast)
