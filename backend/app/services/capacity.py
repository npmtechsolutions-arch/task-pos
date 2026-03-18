"""Capacity prediction and workload constraint service."""

from datetime import datetime
from typing import Dict, Any

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.task import Task, TaskStatus

class CapacityService:
    """Service to predict user workload and prevent overallocation."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_user_capacity(self, user_id: str, week_start: datetime, week_end: datetime) -> Dict[str, Any]:
        """
        Calculate user's workload for a given timeframe based on estimated effort of their assigned tasks.
        Expects a 40-hour work week by default.
        """
        # Assumptions for a standard week
        STANDARD_WEEK_CAPACITY_HOURS = 40.0

        # Query all incomplete tasks assigned to the user due within (or spanning) the timeframe
        stmt = select(func.sum(Task.estimated_hours)).where(
            and_(
                Task.primary_assignee_id == user_id,
                Task.status.notin_([TaskStatus.DONE, TaskStatus.CANCELLED]),
                # If the task is due in this period, we count its remaining estimate
                Task.due_date >= week_start,
                Task.due_date <= week_end
            )
        )
        
        result = await self.db.execute(stmt)
        planned_hours = result.scalar_one() or 0.0

        utilization_percentage = (planned_hours / STANDARD_WEEK_CAPACITY_HOURS) * 100.0

        status = "OK"
        if utilization_percentage > 100.0:
            status = "OVERALLOCATED"
        elif utilization_percentage > 85.0:
            status = "WARNING"
            
        return {
            "user_id": user_id,
            "timeframe": f"{week_start.date()} to {week_end.date()}",
            "capacity_hours": STANDARD_WEEK_CAPACITY_HOURS,
            "planned_hours": planned_hours,
            "utilization": round(utilization_percentage, 1),
            "status": status
        }

    async def check_allocation_threshold(self, user_id: str, new_estimated_hours: float, current_date: datetime) -> Dict[str, Any]:
        """
        Check if adding X hours to a user's current week will cross the overallocation threshold.
        """
        week_start = current_date  # Simplified: assumes current day forward for the next 7 days
        from datetime import timedelta
        week_end = current_date + timedelta(days=7)

        current_cap = await self.get_user_capacity(user_id, week_start, week_end)
        
        projected_hours = current_cap["planned_hours"] + new_estimated_hours
        projected_utilization = (projected_hours / current_cap["capacity_hours"]) * 100.0
        
        return {
            "is_safe": projected_utilization <= 100.0,
            "current_utilization": current_cap["utilization"],
            "projected_utilization": round(projected_utilization, 1),
            "projected_hours": projected_hours
        }
