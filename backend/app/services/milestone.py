"""Milestone service — CRUD and risk analysis."""

from datetime import datetime
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.models.milestone import Milestone, MilestoneRisk, MilestoneStatus

logger = get_logger(__name__)


class MilestoneService:
    """Service for milestone management."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, milestone_id: str) -> Optional[Milestone]:
        result = await self.db.execute(select(Milestone).where(Milestone.id == milestone_id))
        return result.scalar_one_or_none()

    async def list_by_project(self, project_id: str) -> List[Milestone]:
        result = await self.db.execute(
            select(Milestone).where(Milestone.project_id == project_id).order_by(Milestone.due_date)
        )
        return list(result.scalars().all())

    async def create(self, data: dict) -> Milestone:
        milestone = Milestone(**data)
        self.db.add(milestone)
        await self.db.commit()
        await self.db.refresh(milestone)
        # Compute risk on creation
        await self._recompute_risk(milestone)
        return milestone

    async def update(self, milestone_id: str, data: dict) -> Optional[Milestone]:
        milestone = await self.get_by_id(milestone_id)
        if not milestone:
            return None
        for key, val in data.items():
            setattr(milestone, key, val)
        milestone.updated_at = datetime.utcnow()
        await self.db.commit()
        await self.db.refresh(milestone)
        await self._recompute_risk(milestone)
        return milestone

    async def delete(self, milestone_id: str) -> bool:
        milestone = await self.get_by_id(milestone_id)
        if not milestone:
            return False
        await self.db.delete(milestone)
        await self.db.commit()
        return True

    async def _recompute_risk(self, milestone: Milestone) -> None:
        """Automatically set risk_indicator based on due date and completion."""
        if not milestone.due_date:
            return
        now = datetime.utcnow()
        days_left = (milestone.due_date - now).days
        completion = milestone.completion_percentage

        if milestone.status == MilestoneStatus.COMPLETED:
            milestone.risk_indicator = MilestoneRisk.LOW
        elif days_left < 0:
            milestone.risk_indicator = MilestoneRisk.CRITICAL
        elif days_left <= 3 and completion < 80:
            milestone.risk_indicator = MilestoneRisk.HIGH
        elif days_left <= 7 and completion < 50:
            milestone.risk_indicator = MilestoneRisk.MEDIUM
        else:
            milestone.risk_indicator = MilestoneRisk.LOW

        # Set status to AT_RISK if needed
        if (milestone.risk_indicator in (MilestoneRisk.HIGH, MilestoneRisk.CRITICAL)
                and milestone.status not in (MilestoneStatus.COMPLETED, MilestoneStatus.MISSED)):
            milestone.status = MilestoneStatus.AT_RISK

        await self.db.commit()
