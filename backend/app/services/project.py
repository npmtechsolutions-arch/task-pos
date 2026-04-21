"""Project service for business logic."""

from datetime import datetime
from typing import List, Optional

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.logging import get_logger
from app.models.project import Project, ProjectMember, ProjectMemberRole, ProjectPrdFile, ProjectStatus
from app.models.task import Task, TaskAssignment
from app.models.user import User
from app.schemas.project import (
    ProjectCreate,
    ProjectFilterParams,
    ProjectMemberCreate,
    ProjectMemberUpdate,
    ProjectMembersBulkCreate,
    ProjectUpdate,
)

logger = get_logger(__name__)


class ProjectService:
    """Project service class."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, project_id: str) -> Optional[Project]:
        """Get project by ID."""
        result = await self.db.execute(
            select(Project)
            .where(Project.id == project_id)
            .where(Project.status != ProjectStatus.ARCHIVED)
        )
        return result.scalar_one_or_none()

    async def get_with_members(self, project_id: str) -> Optional[Project]:
        """Get project with members loaded."""
        result = await self.db.execute(
            select(Project)
            .where(Project.id == project_id)
            .where(Project.status != ProjectStatus.ARCHIVED)
        )
        return result.scalar_one_or_none()

    async def get_by_key(self, key: str) -> Optional[Project]:
        """Get project by key."""
        result = await self.db.execute(
            select(Project)
            .where(Project.key == key.upper())
            .where(Project.status != ProjectStatus.ARCHIVED)
        )
        return result.scalar_one_or_none()

    async def _is_system_admin(self, user_id: str) -> bool:
        """Check if user has a system-wide admin/super_admin role."""
        result = await self.db.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()
        return user is not None and getattr(user, 'role', '') in ('admin', 'super_admin', 'owner')

    async def list_projects(
        self,
        user_id: str,
        filters: Optional[ProjectFilterParams] = None,
    ) -> tuple[List[Project], int]:
        """List projects accessible to user with filters. Super admins see ALL projects."""
        is_admin = await self._is_system_admin(user_id)

        if is_admin:
            # Super Admin sees all non-archived projects
            query = (
                select(Project)
                .where(Project.status != ProjectStatus.ARCHIVED)
            )
        else:
            # Regular users — only projects they are a member of
            query = (
                select(Project)
                .join(ProjectMember, Project.id == ProjectMember.project_id)
                .where(ProjectMember.user_id == user_id)
                .where(Project.status != ProjectStatus.ARCHIVED)
            )

        if filters:
            if filters.status:
                query = query.where(Project.status == filters.status)

            if filters.visibility:
                query = query.where(Project.visibility == filters.visibility)

            if filters.search:
                search_filter = or_(
                    Project.name.ilike(f"%{filters.search}%"),
                    Project.description.ilike(f"%{filters.search}%"),
                    Project.key.ilike(f"%{filters.search}%"),
                )
                query = query.where(search_filter)

        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await self.db.execute(count_query)
        total = total_result.scalar() or 0

        # Apply pagination
        page = filters.page if filters else 1
        per_page = filters.per_page if filters else 20
        query = query.offset((page - 1) * per_page).limit(per_page)

        result = await self.db.execute(query)
        return result.scalars().all(), total

    async def create(self, project_data: ProjectCreate, owner_id: str) -> Project:
        """Create a new project and default Kanban workflow."""
        from app.models.board import Board, BoardColumn, BoardColumnType

        logger.info("Creating new project", name=project_data.name, owner=owner_id)

        # Resolve tenant_id — must never be None
        tenant_id = project_data.tenant_id
        if not tenant_id:
            # Fallback: load owner's tenant_id from DB
            result = await self.db.execute(select(User).where(User.id == owner_id))
            owner_user = result.scalar_one_or_none()
            if owner_user:
                tenant_id = owner_user.tenant_id
        if not tenant_id:
            raise ValueError("Cannot create project: tenant_id could not be resolved.")

        # Check if key already exists
        existing = await self.get_by_key(project_data.key)
        if existing:
            raise ValueError(f"Project key '{project_data.key}' already exists")

        # Create project
        project = Project(
            name=project_data.name,
            tenant_id=tenant_id,
            description=project_data.description,
            key=project_data.key.upper(),
            visibility=project_data.visibility,
            start_date=project_data.start_date,
            end_date=project_data.end_date,
            settings=project_data.settings or {},
            owner_id=owner_id,
            status=ProjectStatus.PLANNING,
            github_url=project_data.github_url,
            budget=project_data.budget,
            department=project_data.department,
            business_unit=project_data.business_unit,
            prd_url=project_data.prd_url,
        )

        self.db.add(project)
        await self.db.flush()  # Flush to get project ID

        # Add owner as project admin
        owner_member = ProjectMember(
            project_id=project.id,
            user_id=owner_id,
            role=ProjectMemberRole.ADMIN,
        )
        self.db.add(owner_member)

        # Auto-generate default Kanban Board (with tenant_id)
        board = Board(
            project_id=project.id,
            tenant_id=tenant_id,
            name=f"{project.key} Board"
        )
        self.db.add(board)
        await self.db.flush()  # Need board ID for columns

        # Create default columns
        default_columns = [
            ("Backlog", BoardColumnType.BACKLOG, "#9CA3AF", 0),
            ("To Do", BoardColumnType.TODO, "#3B82F6", 1),
            ("In Progress", BoardColumnType.IN_PROGRESS, "#F59E0B", 2),
            ("Review", BoardColumnType.REVIEW, "#8B5CF6", 3),
            ("Done", BoardColumnType.DONE, "#10B981", 4)
        ]

        for name, col_type, color, position in default_columns:
            column = BoardColumn(
                board_id=board.id,
                name=name,
                column_type=col_type,
                color=color,
                position=position
            )
            self.db.add(column)

        await self.db.commit()
        await self.db.refresh(project)

        logger.info("Project created successfully", project_id=project.id)
        return project

    async def get_latest_prd_file(self, project_id: str) -> Optional[ProjectPrdFile]:
        result = await self.db.execute(
            select(ProjectPrdFile)
            .where(ProjectPrdFile.project_id == project_id)
            .order_by(ProjectPrdFile.version.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def attach_prd_file(
        self,
        project_id: str,
        user_id: str,
        storage_key: str,
        file_name: str,
        file_type: Optional[str],
        size: int,
    ) -> ProjectPrdFile:
        max_ver = (
            await self.db.execute(
                select(func.coalesce(func.max(ProjectPrdFile.version), 0)).where(
                    ProjectPrdFile.project_id == project_id
                )
            )
        ).scalar()
        next_ver = int(max_ver or 0) + 1
        row = ProjectPrdFile(
            project_id=project_id,
            version=next_ver,
            file_name=file_name,
            storage_key=storage_key,
            file_type=file_type,
            file_size_bytes=size,
            uploaded_by=user_id,
        )
        self.db.add(row)
        project = await self.get_by_id(project_id)
        if project:
            project.prd_url = storage_key
        await self.db.commit()
        await self.db.refresh(row)
        return row

    async def user_can_access_prd(self, project_id: str, user_id: str) -> bool:
        if await self.is_project_member(project_id, user_id):
            return True
        r1 = await self.db.execute(
            select(Task.id)
            .where(Task.project_id == project_id, Task.primary_assignee_id == user_id)
            .limit(1)
        )
        if r1.scalar_one_or_none():
            return True
        r2 = await self.db.execute(
            select(TaskAssignment.id)
            .join(Task, Task.id == TaskAssignment.task_id)
            .where(Task.project_id == project_id, TaskAssignment.user_id == user_id)
            .limit(1)
        )
        return r2.scalar_one_or_none() is not None

    async def add_members_bulk(
        self,
        project_id: str,
        data: ProjectMembersBulkCreate,
    ) -> List[ProjectMember]:
        """Add many members in one transaction; skips users already on the project."""
        seen: set[str] = set()
        to_add: List[str] = []
        for uid in data.user_ids:
            if uid in seen:
                continue
            seen.add(uid)
            to_add.append(uid)

        existing_rows = await self.db.execute(
            select(ProjectMember.user_id).where(
                ProjectMember.project_id == project_id,
                ProjectMember.user_id.in_(to_add),
            )
        )
        already = {r[0] for r in existing_rows.fetchall()}
        new_ids = [u for u in to_add if u not in already]

        for uid in new_ids:
            self.db.add(
                ProjectMember(
                    project_id=project_id,
                    user_id=uid,
                    role=data.role,
                )
            )
        if not new_ids:
            return []
        await self.db.commit()
        result = await self.db.execute(
            select(ProjectMember)
            .where(
                ProjectMember.project_id == project_id,
                ProjectMember.user_id.in_(new_ids),
            )
            .options(selectinload(ProjectMember.user))
        )
        return list(result.scalars().all())

    async def update(
        self, project_id: str, project_data: ProjectUpdate
    ) -> Optional[Project]:
        """Update project."""
        project = await self.get_by_id(project_id)
        if not project:
            return None

        update_data = project_data.model_dump(exclude_unset=True)

        for field, value in update_data.items():
            setattr(project, field, value)

        project.updated_at = datetime.utcnow()
        await self.db.commit()
        await self.db.refresh(project)

        logger.info("Project updated", project_id=project_id)
        return project

    async def archive(self, project_id: str) -> bool:
        """Archive project."""
        project = await self.get_by_id(project_id)
        if not project:
            return False

        project.status = ProjectStatus.ARCHIVED
        project.archived_at = datetime.utcnow()
        await self.db.commit()

        logger.info("Project archived", project_id=project_id)
        return True

    async def delete(self, project_id: str) -> bool:
        """Delete project permanently."""
        project = await self.get_by_id(project_id)
        if not project:
            return False

        await self.db.delete(project)
        await self.db.commit()

        logger.info("Project deleted", project_id=project_id)
        return True

    # Member management

    async def add_member(
        self, project_id: str, member_data: ProjectMemberCreate
    ) -> ProjectMember:
        """Add member to project."""
        # Check if already a member
        result = await self.db.execute(
            select(ProjectMember).where(
                ProjectMember.project_id == project_id,
                ProjectMember.user_id == member_data.user_id,
            )
        )
        if result.scalar_one_or_none():
            raise ValueError("User is already a project member")

        member = ProjectMember(
            project_id=project_id,
            user_id=member_data.user_id,
            role=member_data.role,
            notification_settings=member_data.notification_settings or {},
        )

        self.db.add(member)
        await self.db.commit()
        await self.db.refresh(member)

        logger.info(
            "Member added to project",
            project_id=project_id,
            user_id=member_data.user_id,
        )
        return member

    async def update_member(
        self, project_id: str, user_id: str, member_data: ProjectMemberUpdate
    ) -> Optional[ProjectMember]:
        """Update project member."""
        result = await self.db.execute(
            select(ProjectMember).where(
                ProjectMember.project_id == project_id,
                ProjectMember.user_id == user_id,
            )
        )
        member = result.scalar_one_or_none()
        if not member:
            return None

        if member_data.role is not None:
            member.role = member_data.role

        if member_data.notification_settings is not None:
            member.notification_settings = member_data.notification_settings

        await self.db.commit()
        await self.db.refresh(member)
        return member

    async def remove_member(self, project_id: str, user_id: str) -> bool:
        """Remove member from project."""
        result = await self.db.execute(
            select(ProjectMember).where(
                ProjectMember.project_id == project_id,
                ProjectMember.user_id == user_id,
            )
        )
        member = result.scalar_one_or_none()
        if not member:
            return False

        await self.db.delete(member)
        await self.db.commit()

        logger.info("Member removed from project", project_id=project_id, user_id=user_id)
        return True

    async def get_member(self, project_id: str, user_id: str) -> Optional[ProjectMember]:
        """Get project member."""
        result = await self.db.execute(
            select(ProjectMember).where(
                ProjectMember.project_id == project_id,
                ProjectMember.user_id == user_id,
            )
        )
        return result.scalar_one_or_none()

    async def is_project_member(self, project_id: str, user_id: str) -> bool:
        """Check if user is a project member, owner, OR a system-level super_admin."""
        # Super Admin / system admin bypass — no need to be in project_members
        if await self._is_system_admin(user_id):
            return True
        # Explicit project membership
        member = await self.get_member(project_id, user_id)
        if member is not None:
            return True
        # Project owner (they may not be in members table)
        project = await self.get_by_id(project_id)
        if project and str(project.owner_id) == str(user_id):
            return True
        return False

    async def has_permission(
        self, project_id: str, user_id: str, min_role: ProjectMemberRole
    ) -> bool:
        """Check if user has at least the specified role in project."""
        role_hierarchy = {
            ProjectMemberRole.VIEWER: 1,
            ProjectMemberRole.MEMBER: 2,
            ProjectMemberRole.ADMIN: 3,
            ProjectMemberRole.OWNER: 4,
        }

        # Super Admin always has OWNER-level access across all projects
        if await self._is_system_admin(user_id):
            return True

        # Project owner always has OWNER-level access
        project = await self.get_by_id(project_id)
        if project and str(project.owner_id) == str(user_id):
            return role_hierarchy.get(ProjectMemberRole.OWNER, 0) >= role_hierarchy.get(min_role, 0)

        member = await self.get_member(project_id, user_id)
        if not member:
            return False

        return role_hierarchy.get(member.role, 0) >= role_hierarchy.get(min_role, 0)

    async def update_metrics(self, project_id: str) -> None:
        """Update project metrics (denormalized fields)."""
        from app.models.task import Task, TaskStatus

        project = await self.get_by_id(project_id)
        if not project:
            return

        # Count tasks by status
        result = await self.db.execute(
            select(Task.status, func.count(Task.id))
            .where(Task.project_id == project_id)
            .group_by(Task.status)
        )
        status_counts = {status: count for status, count in result.all()}

        project.total_tasks = sum(status_counts.values())
        project.completed_tasks = status_counts.get(TaskStatus.DONE, 0)
        project.in_progress_tasks = status_counts.get(TaskStatus.IN_PROGRESS, 0)

        if project.total_tasks > 0:
            project.progress_percentage = (
                project.completed_tasks / project.total_tasks
            ) * 100

        await self.db.commit()
