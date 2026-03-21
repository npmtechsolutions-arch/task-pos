"""
Capacity planning service — workload, availability, and smart assignment.

Elite improvements:
  ✅ Improvement 1: All component scores are strictly ∈ [0, 1] — safe for weighted sum
  ✅ Improvement 3: Time-based workload using deadline proximity + date-range allocation
"""

from datetime import date, datetime, timedelta
from typing import Dict, List, Optional

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.models.capacity import UserAvailability, UserCapacity
from app.models.employee import EmployeeProfile
from app.models.project import Project
from app.models.task import Task, TaskStatus
from app.models.user import User
from app.schemas.capacity import (
    AllocationBreakdown,
    SmartAssignmentCandidate,
    UserAvailabilityCreate,
    UserCapacityUpdate,
    WorkloadResponse,
)

logger = get_logger(__name__)

# ── Constants ─────────────────────────────────────────────────────────────────
MAX_TASK_COUNT_NORM = 20   # Tasks at or above this → workload_score = 0
DEADLINE_URGENCY_DAYS = 14  # Tasks due within 14 days get 1.5× weight


class CapacityService:
    """Workload, availability, and smart assignment engine."""

    def __init__(self, db: AsyncSession):
        self.db = db

    # ── Capacity Settings ─────────────────────────────────────────────

    async def get_or_create_capacity(self, user_id: str) -> UserCapacity:
        result = await self.db.execute(
            select(UserCapacity).where(UserCapacity.user_id == user_id)
        )
        cap = result.scalar_one_or_none()
        if not cap:
            cap = UserCapacity(user_id=user_id)
            self.db.add(cap)
            await self.db.flush()
        return cap

    async def update_capacity(self, user_id: str, data: UserCapacityUpdate) -> UserCapacity:
        cap = await self.get_or_create_capacity(user_id)
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(cap, field, value)
        await self.db.commit()
        await self.db.refresh(cap)
        return cap

    # ── Availability ──────────────────────────────────────────────────

    async def set_availability(self, user_id: str, data: UserAvailabilityCreate) -> UserAvailability:
        result = await self.db.execute(
            select(UserAvailability).where(
                and_(
                    UserAvailability.user_id == user_id,
                    UserAvailability.availability_date == data.availability_date,
                )
            )
        )
        avail = result.scalar_one_or_none()
        if avail:
            avail.status = data.status
            avail.available_hours = data.available_hours
            avail.notes = data.notes
        else:
            avail = UserAvailability(
                user_id=user_id,
                availability_date=data.availability_date,
                status=data.status,
                available_hours=data.available_hours,
                notes=data.notes,
            )
            self.db.add(avail)
        await self.db.commit()
        await self.db.refresh(avail)
        return avail

    async def get_availability_range(
        self, user_id: str, start_date: date, end_date: date
    ) -> List[UserAvailability]:
        result = await self.db.execute(
            select(UserAvailability).where(
                and_(
                    UserAvailability.user_id == user_id,
                    UserAvailability.availability_date >= start_date,
                    UserAvailability.availability_date <= end_date,
                )
            ).order_by(UserAvailability.availability_date)
        )
        return list(result.scalars().all())

    # ── Workload (Improvement 3 — time-based deadline weighting) ──────

    async def get_user_workload(self, user_id: str) -> WorkloadResponse:
        """
        Calculate current workload using deadline-proximity weighting.

        Algorithm:
        - Fetch all non-done, non-cancelled tasks for this user
        - For each task:
            • no due_date         → weight 1.0  (assume fills current cycle)
            • due in ≤ 14 days    → weight 1.5  (urgent — counts extra)
            • due in >14 days     → weight proportional to days_until_due / 30 (reduces urgency)
        - Effective allocated = sum(estimated_hours × weight)
        - utilization = effective_allocated / effective_weekly_capacity
        """
        user_result = await self.db.execute(select(User).where(User.id == user_id))
        user = user_result.scalar_one_or_none()
        if not user:
            raise ValueError(f"User {user_id} not found")

        cap = await self.get_or_create_capacity(user_id)
        effective_weekly = cap.weekly_hours * (1 - cap.overhead_percentage / 100)

        # Fetch all open tasks with project grouping
        tasks_result = await self.db.execute(
            select(Task).where(
                and_(
                    Task.primary_assignee_id == user_id,
                    Task.status.not_in([TaskStatus.DONE, TaskStatus.CANCELLED]),
                )
            )
        )
        open_tasks = tasks_result.scalars().all()

        now = datetime.utcnow().date()
        urgency_cutoff = now + timedelta(days=DEADLINE_URGENCY_DAYS)

        # Per-project aggregation
        project_buckets: Dict[str, Dict] = {}
        effective_allocated = 0.0

        for t in open_tasks:
            hours = t.estimated_hours or 0.0
            due = t.due_date.date() if t.due_date else None

            # Deadline-proximity weight → Improvement 3
            if due is None:
                weight = 1.0
            elif due <= now:
                weight = 2.0           # already overdue — full double weight
            elif due <= urgency_cutoff:
                weight = 1.5           # due within 14 days
            else:
                days_out = (due - now).days
                # smoothly decay: 14→30+ days maps weight 1.5 → 0.8
                weight = max(0.8, 1.5 - (days_out - DEADLINE_URGENCY_DAYS) / 60)

            weighted_hours = hours * weight
            effective_allocated += weighted_hours

            pid = t.project_id
            if pid not in project_buckets:
                project_buckets[pid] = {"hours": 0.0, "count": 0, "weighted": 0.0}
            project_buckets[pid]["hours"] += hours
            project_buckets[pid]["count"] += 1
            project_buckets[pid]["weighted"] += weighted_hours

        # Resolve project names
        breakdown = []
        for pid, info in project_buckets.items():
            proj_result = await self.db.execute(select(Project.name).where(Project.id == pid))
            proj_name = proj_result.scalar_one_or_none() or "Unknown Project"
            breakdown.append(
                AllocationBreakdown(
                    project_id=pid,
                    project_name=proj_name,
                    allocated_hours=round(info["hours"], 2),
                    task_count=info["count"],
                )
            )

        raw_alloc = sum(info["hours"] for info in project_buckets.values())
        utilization = round((effective_allocated / effective_weekly * 100), 1) if effective_weekly > 0 else 0.0

        return WorkloadResponse(
            user_id=user_id,
            full_name=user.full_name,
            avatar_url=user.avatar_url,
            capacity_hours_per_week=cap.weekly_hours,
            effective_capacity_hours=round(effective_weekly, 2),
            allocated_hours=round(raw_alloc, 2),
            utilization_percentage=utilization,
            available_hours=round(effective_weekly - raw_alloc, 2),
            is_overloaded=utilization > 100,
            project_breakdown=breakdown,
            open_task_count=len(open_tasks),
        )

    async def get_team_workload(self, user_ids: List[str], team_name: str = "Team") -> Dict:
        members = []
        for uid in user_ids:
            try:
                members.append(await self.get_user_workload(uid))
            except ValueError:
                continue
        overloaded = sum(1 for m in members if m.is_overloaded)
        avg_util = round(sum(m.utilization_percentage for m in members) / max(len(members), 1), 1)
        return {"team_name": team_name, "members": members, "overloaded_count": overloaded, "avg_utilization": avg_util}

    # ── Smart Assignment (Improvement 1 — all scores ∈ [0,1]) ─────────

    async def recommend_assignees(self, task_id: str, top_n: int = 5) -> List[SmartAssignmentCandidate]:
        """
        Rank users using 3 strictly normalized components (all ∈ [0, 1]):

          skill_score    (50%) — hierarchy-aware match score (already ∈ [0,1])
          avail_score    (30%) — 1 − clamp(utilization%, 0, 100) / 100
          workload_score (20%) — 1 − clamp(open_task_count, 0, MAX) / MAX

        All three are guaranteed ∈ [0, 1] before the weighted sum, so the
        final overall_score is also ∈ [0, 1].
        """
        from app.services.employee import EmployeeService
        employee_svc = EmployeeService(self.db)
        skill_results = await employee_svc.match_skills_to_task(task_id)

        task_result = await self.db.execute(select(Task).where(Task.id == task_id))
        task = task_result.scalar_one_or_none()
        if not task:
            return []

        candidates = []
        for sr in skill_results:
            user: User = sr["user"]
            try:
                workload = await self.get_user_workload(user.id)
            except Exception:
                continue

            # Improvement 1: guaranteed ∈ [0, 1]
            skill_score = float(min(max(sr["match_score"], 0.0), 1.0))
            avail_score = float(max(0.0, 1.0 - min(workload.utilization_percentage, 100.0) / 100.0))
            workload_score = float(max(0.0, 1.0 - min(workload.open_task_count, MAX_TASK_COUNT_NORM) / MAX_TASK_COUNT_NORM))

            # Weighted sum (already ∈ [0,1] because all components are)
            overall = round(0.50 * skill_score + 0.30 * avail_score + 0.20 * workload_score, 4)

            profile_result = await self.db.execute(
                select(EmployeeProfile).where(EmployeeProfile.user_id == user.id)
            )
            profile = profile_result.scalar_one_or_none()

            candidates.append(
                SmartAssignmentCandidate(
                    user_id=user.id,
                    full_name=user.full_name,
                    email=user.email,
                    avatar_url=user.avatar_url,
                    title=profile.title if profile else None,
                    department=profile.department if profile else None,
                    overall_score=overall,
                    skill_match_score=round(skill_score, 4),
                    availability_score=round(avail_score, 4),
                    workload_score=round(workload_score, 4),
                    matched_skill_count=len(sr["matched_skills"]),
                    utilization_percentage=workload.utilization_percentage,
                    available_hours=workload.available_hours,
                    matched_skills=[s.name for s in sr["matched_skills"]],
                    missing_skills=sr["missing_skills"],
                )
            )

        candidates.sort(key=lambda c: c.overall_score, reverse=True)
        return candidates[:top_n]
