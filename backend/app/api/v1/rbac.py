"""RBAC API routes — roles, permissions, and user-role assignments."""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.core.logging import get_logger
from app.models.rbac import ActionType, ResourceType
from app.schemas.rbac import (
    AssignRoleRequest,
    PermissionCheckRequest,
    PermissionCheckResponse,
    PermissionResponse,
    RoleCreate,
    RoleListResponse,
    RoleResponse,
    RoleUpdate,
    SetRolePermissionsRequest,
    UserRoleResponse,
)
from app.services.rbac import RBACService

logger = get_logger(__name__)
router = APIRouter()


def _require_admin(current_user):
    if current_user.role.value not in ("admin", "owner"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")


# ── Roles ────────────────────────────────────────────────────────────────────

@router.get("/roles", response_model=RoleListResponse)
async def list_roles(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = RBACService(db)
    roles = await svc.list_roles()
    return RoleListResponse(items=[RoleResponse.model_validate(r) for r in roles], total=len(roles))


@router.post("/roles", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
async def create_role(
    data: RoleCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_admin(current_user)
    svc = RBACService(db)
    role = await svc.create_role(data)
    return RoleResponse.model_validate(role)


@router.get("/roles/{role_id}", response_model=RoleResponse)
async def get_role(
    role_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = RBACService(db)
    role = await svc.get_role(role_id)
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")
    return RoleResponse.model_validate(role)


@router.put("/roles/{role_id}", response_model=RoleResponse)
async def update_role(
    role_id: str,
    data: RoleUpdate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_admin(current_user)
    svc = RBACService(db)
    role = await svc.update_role(role_id, data)
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found or is a system role")
    return RoleResponse.model_validate(role)


@router.put("/roles/{role_id}/permissions", response_model=RoleResponse)
async def set_role_permissions(
    role_id: str,
    data: SetRolePermissionsRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Replace all permissions on a custom role."""
    _require_admin(current_user)
    svc = RBACService(db)
    try:
        role = await svc.set_role_permissions(role_id, data)
        return RoleResponse.model_validate(role)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# ── Permissions ───────────────────────────────────────────────────────────────

@router.get("/permissions", response_model=List[PermissionResponse])
async def list_permissions(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all permission definitions (for building role permission matrices)."""
    svc = RBACService(db)
    perms = await svc.list_permissions()
    return [PermissionResponse.model_validate(p) for p in perms]


@router.post("/permissions/check", response_model=PermissionCheckResponse)
async def check_permission(
    data: PermissionCheckRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Check if the current user has a specific permission."""
    svc = RBACService(db)
    return await svc.check_permission(
        user_id=current_user.id,
        action=data.action,
        resource=data.resource,
        scope_id=data.scope_id,
    )


# ── User Role Assignments ─────────────────────────────────────────────────────

@router.get("/users/{user_id}/roles", response_model=List[UserRoleResponse])
async def get_user_roles(
    user_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user_id != current_user.id and current_user.role.value not in ("admin", "owner"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    svc = RBACService(db)
    user_roles = await svc.get_user_roles(user_id)
    return [UserRoleResponse.model_validate(ur) for ur in user_roles]


@router.post("/users/{user_id}/roles", response_model=UserRoleResponse, status_code=status.HTTP_201_CREATED)
async def assign_role(
    user_id: str,
    data: AssignRoleRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_admin(current_user)
    svc = RBACService(db)
    try:
        ur = await svc.assign_role(user_id, data)
        return UserRoleResponse.model_validate(ur)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/users/{user_id}/roles/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_role(
    user_id: str,
    role_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_admin(current_user)
    svc = RBACService(db)
    if not await svc.revoke_role(user_id, role_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role assignment not found")


# ── Skill/Capability Endpoints (shared router with employees) ──────────────────

@router.get("/skills", response_model=List)
async def list_skills(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.services.employee import EmployeeService
    from app.schemas.employee import SkillResponse
    svc = EmployeeService(db)
    return [SkillResponse.model_validate(s) for s in await svc.list_skills()]


@router.post("/skills", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_skill(
    data: dict,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_admin(current_user)
    from app.services.employee import EmployeeService
    from app.schemas.employee import SkillCreate, SkillResponse
    svc = EmployeeService(db)
    skill = await svc.create_skill(SkillCreate(**data))
    return SkillResponse.model_validate(skill).model_dump()


@router.get("/skills/matrix")
async def get_skill_matrix(
    force_refresh: bool = Query(False, description="Admin: bypass the 5-minute TTL cache"),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Org-wide skill matrix — rows=employees, cols=skills. Cached for 5 min."""
    # Improvement 8: only admins can force a cache refresh
    if force_refresh and current_user.role.value not in ("admin", "owner"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can force cache refresh")
    from app.services.employee import EmployeeService
    from app.schemas.employee import SkillMatrixResponse, SkillResponse
    svc = EmployeeService(db)
    data = await svc.get_skill_matrix(force_refresh=force_refresh)
    return SkillMatrixResponse(
        rows=data["rows"],
        skill_columns=[SkillResponse.model_validate(s) for s in data["skill_columns"]],
        total_employees=data["total_employees"],
        total_skills=data["total_skills"],
    )


@router.post("/skills/matrix/refresh", status_code=status.HTTP_200_OK)
async def force_refresh_skill_matrix(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin: manually bust the skill matrix cache and return fresh data."""
    _require_admin(current_user)
    from app.services.employee import EmployeeService, _invalidate_matrix_cache
    from app.schemas.employee import SkillMatrixResponse, SkillResponse
    _invalidate_matrix_cache()
    svc = EmployeeService(db)
    data = await svc.get_skill_matrix(force_refresh=True)
    return {"status": "cache_refreshed", "total_employees": data["total_employees"], "total_skills": data["total_skills"]}


@router.get("/skills/match")
async def match_skills_to_task(
    task_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return users ranked by how well their skills match a task."""
    from app.services.employee import EmployeeService
    from app.schemas.employee import SkillMatchResult, SkillMatrixCell
    svc = EmployeeService(db)
    results = await svc.match_skills_to_task(task_id)
    return [
        SkillMatchResult(
            user_id=r["user"].id,
            full_name=r["user"].full_name,
            email=r["user"].email,
            avatar_url=r["user"].avatar_url,
            match_score=r["match_score"],
            matched_skills=[
                SkillMatrixCell(
                    skill_id=s.id, skill_name=s.name,
                    proficiency_level=0, validation_status="self"
                )
                for s in r["matched_skills"]
            ],
            missing_skills=r["missing_skills"],
        )
        for r in results
    ]
