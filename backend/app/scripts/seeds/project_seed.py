import logging
import uuid
import random
from typing import Dict, List
from datetime import datetime, timedelta
from faker import Faker
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.tenant import Tenant
from app.models.user import User
from app.models.project import Project, ProjectStatus, ProjectVisibility, ProjectMember, ProjectMemberRole, ProjectPhase, PhaseStatus
from app.models.milestone import Milestone, MilestoneStatus
from app.models.board import Board, BoardColumn, BoardColumnType

logger = logging.getLogger(__name__)
fake = Faker()

async def seed_projects(session: AsyncSession, tenant: Tenant, users: Dict[str, User]) -> List[Project]:
    """Seed Projects, Members, Phases, Milestones, and Kanban Boards."""
    logger.info("Seeding Projects...")
    
    projects_to_create = [
        {"name": "Marketing Campaign Q1", "key": "MKT-Q1"},
        {"name": "Mobile App Development", "key": "MOB"},
        {"name": "POS Billing System", "key": "POS"},
        {"name": "Website Redesign", "key": "WEB"},
        {"name": "Internal HR System", "key": "HR"}
    ]
    
    admin = users["admin"]
    pm = users["pm"]
    dev1 = users["dev1"]
    designer = users["designer"]
    tester = users["tester"]
    
    created_projects = []
    
    for p_data in projects_to_create:
        result = await session.execute(select(Project).where(Project.key == p_data["key"]))
        project = result.scalars().first()
        
        if not project:
            budget = random.choice([50000, 120000, 25000, 80000, 150000])
            project = Project(
                id=str(uuid.uuid4()),
                tenant_id=tenant.id,
                name=p_data["name"],
                key=p_data["key"],
                description=fake.paragraph(),
                status=ProjectStatus.ACTIVE,
                visibility=ProjectVisibility.INTERNAL,
                start_date=datetime.utcnow().date(),
                end_date=(datetime.utcnow() + timedelta(days=90)).date(),
                owner_id=pm.id,
                budget=budget,
                budget_spent=random.uniform(1000, budget/2)
            )
            session.add(project)
            await session.flush()
            created_projects.append(project)
            logger.info(f"Created Project: {project.name}")
            
            # --- 1. Add Members ---
            members = [
                ProjectMember(project_id=project.id, user_id=pm.id, role=ProjectMemberRole.MANAGER),
                ProjectMember(project_id=project.id, user_id=admin.id, role=ProjectMemberRole.ADMIN),
                ProjectMember(project_id=project.id, user_id=dev1.id, role=ProjectMemberRole.MEMBER),
                ProjectMember(project_id=project.id, user_id=designer.id, role=ProjectMemberRole.MEMBER),
                ProjectMember(project_id=project.id, user_id=tester.id, role=ProjectMemberRole.MEMBER),
            ]
            session.add_all(members)
            
            # --- 2. Add Phases ---
            phases = [
                ProjectPhase(id=str(uuid.uuid4()), project_id=project.id, name="Planning", status=PhaseStatus.COMPLETED, position=1),
                ProjectPhase(id=str(uuid.uuid4()), project_id=project.id, name="Development", status=PhaseStatus.ACTIVE, position=2),
                ProjectPhase(id=str(uuid.uuid4()), project_id=project.id, name="Testing", status=PhaseStatus.PLANNED, position=3),
                ProjectPhase(id=str(uuid.uuid4()), project_id=project.id, name="Deployment", status=PhaseStatus.PLANNED, position=4),
            ]
            session.add_all(phases)
            
            # --- 3. Add Milestones ---
            milestones = [
                Milestone(id=str(uuid.uuid4()), project_id=project.id, tenant_id=tenant.id, title="Project Kickoff", status=MilestoneStatus.COMPLETED, due_date=datetime.utcnow() - timedelta(days=10)),
                Milestone(id=str(uuid.uuid4()), project_id=project.id, tenant_id=tenant.id, title="First Release", status=MilestoneStatus.OPEN, due_date=datetime.utcnow() + timedelta(days=30)),
                Milestone(id=str(uuid.uuid4()), project_id=project.id, tenant_id=tenant.id, title="Final Delivery", status=MilestoneStatus.OPEN, due_date=datetime.utcnow() + timedelta(days=90)),
            ]
            session.add_all(milestones)
            
            # --- 4. Add Kanban Board ---
            board = Board(
                id=str(uuid.uuid4()),
                tenant_id=tenant.id,
                project_id=project.id,
                name=f"{project.name} Board"
            )
            session.add(board)
            await session.flush()
            
            columns = [
                BoardColumn(id=str(uuid.uuid4()), board_id=board.id, name="Backlog", column_type=BoardColumnType.BACKLOG, position=1),
                BoardColumn(id=str(uuid.uuid4()), board_id=board.id, name="To Do", column_type=BoardColumnType.TODO, position=2),
                BoardColumn(id=str(uuid.uuid4()), board_id=board.id, name="In Progress", column_type=BoardColumnType.IN_PROGRESS, position=3),
                BoardColumn(id=str(uuid.uuid4()), board_id=board.id, name="Review", column_type=BoardColumnType.REVIEW, position=4),
                BoardColumn(id=str(uuid.uuid4()), board_id=board.id, name="Done", column_type=BoardColumnType.DONE, position=5),
            ]
            session.add_all(columns)
            
    await session.flush()
    return created_projects
