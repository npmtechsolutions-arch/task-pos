"""HR Hierarchy API — departments, personnel, org chart."""

import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.hr_hierarchy import Department, HRAssignment, HRRole, HRCustomRole as Role
from app.models.user import User, UserRole

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────
class DepartmentCreate(BaseModel):
    name: str
    description: Optional[str] = None
    manager_id: Optional[str] = None


class DepartmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    description: Optional[str] = None
    manager_id: Optional[str] = None
    created_at: datetime


class MemberAdd(BaseModel):
    user_id: str
    hr_role: HRRole
    reports_to_id: Optional[str] = None


class RoleCreate(BaseModel):
    name: str
    description: Optional[str] = None


class RoleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    description: Optional[str] = None
    created_at: datetime


class MemberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    department_id: str
    user_id: str
    hr_role: HRRole
    reports_to_id: Optional[str] = None
    created_at: datetime
    # flat user fields joined manually
    user_email: Optional[str] = None
    user_name: Optional[str] = None


# ── Helper: resolve who can see what ─────────────────────────────────────────
def _can_see_all(user) -> bool:
    return user.role in (UserRole.ADMIN, UserRole.OWNER)


# ── Helper: which HR roles a given role can add ───────────────────────────────
_CAN_ADD: dict[HRRole, HRRole] = {
    HRRole.MANAGER:     HRRole.HR,
    HRRole.HR:          HRRole.TEAM_LEADER,
    HRRole.TEAM_LEADER: HRRole.MEMBER,
}


async def _get_user_dept_role(db: AsyncSession, dept_id: str, user_id: str) -> Optional[HRRole]:
    r = await db.execute(
        select(HRAssignment.hr_role).where(
            HRAssignment.department_id == dept_id,
            HRAssignment.user_id == user_id,
        )
    )
    return r.scalar_one_or_none()


