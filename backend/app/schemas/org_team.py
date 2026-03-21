"""Pydantic schemas for Org Teams and Reporting Structure."""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.org_team import OrgTeamMemberRole, OrgTeamType


class OrgTeamMemberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    team_id: str
    user_id: str
    role: OrgTeamMemberRole
    joined_at: datetime
    # Embedded user info
    full_name: str = ""
    email: str = ""
    avatar_url: Optional[str] = None
    title: Optional[str] = None


class OrgTeamCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    team_type: OrgTeamType = OrgTeamType.PERMANENT
    department: Optional[str] = None


class OrgTeamUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    team_type: Optional[OrgTeamType] = None
    department: Optional[str] = None
    is_active: Optional[bool] = None


class OrgTeamResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: Optional[str] = None
    team_type: OrgTeamType
    department: Optional[str] = None
    is_active: bool
    member_count: int = 0
    created_at: datetime


class OrgTeamDetailResponse(OrgTeamResponse):
    members: List[OrgTeamMemberResponse] = []


class OrgTeamListResponse(BaseModel):
    items: List[OrgTeamResponse]
    total: int
    page: int
    per_page: int


class AddOrgTeamMemberRequest(BaseModel):
    user_id: str
    role: OrgTeamMemberRole = OrgTeamMemberRole.MEMBER


class UpdateOrgTeamMemberRequest(BaseModel):
    role: OrgTeamMemberRole


class BulkAddMembersRequest(BaseModel):
    user_ids: List[str]
    role: OrgTeamMemberRole = OrgTeamMemberRole.MEMBER


# ── Org Chart / Reporting Structure ─────────────────────────────────

class OrgChartNode(BaseModel):
    """A node in the interactive org hierarchy tree."""
    user_id: str
    full_name: str
    email: str
    title: Optional[str] = None
    department: Optional[str] = None
    avatar_url: Optional[str] = None
    is_primary: bool = True
    # Recursive: populated by service
    direct_reports: List["OrgChartNode"] = []

OrgChartNode.model_rebuild()


class SetReportingRelationRequest(BaseModel):
    manager_id: str
    subordinate_id: str
    is_primary: bool = True


class ReportingStructureResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    manager_id: str
    subordinate_id: str
    is_primary: bool
    effective_from: datetime
    is_active: bool
