"""Team management API router."""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from app.api.deps import get_current_user, get_db
from app.core.logging import get_logger
from app.models.project import Project, ProjectMember, ProjectMemberRole
from app.models.task import Task, TaskStatus, TimeEntry
from app.models.user import User
from app.schemas.team import (
    TeamListResponse,
    TeamMemberResponse,
    TeamMemberAddRequest,
    TeamMemberUpdateRequest,
    AllUsersResponse,
)
from app.schemas.user import UserResponse
from app.services.project import ProjectService

logger = get_logger(__name__)
router = APIRouter()


@router.get("", response_model=AllUsersResponse)
async def list_all_users(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AllUsersResponse:
    """
    List all active users in the system.
    Used when searching for people to add to a project team.
    """
    result = await db.execute(
        select(User).where(User.is_active == True).order_by(User.first_name)
    )
    users = result.scalars().all()
    return AllUsersResponse(
        users=[UserResponse.model_validate(u) for u in users],
        total=len(users),
    )


@router.get("/project/{project_id}", response_model=TeamListResponse)
async def get_project_team(
    project_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TeamListResponse:
    """
    Get all team members for a specific project, with their stats.
    Role mapping for display:
      owner  → Leader
      admin  → Assistant
      member → Member
      viewer → Viewer
    """
    # Verify project exists and current user is a member
    project_service = ProjectService(db)
    project = await project_service.get_by_id(project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    if not await project_service.is_project_member(project_id, current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # Fetch members
    members_result = await db.execute(
        select(ProjectMember).where(ProjectMember.project_id == project_id)
    )
    members = members_result.scalars().all()

    member_responses: List[TeamMemberResponse] = []
    for member in members:
        # Load user
        user_result = await db.get(User, member.user_id)
        if not user_result:
            continue

        # Task count
        tasks_result = await db.execute(
            select(func.count(Task.id)).where(
                and_(Task.assignee_id == member.user_id, Task.project_id == project_id)
            )
        )
        task_count = tasks_result.scalar_one() or 0

        completed_result = await db.execute(
            select(func.count(Task.id)).where(
                and_(
                    Task.assignee_id == member.user_id,
                    Task.project_id == project_id,
                    Task.status == TaskStatus.DONE,
                )
            )
        )
        completed_task_count = completed_result.scalar_one() or 0

        # Hours logged (via time entries on tasks in this project)
        hours_result = await db.execute(
            select(func.sum(TimeEntry.duration_minutes))
            .join(Task, TimeEntry.task_id == Task.id)
            .where(
                and_(
                    TimeEntry.user_id == member.user_id,
                    Task.project_id == project_id,
                )
            )
        )
        total_minutes = hours_result.scalar_one() or 0
        hours_logged = round(total_minutes / 60, 2)

        member_responses.append(
            TeamMemberResponse(
                user_id=member.user_id,
                role=member.role,
                joined_at=member.joined_at,
                user=UserResponse.model_validate(user_result),
                task_count=task_count,
                completed_task_count=completed_task_count,
                hours_logged=hours_logged,
            )
        )

    return TeamListResponse(
        project_id=project_id,
        project_name=project.name,
        members=member_responses,
        total=len(member_responses),
    )


@router.post("/project/{project_id}", response_model=TeamMemberResponse, status_code=status.HTTP_201_CREATED)
async def add_team_member(
    project_id: str,
    member_data: TeamMemberAddRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TeamMemberResponse:
    """Add a user to a project team. Requires admin/owner role."""
    project_service = ProjectService(db)

    if not await project_service.has_permission(project_id, current_user.id, ProjectMemberRole.ADMIN):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    # Check if user exists
    user = await db.get(User, member_data.user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Check if already a member
    existing = await db.execute(
        select(ProjectMember).where(
            and_(
                ProjectMember.project_id == project_id,
                ProjectMember.user_id == member_data.user_id,
            )
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User is already a project member")

    from app.schemas.project import ProjectMemberCreate
    member_create = ProjectMemberCreate(user_id=member_data.user_id, role=member_data.role)
    new_member = await project_service.add_member(project_id, member_create)

    return TeamMemberResponse(
        user_id=new_member.user_id,
        role=new_member.role,
        joined_at=new_member.joined_at,
        user=UserResponse.model_validate(user),
    )


@router.put("/project/{project_id}/{user_id}", response_model=TeamMemberResponse)
async def update_team_member_role(
    project_id: str,
    user_id: str,
    update_data: TeamMemberUpdateRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TeamMemberResponse:
    """Update a team member's role. Requires admin/owner."""
    project_service = ProjectService(db)

    if not await project_service.has_permission(project_id, current_user.id, ProjectMemberRole.ADMIN):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    from app.schemas.project import ProjectMemberUpdate
    member_update = ProjectMemberUpdate(role=update_data.role)
    member = await project_service.update_member(project_id, user_id, member_update)

    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team member not found")

    user = await db.get(User, user_id)
    return TeamMemberResponse(
        user_id=member.user_id,
        role=member.role,
        joined_at=member.joined_at,
        user=UserResponse.model_validate(user),
    )


@router.delete("/project/{project_id}/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_team_member(
    project_id: str,
    user_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Remove a member from a project team."""
    project_service = ProjectService(db)

    # Allow self-removal or admin removal
    if user_id != current_user.id:
        if not await project_service.has_permission(project_id, current_user.id, ProjectMemberRole.ADMIN):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    success = await project_service.remove_member(project_id, user_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")