# ── Department CRUD ───────────────────────────────────────────────────────────
@router.get("/departments", response_model=List[DepartmentResponse])
async def list_departments(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if _can_see_all(current_user):
        result = await db.execute(select(Department).order_by(Department.name))
        return [DepartmentResponse.model_validate(d) for d in result.scalars().all()]
    # Otherwise show depts where this user is a member
    result = await db.execute(
        select(Department)
        .join(HRAssignment, Department.id == HRAssignment.department_id)
        .where(HRAssignment.user_id == current_user.id)
        .order_by(Department.name)
    )
    return [DepartmentResponse.model_validate(d) for d in result.scalars().all()]


@router.post("/departments", response_model=DepartmentResponse, status_code=status.HTTP_201_CREATED)
async def create_department(
    data: DepartmentCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not _can_see_all(current_user) and current_user.role != UserRole.MANAGER:
        raise HTTPException(403, "Only managers and admins can create departments")
    dept = Department(
        id=str(uuid.uuid4()),
        name=data.name,
        description=data.description,
        manager_id=data.manager_id or current_user.id,
        created_by=current_user.id,
    )
    db.add(dept)
    # Auto-add creator as manager
    creator_assignment = HRAssignment(
        id=str(uuid.uuid4()),
        department_id=dept.id,
        user_id=current_user.id,
        hr_role=HRRole.MANAGER,
        created_by=current_user.id,
    )
    db.add(creator_assignment)
    await db.commit()
    await db.refresh(dept)
    return DepartmentResponse.model_validate(dept)


@router.put("/departments/{dept_id}", response_model=DepartmentResponse)
async def update_department(
    dept_id: str,
    data: DepartmentCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Department).where(Department.id == dept_id))
    dept = result.scalar_one_or_none()
    if not dept:
        raise HTTPException(404, "Department not found")
    # Must be admin/owner OR manager of this dept
    dept_role = await _get_user_dept_role(db, dept_id, current_user.id)
    if not _can_see_all(current_user) and dept_role != HRRole.MANAGER:
        raise HTTPException(403, "Only managers can update department info")
    dept.name = data.name
    dept.description = data.description
    if data.manager_id:
        dept.manager_id = data.manager_id
    await db.commit()
    await db.refresh(dept)
    return DepartmentResponse.model_validate(dept)


@router.delete("/departments/{dept_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_department(
    dept_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not _can_see_all(current_user):
        raise HTTPException(403, "Only admins can delete departments")
    result = await db.execute(select(Department).where(Department.id == dept_id))
    dept = result.scalar_one_or_none()
    if not dept:
        raise HTTPException(404, "Department not found")
    await db.delete(dept)
    await db.commit()


# ── Members ───────────────────────────────────────────────────────────────────
@router.get("/departments/{dept_id}/members", response_model=List[dict])
async def list_members(
    dept_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Check access
    if not _can_see_all(current_user):
        dept_role = await _get_user_dept_role(db, dept_id, current_user.id)
        if not dept_role:
            raise HTTPException(403, "Not a member of this department")

    q = (
        select(
            HRAssignment.id,
            HRAssignment.user_id,
            HRAssignment.hr_role,
            HRAssignment.reports_to_id,
            HRAssignment.created_at,
            User.email,
            User.first_name,
            User.last_name,
        )
        .join(User, User.id == HRAssignment.user_id)
        .where(HRAssignment.department_id == dept_id)
        .order_by(HRAssignment.hr_role, User.first_name)
    )
    result = await db.execute(q)
    rows = result.all()
    return [
        {
            "id": r[0],
            "user_id": r[1],
            "hr_role": str(r[2]).split(".")[-1],
            "reports_to_id": r[3],
            "created_at": r[4].isoformat() if r[4] else None,
            "email": r[5],
            "first_name": r[6],
            "last_name": r[7],
        }
        for r in rows
    ]


@router.post("/departments/{dept_id}/members", status_code=status.HTTP_201_CREATED)
async def add_member(
    dept_id: str,
    data: MemberAdd,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Admins can add anyone; others must follow hierarchy
    if not _can_see_all(current_user):
        actor_role = await _get_user_dept_role(db, dept_id, current_user.id)
        if not actor_role:
            raise HTTPException(403, "Not a member of this department")
        allowed = _CAN_ADD.get(actor_role)
        if not allowed or data.hr_role != allowed:
            raise HTTPException(
                403,
                f"Your role ({actor_role}) can only add '{allowed}' members"
            )
    # Check target user exists
    u = await db.execute(select(User).where(User.id == data.user_id))
    if not u.scalar_one_or_none():
        raise HTTPException(404, "User not found")
    assignment = HRAssignment(
        id=str(uuid.uuid4()),
        department_id=dept_id,
        user_id=data.user_id,
        hr_role=data.hr_role,
        reports_to_id=data.reports_to_id,
        created_by=current_user.id,
    )
    db.add(assignment)
    try:
        await db.commit()
    except Exception:
        await db.rollback()
        raise HTTPException(400, "User is already in this department")
    return {"ok": True, "id": assignment.id}


@router.delete("/departments/{dept_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    dept_id: str,
    user_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not _can_see_all(current_user):
        actor_role = await _get_user_dept_role(db, dept_id, current_user.id)
        target_role = await _get_user_dept_role(db, dept_id, user_id)
        # Must be one level above
        if not actor_role or not target_role:
            raise HTTPException(403, "Insufficient access")
        allowed_to_remove = _CAN_ADD.get(actor_role)
        if target_role != allowed_to_remove:
            raise HTTPException(403, "Cannot remove this member — insufficient privilege")

    result = await db.execute(
        select(HRAssignment).where(
            HRAssignment.department_id == dept_id,
            HRAssignment.user_id == user_id,
        )
    )
    asgn = result.scalar_one_or_none()
    if not asgn:
        raise HTTPException(404, "Member not found")
    await db.delete(asgn)
    await db.commit()


# ── Org Chart (CEO/admin only) ────────────────────────────────────────────────
@router.get("/org-chart")
async def org_chart(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Full org chart across all departments."""
    if not _can_see_all(current_user):
        raise HTTPException(403, "CEO/Admin access required")

    depts_result = await db.execute(select(Department).order_by(Department.name))
    depts = depts_result.scalars().all()

    chart = []
    for dept in depts:
        members_result = await db.execute(
            select(
                HRAssignment.user_id,
                HRAssignment.hr_role,
                HRAssignment.reports_to_id,
                User.first_name,
                User.last_name,
                User.email,
            )
            .join(User, User.id == HRAssignment.user_id)
            .where(HRAssignment.department_id == dept.id)
            .order_by(HRAssignment.hr_role)
        )
        members = [
            {
                "user_id": r[0],
                "hr_role": str(r[1]).split(".")[-1],
                "reports_to_id": r[2],
                "name": f"{r[3] or ''} {r[4] or ''}".strip(),
                "email": r[5],
            }
            for r in members_result.all()
        ]
        chart.append({
            "department_id": dept.id,
            "department_name": dept.name,
            "description": dept.description,
            "manager_id": dept.manager_id,
            "member_count": len(members),
            "members": members,
        })
    return chart


@router.get("/stats")
async def hr_stats(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not _can_see_all(current_user):
        raise HTTPException(403, "Admin access required")
    dept_count = await db.execute(select(func.count(Department.id)))
    member_count = await db.execute(select(func.count(HRAssignment.id)))
    role_dist_result = await db.execute(
        select(HRAssignment.hr_role, func.count(HRAssignment.id)).group_by(HRAssignment.hr_role)
    )
    role_dist = {str(r[0]).split(".")[-1]: r[1] for r in role_dist_result.all()}
    return {
        "total_departments": dept_count.scalar() or 0,
        "total_members": member_count.scalar() or 0,
        "by_role": role_dist,
    }


# ── Roles ───────────────────────────────────────────────────────────────────
@router.post("/roles", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
async def create_role(
    data: RoleCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not _can_see_all(current_user):
        raise HTTPException(403, "Only admins can manage roles")
    
    role = Role(
        id=str(uuid.uuid4()),
        name=data.name,
        description=data.description
    )
    db.add(role)
    await db.commit()
    await db.refresh(role)
    return RoleResponse.model_validate(role)

@router.get("/roles", response_model=List[RoleResponse])
async def list_roles(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Role).order_by(Role.name))
    return [RoleResponse.model_validate(r) for r in result.scalars().all()]

