"""Org Teams and Org Chart API routes."""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.core.logging import get_logger
from app.schemas.org_team import (
    AddOrgTeamMemberRequest,
    BulkAddMembersRequest,
    OrgChartNode,
    OrgTeamCreate,
    OrgTeamDetailResponse,
    OrgTeamListResponse,
    OrgTeamMemberResponse,
    OrgTeamResponse,
    OrgTeamUpdate,
    ReportingStructureResponse,
    SetReportingRelationRequest,
    UpdateOrgTeamMemberRequest,
)
from app.services.org_team import OrgTeamService

logger = get_logger(__name__)
router = APIRouter()


def _team_to_response(team) -> OrgTeamResponse:
    return OrgTeamResponse(
        id=team.id,
        name=team.name,
        description=team.description,
        team_type=team.team_type,
        department=team.department,
        is_active=team.is_active,
        member_count=len(team.members) if team.members else 0,
        created_at=team.created_at,
    )


def _team_member_to_response(member) -> OrgTeamMemberResponse:
    return OrgTeamMemberResponse(
        id=member.id,
        team_id=member.team_id,
        user_id=member.user_id,
        role=member.role,
        joined_at=member.joined_at,
        full_name=member.user.full_name if member.user else "",
        email=member.user.email if member.user else "",
        avatar_url=member.user.avatar_url if member.user else None,
    )


# ── Teams CRUD ───────────────────────────────────────────────────────────────

@router.get("", response_model=OrgTeamListResponse)
async def list_org_teams(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    department: Optional[str] = Query(None),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all org teams."""
    svc = OrgTeamService(db)
    teams, total = await svc.list_teams(page=page, per_page=per_page, department=department)
    return OrgTeamListResponse(
        items=[_team_to_response(t) for t in teams],
        total=total, page=page, per_page=per_page
    )


@router.post("", response_model=OrgTeamResponse, status_code=status.HTTP_201_CREATED)
async def create_org_team(
    data: OrgTeamCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role.value not in ("admin", "owner", "manager"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    svc = OrgTeamService(db)
    team = await svc.create_team(data, creator_id=current_user.id)
    return _team_to_response(team)


@router.get("/{team_id}", response_model=OrgTeamDetailResponse)
async def get_org_team(
    team_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = OrgTeamService(db)
    team = await svc.get_team(team_id)
    if not team:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
    members = [_team_member_to_response(m) for m in (team.members or [])]
    return OrgTeamDetailResponse(
        id=team.id, name=team.name, description=team.description,
        team_type=team.team_type, department=team.department,
        is_active=team.is_active, member_count=len(members),
        created_at=team.created_at, members=members,
    )


@router.put("/{team_id}", response_model=OrgTeamResponse)
async def update_org_team(
    team_id: str,
    data: OrgTeamUpdate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role.value not in ("admin", "owner", "manager"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    svc = OrgTeamService(db)
    team = await svc.update_team(team_id, data)
    if not team:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
    return _team_to_response(team)


@router.delete("/{team_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_org_team(
    team_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role.value not in ("admin", "owner"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    svc = OrgTeamService(db)
    if not await svc.delete_team(team_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")


# ── Team Members ──────────────────────────────────────────────────────────────

@router.post("/{team_id}/members", response_model=OrgTeamMemberResponse, status_code=status.HTTP_201_CREATED)
async def add_team_member(
    team_id: str,
    data: AddOrgTeamMemberRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = OrgTeamService(db)
    try:
        member = await svc.add_member(team_id, data.user_id, data.role)
        return _team_member_to_response(member)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{team_id}/members/bulk", response_model=List[OrgTeamMemberResponse], status_code=status.HTTP_201_CREATED)
async def bulk_add_team_members(
    team_id: str,
    data: BulkAddMembersRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = OrgTeamService(db)
    members = await svc.bulk_add_members(team_id, data.user_ids, data.role)
    return [_team_member_to_response(m) for m in members]


@router.put("/{team_id}/members/{user_id}", response_model=OrgTeamMemberResponse)
async def update_team_member_role(
    team_id: str,
    user_id: str,
    data: UpdateOrgTeamMemberRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = OrgTeamService(db)
    member = await svc.update_member_role(team_id, user_id, data.role)
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")
    return _team_member_to_response(member)


@router.delete("/{team_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_team_member(
    team_id: str,
    user_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = OrgTeamService(db)
    if not await svc.remove_member(team_id, user_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")


# ── Org Chart ─────────────────────────────────────────────────────────────────

@router.get("/org-chart/full", response_model=List[OrgChartNode])
async def get_org_chart(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the full org hierarchy tree (recursive)."""
    svc = OrgTeamService(db)
    return await svc.get_org_chart()


@router.post("/org-chart/reporting", response_model=ReportingStructureResponse, status_code=status.HTTP_201_CREATED)
async def set_reporting_relation(
    data: SetReportingRelationRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Set a manager→subordinate reporting relationship."""
    if current_user.role.value not in ("admin", "owner"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    svc = OrgTeamService(db)
    try:
        rel = await svc.set_reporting_relation(data.manager_id, data.subordinate_id, data.is_primary)
        return ReportingStructureResponse.model_validate(rel)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
