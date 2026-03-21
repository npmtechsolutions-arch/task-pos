"""Employee & Skill API routes."""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.core.logging import get_logger
from app.models.employee import ValidationStatus
from app.models.user import User
from app.schemas.employee import (
    EmployeeListResponse,
    EmployeeProfileResponse,
    EmployeeProfileUpdate,
    SkillCreate,
    SkillMatrixResponse,
    SkillResponse,
    UserSkillCreate,
    UserSkillResponse,
    UserSkillUpdate,
    ValidateSkillRequest,
)
from app.services.employee import EmployeeService

logger = get_logger(__name__)
router = APIRouter()


def _build_employee_response(user: User, profile, skills: list) -> EmployeeProfileResponse:
    return EmployeeProfileResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        first_name=user.first_name,
        last_name=user.last_name,
        avatar_url=user.avatar_url,
        role=user.role.value,
        is_active=user.is_active,
        title=profile.title if profile else None,
        department=profile.department if profile else None,
        hire_date=profile.hire_date if profile else None,
        location=profile.location if profile else None,
        preferences=profile.preferences if profile else {},
        skills=skills,
    )


# ── Directory ─────────────────────────────────────────────────────────────────

@router.get("", response_model=EmployeeListResponse)
async def list_employees(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    department: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Paginated employee directory."""
    svc = EmployeeService(db)
    users, total = await svc.list_employees(page=page, per_page=per_page, department=department, search=search)
    items = []
    for user in users:
        profile = await svc.get_or_create_employee_profile(user.id)
        skills = await svc.get_user_skills(user.id)
        skill_responses = [UserSkillResponse.model_validate(s) for s in skills]
        items.append(_build_employee_response(user, profile, skill_responses))
    return EmployeeListResponse(items=items, total=total, page=page, per_page=per_page)


@router.get("/{user_id}", response_model=EmployeeProfileResponse)
async def get_employee(
    user_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single employee's full profile."""
    svc = EmployeeService(db)
    user = await svc.get_employee_profile(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")
    profile = await svc.get_or_create_employee_profile(user_id)
    skills = await svc.get_user_skills(user_id)
    skill_responses = [UserSkillResponse.model_validate(s) for s in skills]
    return _build_employee_response(user, profile, skill_responses)


@router.put("/{user_id}", response_model=EmployeeProfileResponse)
async def update_employee_profile(
    user_id: str,
    data: EmployeeProfileUpdate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an employee's professional profile. Users can update their own; admins can update any."""
    if user_id != current_user.id and current_user.role.value not in ("admin", "owner"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    svc = EmployeeService(db)
    user = await svc.get_employee_profile(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")
    profile = await svc.update_employee_profile(user_id, data)
    skills = await svc.get_user_skills(user_id)
    skill_responses = [UserSkillResponse.model_validate(s) for s in skills]
    return _build_employee_response(user, profile, skill_responses)


# ── Skills ────────────────────────────────────────────────────────────────────

@router.get("/{user_id}/skills", response_model=List[UserSkillResponse])
async def get_user_skills(
    user_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = EmployeeService(db)
    return [UserSkillResponse.model_validate(s) for s in await svc.get_user_skills(user_id)]


@router.post("/{user_id}/skills", response_model=UserSkillResponse, status_code=status.HTTP_201_CREATED)
async def add_user_skill(
    user_id: str,
    data: UserSkillCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user_id != current_user.id and current_user.role.value not in ("admin", "owner"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    svc = EmployeeService(db)
    try:
        skill = await svc.add_user_skill(user_id, data)
        return UserSkillResponse.model_validate(skill)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.put("/{user_id}/skills/{skill_id}", response_model=UserSkillResponse)
async def update_user_skill(
    user_id: str,
    skill_id: str,
    data: UserSkillUpdate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user_id != current_user.id and current_user.role.value not in ("admin", "owner"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    svc = EmployeeService(db)
    result = await svc.update_user_skill(user_id, skill_id, data)
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Skill not found on user")
    return UserSkillResponse.model_validate(result)


@router.post("/{user_id}/skills/{skill_id}/validate", response_model=UserSkillResponse)
async def validate_user_skill(
    user_id: str,
    skill_id: str,
    data: ValidateSkillRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin or peer validates a user's self-assessed skill."""
    if current_user.role.value not in ("admin", "owner", "manager"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    svc = EmployeeService(db)
    result = await svc.validate_skill(
        user_id, skill_id, current_user.id,
        ValidationStatus(data.validation_status), data.notes
    )
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Skill not found on user")
    return UserSkillResponse.model_validate(result)


@router.delete("/{user_id}/skills/{skill_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_user_skill(
    user_id: str,
    skill_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user_id != current_user.id and current_user.role.value not in ("admin", "owner"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    svc = EmployeeService(db)
    if not await svc.remove_user_skill(user_id, skill_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Skill not found on user")
