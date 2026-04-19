import logging
import uuid
from typing import Dict, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.tenant import Tenant
from app.models.user import User
from app.models.hr_hierarchy import Department, HRRole, HRAssignment
from app.models.org_team import OrgTeam, OrgTeamType, OrgTeamMember, OrgTeamMemberRole

logger = logging.getLogger(__name__)

async def seed_org(session: AsyncSession, tenant: Tenant, users: Dict[str, User]) -> Dict[str, str]:
    """Seed Departments and Teams."""
    logger.info("Seeding Departments and Teams...")
    
    admin = users["admin"]
    pm = users["pm"]
    
    # 1. Departments
    dept_map = {}
    departments = ["Engineering", "Marketing", "HR", "Finance"]
    
    for dept_name in departments:
        result = await session.execute(select(Department).where(Department.name == dept_name))
        dept = result.scalars().first()
        
        if not dept:
            dept = Department(
                id=str(uuid.uuid4()),
                name=dept_name,
                manager_id=admin.id if dept_name == "Engineering" else None,
                created_by=admin.id
            )
            session.add(dept)
            logger.info(f"Created Department: {dept.name}")
        dept_map[dept_name] = dept

    await session.flush()
    
    # 2. Teams
    teams_data = [
        {"name": "Backend Team", "dept": "Engineering"},
        {"name": "Frontend Team", "dept": "Engineering"},
        {"name": "QA Team", "dept": "Engineering"}
    ]
    
    for t_data in teams_data:
        result = await session.execute(
            select(OrgTeam).where(OrgTeam.name == t_data["name"])
        )
        team = result.scalars().first()
        
        if not team:
            team = OrgTeam(
                id=str(uuid.uuid4()),
                tenant_id=tenant.id,
                name=t_data["name"],
                team_type=OrgTeamType.PERMANENT,
                department=t_data["dept"],
                created_by=admin.id
            )
            session.add(team)
            await session.flush()
            
            # Add members to teams
            if t_data["name"] == "Backend Team":
                session.add(OrgTeamMember(team_id=team.id, user_id=users["dev1"].id, role=OrgTeamMemberRole.LEADER))
            elif t_data["name"] == "Frontend Team":
                session.add(OrgTeamMember(team_id=team.id, user_id=users["designer"].id, role=OrgTeamMemberRole.MEMBER))
            elif t_data["name"] == "QA Team":
                session.add(OrgTeamMember(team_id=team.id, user_id=users["tester"].id, role=OrgTeamMemberRole.MEMBER))
            
            logger.info(f"Created Team: {team.name}")

    await session.flush()
    return dept_map
