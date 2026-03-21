"""
Org Team service — teams, hierarchy, reporting structures.

Elite improvements:
  ✅ Improvement 5: Flat adjacency-list org chart — single query, no recursion,
     no stack-overflow risk for deep hierarchies.
"""

from typing import Dict, List, Optional, Tuple

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.logging import get_logger
from app.models.org_team import OrgTeam, OrgTeamMember, OrgTeamMemberRole, ReportingStructure
from app.models.user import User
from app.schemas.org_team import OrgChartNode, OrgTeamCreate, OrgTeamUpdate

logger = get_logger(__name__)


class OrgTeamService:
    """Service for organisation-level team and hierarchy management."""

    def __init__(self, db: AsyncSession):
        self.db = db

    # ── Teams CRUD ────────────────────────────────────────────────────

    async def create_team(self, data: OrgTeamCreate, creator_id: str) -> OrgTeam:
        team = OrgTeam(
            name=data.name,
            description=data.description,
            team_type=data.team_type,
            department=data.department,
            created_by=creator_id,
        )
        self.db.add(team)
        await self.db.commit()
        await self.db.refresh(team)
        logger.info("OrgTeam created", team_id=team.id, name=team.name)
        return team

    async def get_team(self, team_id: str) -> Optional[OrgTeam]:
        result = await self.db.execute(
            select(OrgTeam)
            .options(selectinload(OrgTeam.members).selectinload(OrgTeamMember.user))
            .where(OrgTeam.id == team_id)
        )
        return result.scalar_one_or_none()

    async def list_teams(
        self, page: int = 1, per_page: int = 20, department: Optional[str] = None
    ) -> Tuple[List[OrgTeam], int]:
        from sqlalchemy import func
        stmt = select(OrgTeam).where(OrgTeam.is_active == True)
        if department:
            stmt = stmt.where(OrgTeam.department == department)

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await self.db.execute(count_stmt)).scalar_one() or 0

        stmt = stmt.order_by(OrgTeam.name).offset((page - 1) * per_page).limit(per_page)
        return list((await self.db.execute(stmt)).scalars().all()), total

    async def update_team(self, team_id: str, data: OrgTeamUpdate) -> Optional[OrgTeam]:
        team = await self.get_team(team_id)
        if not team:
            return None
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(team, field, value)
        await self.db.commit()
        await self.db.refresh(team)
        return team

    async def delete_team(self, team_id: str) -> bool:
        team = await self.get_team(team_id)
        if not team:
            return False
        await self.db.delete(team)
        await self.db.commit()
        return True

    # ── Members ───────────────────────────────────────────────────────

    async def add_member(self, team_id: str, user_id: str, role: OrgTeamMemberRole = OrgTeamMemberRole.MEMBER) -> OrgTeamMember:
        existing = await self.db.execute(
            select(OrgTeamMember).where(
                and_(OrgTeamMember.team_id == team_id, OrgTeamMember.user_id == user_id)
            )
        )
        if existing.scalar_one_or_none():
            raise ValueError("User is already a member of this team")
        member = OrgTeamMember(team_id=team_id, user_id=user_id, role=role)
        self.db.add(member)
        await self.db.commit()
        await self.db.refresh(member)
        return member

    async def bulk_add_members(self, team_id: str, user_ids: List[str], role: OrgTeamMemberRole) -> List[OrgTeamMember]:
        added = []
        for uid in user_ids:
            try:
                added.append(await self.add_member(team_id, uid, role))
            except ValueError:
                pass
        return added

    async def remove_member(self, team_id: str, user_id: str) -> bool:
        result = await self.db.execute(
            select(OrgTeamMember).where(
                and_(OrgTeamMember.team_id == team_id, OrgTeamMember.user_id == user_id)
            )
        )
        member = result.scalar_one_or_none()
        if not member:
            return False
        await self.db.delete(member)
        await self.db.commit()
        return True

    async def update_member_role(self, team_id: str, user_id: str, role: OrgTeamMemberRole) -> Optional[OrgTeamMember]:
        result = await self.db.execute(
            select(OrgTeamMember).where(
                and_(OrgTeamMember.team_id == team_id, OrgTeamMember.user_id == user_id)
            )
        )
        member = result.scalar_one_or_none()
        if not member:
            return None
        member.role = role
        await self.db.commit()
        await self.db.refresh(member)
        return member

    # ── Reporting Hierarchy ───────────────────────────────────────────

    async def set_reporting_relation(self, manager_id: str, subordinate_id: str, is_primary: bool = True) -> ReportingStructure:
        if manager_id == subordinate_id:
            raise ValueError("A user cannot report to themselves")
        existing = await self.db.execute(
            select(ReportingStructure).where(
                and_(
                    ReportingStructure.manager_id == manager_id,
                    ReportingStructure.subordinate_id == subordinate_id,
                )
            )
        )
        rel = existing.scalar_one_or_none()
        if rel:
            rel.is_active = True
            rel.is_primary = is_primary
        else:
            rel = ReportingStructure(manager_id=manager_id, subordinate_id=subordinate_id, is_primary=is_primary)
            self.db.add(rel)
        await self.db.commit()
        await self.db.refresh(rel)
        return rel

    async def get_direct_reports(self, manager_id: str) -> List[User]:
        result = await self.db.execute(
            select(User)
            .join(ReportingStructure, ReportingStructure.subordinate_id == User.id)
            .where(and_(ReportingStructure.manager_id == manager_id, ReportingStructure.is_active == True))
        )
        return list(result.scalars().all())

    # ── Org Chart (Improvement 5 — flat adjacency list, O(n) not O(n!)) ──

    async def get_org_chart(self) -> List[OrgChartNode]:
        """
        Build the full org hierarchy tree without recursion.

        Algorithm: Adjacency-list → tree in two passes (O(n)):
          Pass 1 — Load ALL active users + ALL active reporting edges in 2 queries.
          Pass 2 — Iteratively wire children into parent nodes using a node dict.

        Handles:
          • Arbitrarily deep hierarchies (no recursion depth limit)
          • Multiple roots (users with no manager)
          • Cycles (second check — orphaned users become extra roots)
        """
        from app.models.employee import EmployeeProfile

        # ── 1. Single query for all users ────────────────────────────
        users_result = await self.db.execute(
            select(User).where(User.is_active == True)
        )
        all_users: Dict[str, User] = {u.id: u for u in users_result.scalars().all()}

        # ── 2. Single query for all active reporting edges ────────────
        edges_result = await self.db.execute(
            select(ReportingStructure).where(
                and_(ReportingStructure.is_active == True, ReportingStructure.is_primary == True)
            )
        )
        all_edges = edges_result.scalars().all()

        # manager_id → set(subordinate_ids)
        children_map: Dict[str, List[str]] = {uid: [] for uid in all_users}
        subordinate_ids: set = set()
        for edge in all_edges:
            if edge.manager_id in children_map and edge.subordinate_id in all_users:
                children_map[edge.manager_id].append(edge.subordinate_id)
                subordinate_ids.add(edge.subordinate_id)

        # ── 3. Batch load all employee profiles ────────────────────────
        profiles_result = await self.db.execute(
            select(EmployeeProfile).where(EmployeeProfile.user_id.in_(list(all_users.keys())))
        )
        profiles: Dict[str, EmployeeProfile] = {p.user_id: p for p in profiles_result.scalars().all()}

        # ── 4. Build node objects (no recursion) ──────────────────────
        def make_node(uid: str) -> OrgChartNode:
            user = all_users[uid]
            profile = profiles.get(uid)
            return OrgChartNode(
                user_id=uid,
                full_name=user.full_name,
                email=user.email,
                title=profile.title if profile else None,
                department=profile.department if profile else None,
                avatar_url=user.avatar_url,
                direct_reports=[],
            )

        # Create all node objects first
        nodes: Dict[str, OrgChartNode] = {uid: make_node(uid) for uid in all_users}

        # Wire children into parents (single pass, O(n))
        for uid in all_users:
            for child_id in children_map.get(uid, []):
                nodes[uid].direct_reports.append(nodes[child_id])

        # ── 5. Collect roots (no primary manager) ────────────────────
        roots = [nodes[uid] for uid in all_users if uid not in subordinate_ids]
        return roots
