"""Team schemas for request/response validation."""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict

from app.models.project import ProjectMemberRole
from app.schemas.user import UserResponse


class TeamMemberResponse(BaseModel):
    """Team member response with extended info."""

    model_config = ConfigDict(from_attributes=True)

    user_id: str
    role: ProjectMemberRole
    joined_at: datetime
    user: UserResponse

    # Computed stats (populated by service)
    task_count: int = 0
    completed_task_count: int = 0
    hours_logged: float = 0.0

    @property
    def display_role(self) -> str:
        """Map DB roles to user-facing terminology."""
        mapping = {
            ProjectMemberRole.OWNER: "Leader",
            ProjectMemberRole.ADMIN: "Assistant",
            ProjectMemberRole.MEMBER: "Member",
            ProjectMemberRole.VIEWER: "Viewer",
        }
        return mapping.get(self.role, self.role.value)


class TeamMemberAddRequest(BaseModel):
    """Add a member to a project."""

    user_id: str
    role: ProjectMemberRole = ProjectMemberRole.MEMBER


class TeamMemberUpdateRequest(BaseModel):
    """Update a team member's role."""

    role: ProjectMemberRole


class TeamListResponse(BaseModel):
    """List of team members for a project."""

    project_id: str
    project_name: str
    members: List[TeamMemberResponse]
    total: int


class AllUsersResponse(BaseModel):
    """All users available to be added to a team."""

    users: List[UserResponse]
    total: int
