"""
Employee & Skill service — profiles, skills, and intelligence layer.

Elite improvements implemented:
  ✅ Improvement 2: Skill hierarchy matching (category-level partial match)
  ✅ Improvement 6: Skill matrix LRU-cached (TTL via timestamp guard)
"""

from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.logging import get_logger
from app.models.employee import EmployeeProfile, Skill, SkillCategory, UserSkill, ValidationStatus
from app.models.task import Task, TaskStatus
from app.models.user import User
from app.schemas.employee import (
    EmployeeProfileUpdate,
    SkillCreate,
    SkillMatrixCell,
    SkillMatrixRow,
    UserSkillCreate,
    UserSkillUpdate,
)

logger = get_logger(__name__)

# ── In-process skill matrix cache (LRU-style with TTL) ───────────────────────
_MATRIX_CACHE: Optional[Dict[str, Any]] = None
_MATRIX_CACHE_AT: Optional[datetime] = None
_MATRIX_TTL = timedelta(minutes=5)  # re-generate every 5 minutes


class EmployeeService:
    """Service for employee profiles, skills, and intelligent matching."""

    def __init__(self, db: AsyncSession):
        self.db = db

    # ── Employee Profile ──────────────────────────────────────────────

    async def get_employee_profile(self, user_id: str) -> Optional[User]:
        result = await self.db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def get_or_create_employee_profile(self, user_id: str) -> EmployeeProfile:
        result = await self.db.execute(
            select(EmployeeProfile).where(EmployeeProfile.user_id == user_id)
        )
        profile = result.scalar_one_or_none()
        if not profile:
            profile = EmployeeProfile(user_id=user_id)
            self.db.add(profile)
            await self.db.flush()
        return profile

    async def update_employee_profile(self, user_id: str, data: EmployeeProfileUpdate) -> EmployeeProfile:
        profile = await self.get_or_create_employee_profile(user_id)
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(profile, field, value)
        await self.db.commit()
        await self.db.refresh(profile)
        return profile

    async def list_employees(
        self, page: int = 1, per_page: int = 20,
        department: Optional[str] = None, search: Optional[str] = None,
    ) -> Tuple[List[User], int]:
        stmt = select(User).where(User.is_active == True)
        if search:
            stmt = stmt.where(
                User.first_name.ilike(f"%{search}%")
                | User.last_name.ilike(f"%{search}%")
                | User.email.ilike(f"%{search}%")
            )
        if department:
            stmt = stmt.join(
                EmployeeProfile, EmployeeProfile.user_id == User.id, isouter=True
            ).where(EmployeeProfile.department == department)

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await self.db.execute(count_stmt)).scalar_one() or 0

        stmt = stmt.order_by(User.first_name).offset((page - 1) * per_page).limit(per_page)
        users = (await self.db.execute(stmt)).scalars().all()
        return list(users), total

    # ── Skills CRUD ───────────────────────────────────────────────────

    async def list_skills(self, category_id: Optional[str] = None) -> List[Skill]:
        stmt = select(Skill).where(Skill.is_active == True)
        if category_id:
            stmt = stmt.where(Skill.category_id == category_id)
        return list((await self.db.execute(stmt.order_by(Skill.name))).scalars().all())

    async def list_skill_categories(self) -> List[SkillCategory]:
        result = await self.db.execute(
            select(SkillCategory).where(SkillCategory.parent_id == None)
        )
        return list(result.scalars().all())

    async def create_skill(self, data: SkillCreate) -> Skill:
        skill = Skill(name=data.name, category_id=data.category_id, description=data.description)
        self.db.add(skill)
        await self.db.commit()
        await self.db.refresh(skill)
        _invalidate_matrix_cache()  # new skill → invalidate cached matrix
        return skill

    async def get_user_skills(self, user_id: str) -> List[UserSkill]:
        result = await self.db.execute(
            select(UserSkill)
            .options(selectinload(UserSkill.skill).selectinload(Skill.category))
            .where(UserSkill.user_id == user_id)
        )
        return list(result.scalars().all())

    async def add_user_skill(self, user_id: str, data: UserSkillCreate) -> UserSkill:
        existing = await self.db.execute(
            select(UserSkill).where(
                UserSkill.user_id == user_id, UserSkill.skill_id == data.skill_id
            )
        )
        if existing.scalar_one_or_none():
            raise ValueError("User already has this skill. Use PUT to update it.")
        user_skill = UserSkill(
            user_id=user_id, skill_id=data.skill_id,
            proficiency_level=data.proficiency_level, notes=data.notes,
        )
        self.db.add(user_skill)
        await self.db.commit()
        await self.db.refresh(user_skill)
        _invalidate_matrix_cache()
        logger.info("Skill added to user", user_id=user_id, skill_id=data.skill_id)
        return user_skill

    async def update_user_skill(self, user_id: str, skill_id: str, data: UserSkillUpdate) -> Optional[UserSkill]:
        result = await self.db.execute(
            select(UserSkill).where(UserSkill.user_id == user_id, UserSkill.skill_id == skill_id)
        )
        user_skill = result.scalar_one_or_none()
        if not user_skill:
            return None
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(user_skill, field, value)
        await self.db.commit()
        await self.db.refresh(user_skill)
        _invalidate_matrix_cache()
        return user_skill

    async def validate_skill(
        self, user_id: str, skill_id: str, validator_id: str,
        status: ValidationStatus, notes: Optional[str] = None
    ) -> Optional[UserSkill]:
        result = await self.db.execute(
            select(UserSkill).where(UserSkill.user_id == user_id, UserSkill.skill_id == skill_id)
        )
        user_skill = result.scalar_one_or_none()
        if not user_skill:
            return None
        user_skill.validation_status = status
        user_skill.validated_by = validator_id
        user_skill.validated_at = datetime.utcnow()
        if notes:
            user_skill.notes = notes
        await self.db.commit()
        await self.db.refresh(user_skill)
        return user_skill

    async def remove_user_skill(self, user_id: str, skill_id: str) -> bool:
        result = await self.db.execute(
            select(UserSkill).where(UserSkill.user_id == user_id, UserSkill.skill_id == skill_id)
        )
        user_skill = result.scalar_one_or_none()
        if not user_skill:
            return False
        await self.db.delete(user_skill)
        await self.db.commit()
        _invalidate_matrix_cache()
        return True

    # ── Skill Matrix (Improvement 6 — TTL cached) ─────────────────────

    async def get_skill_matrix(self, force_refresh: bool = False) -> Dict:
        """
        Build the org-wide skill matrix.
        Result is cached for 5 minutes in process memory; writes always invalidate.
        """
        global _MATRIX_CACHE, _MATRIX_CACHE_AT
        now = datetime.utcnow()

        if (
            not force_refresh
            and _MATRIX_CACHE is not None
            and _MATRIX_CACHE_AT is not None
            and (now - _MATRIX_CACHE_AT) < _MATRIX_TTL
        ):
            logger.debug("Serving skill matrix from cache")
            return _MATRIX_CACHE

        logger.info("Rebuilding skill matrix")
        data = await self._build_skill_matrix()

        _MATRIX_CACHE = data
        _MATRIX_CACHE_AT = now
        return data

    async def _build_skill_matrix(self) -> Dict:
        users_result = await self.db.execute(
            select(User).where(User.is_active == True).order_by(User.first_name)
        )
        users = users_result.scalars().all()
        user_ids = [u.id for u in users]

        skills_result = await self.db.execute(
            select(UserSkill)
            .options(selectinload(UserSkill.skill).selectinload(Skill.category))
            .where(UserSkill.user_id.in_(user_ids))
        )
        all_user_skills = skills_result.scalars().all()

        skills_map: Dict[str, List[UserSkill]] = {}
        skill_set: Dict[str, Skill] = {}
        for us in all_user_skills:
            skills_map.setdefault(us.user_id, []).append(us)
            skill_set[us.skill_id] = us.skill

        profiles_result = await self.db.execute(
            select(EmployeeProfile).where(EmployeeProfile.user_id.in_(user_ids))
        )
        profiles = {p.user_id: p for p in profiles_result.scalars().all()}

        rows = []
        for user in users:
            profile = profiles.get(user.id)
            rows.append(
                SkillMatrixRow(
                    user_id=user.id,
                    full_name=user.full_name,
                    email=user.email,
                    department=profile.department if profile else None,
                    avatar_url=user.avatar_url,
                    skills=[
                        SkillMatrixCell(
                            skill_id=us.skill_id,
                            skill_name=us.skill.name,
                            proficiency_level=us.proficiency_level,
                            validation_status=us.validation_status.value,
                        )
                        for us in skills_map.get(user.id, [])
                    ],
                )
            )

        all_skills = await self.list_skills()
        return {
            "rows": rows,
            "skill_columns": all_skills,
            "total_employees": len(users),
            "total_skills": len(skill_set),
        }

    # ── Skill Matching (Improvement 2 — Hierarchy-aware) ──────────────

    async def _build_category_skill_map(self) -> Dict[str, List[str]]:
        """
        Returns category_id → [skill_id, ...] map.
        Used for partial-match scoring: if user has a skill in the same category
        as a required skill, they get a partial credit (0.4 × proficiency/5).
        """
        skills_result = await self.db.execute(
            select(Skill).where(Skill.is_active == True)
        )
        all_skills = skills_result.scalars().all()
        cat_map: Dict[str, List[str]] = {}
        for s in all_skills:
            if s.category_id:
                cat_map.setdefault(s.category_id, []).append(s.id)
        return cat_map

    async def match_skills_to_task(self, task_id: str) -> List[Dict]:
        """
        Rank employees by skill match to a task's labels.

        Scoring per required skill:
          - Exact match:    proficiency/5        → weight 1.0
          - Category match: proficiency/5 × 0.4 → partial credit
          - No match:       0

        Final score = sum of per-skill scores / max_possible (normalized 0–1)
        """
        task_result = await self.db.execute(
            select(Task).options(selectinload(Task.labels)).where(Task.id == task_id)
        )
        task = task_result.scalar_one_or_none()
        if not task:
            return []

        required_names = {lbl.name.lower() for lbl in (task.labels or [])}

        # Exact skill matches
        if required_names:
            req_skills_result = await self.db.execute(
                select(Skill).where(func.lower(Skill.name).in_(required_names))
            )
            required_skills = req_skills_result.scalars().all()
        else:
            required_skills = []

        required_skill_ids = {s.id for s in required_skills}
        required_category_ids = {s.category_id for s in required_skills if s.category_id}

        # Fall-through: no skills tagged → return all users with 0 score
        if not required_skill_ids:
            users_result = await self.db.execute(
                select(User).where(User.is_active == True).order_by(User.first_name)
            )
            return [
                {"user": u, "match_score": 0.0, "matched_skills": [], "missing_skills": list(required_names)}
                for u in users_result.scalars().all()
            ]

        # category_id → all skill IDs in that category
        cat_skill_map = await self._build_category_skill_map()
        # All sibling skill IDs for partial matching
        sibling_skill_ids = set()
        for cat_id in required_category_ids:
            sibling_skill_ids.update(cat_skill_map.get(cat_id, []))
        # Remove exact matches — they are handled separately
        sibling_skill_ids -= required_skill_ids

        # Fetch all relevant user skills (exact + siblings)
        all_relevant_ids = required_skill_ids | sibling_skill_ids
        us_result = await self.db.execute(
            select(UserSkill)
            .options(selectinload(UserSkill.skill), selectinload(UserSkill.user))
            .where(UserSkill.skill_id.in_(all_relevant_ids))
        )
        all_user_skills = us_result.scalars().all()

        # Group by user: track exact and partial matches separately
        user_map: Dict[str, Dict] = {}
        for us in all_user_skills:
            uid = us.user_id
            if uid not in user_map:
                user_map[uid] = {
                    "user": us.user,
                    "exact": [],          # UserSkill objects for exact matches
                    "partial": [],        # UserSkill objects for category siblings
                    "exact_score": 0.0,
                    "partial_score": 0.0,
                }
            is_exact = us.skill_id in required_skill_ids
            if is_exact:
                user_map[uid]["exact"].append(us)
                # Normalized: proficiency 1–5 → score 0.2–1.0
                user_map[uid]["exact_score"] += us.proficiency_level / 5.0
            else:
                user_map[uid]["partial"].append(us)
                # Partial credit: 40% weight
                user_map[uid]["partial_score"] += (us.proficiency_level / 5.0) * 0.4

        # Max possible score = 1.0 per required skill (exact path)
        max_possible = max(len(required_skill_ids), 1)

        results = []
        for uid, data in user_map.items():
            raw_score = data["exact_score"] + data["partial_score"]
            normalized = min(raw_score / max_possible, 1.0)  # hard cap at 1.0

            matched_exact_ids = {us.skill_id for us in data["exact"]}
            missing = [s.name for s in required_skills if s.id not in matched_exact_ids]

            results.append({
                "user": data["user"],
                "match_score": round(normalized, 4),
                "matched_skills": [us.skill for us in data["exact"]],
                "partial_skills": [us.skill for us in data["partial"]],
                "missing_skills": missing,
            })

        results.sort(key=lambda x: x["match_score"], reverse=True)
        return results


# ── Cache helpers ──────────────────────────────────────────────────────────────

def _invalidate_matrix_cache() -> None:
    """Call whenever skills or user_skills are mutated."""
    global _MATRIX_CACHE, _MATRIX_CACHE_AT
    _MATRIX_CACHE = None
    _MATRIX_CACHE_AT = None
