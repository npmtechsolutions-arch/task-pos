"""Super Admin — user management, role management, RBAC admin API."""

from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
import bcrypt

from app.api.deps import get_current_user, get_db
from app.core.logging import get_logger
from app.models.user import User, UserRole
from app.models.employee import EmployeeProfile
from app.services.notification import NotificationService

logger = get_logger(__name__)
router = APIRouter()


# ── Permission guard ──────────────────────────────────────────────────────────
def require_admin(current_user):
    if current_user.role not in (UserRole.ADMIN, UserRole.OWNER):
        raise HTTPException(status_code=403, detail="Super admin access required")


# ── Schemas ───────────────────────────────────────────────────────────────────
class AdminUserCreate(BaseModel):
    email: str
    first_name: str
    last_name: str
    password: str
    role: UserRole = UserRole.MEMBER
    title: Optional[str] = None
    department: Optional[str] = None


class AdminUserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    title: Optional[str] = None
    department: Optional[str] = None


class AdminUserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: UserRole
    is_active: bool
    created_at: datetime
    title: Optional[str] = None
    department: Optional[str] = None


class ResetPasswordRequest(BaseModel):
    new_password: str


# ── Users CRUD ────────────────────────────────────────────────────────────────
@router.get("/users", response_model=List[AdminUserResponse])
async def list_all_users(
    search: Optional[str] = Query(None),
    role: Optional[UserRole] = Query(None),
    is_active: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all users — admin only."""
    require_admin(current_user)
    q = select(User)
    if search:
        like = f"%{search}%"
        q = q.where(
            User.email.ilike(like) |
            User.first_name.ilike(like) |
            User.last_name.ilike(like)
        )
    if role:
        q = q.where(User.role == role)
    if is_active is not None:
        q = q.where(User.is_active == is_active)
    q = q.offset((page - 1) * per_page).limit(per_page).order_by(User.created_at.desc())
    result = await db.execute(q)
    return [AdminUserResponse.model_validate(u) for u in result.scalars().all()]


@router.post("/users", response_model=AdminUserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    data: AdminUserCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Super admin creates a new user with specified role."""
    require_admin(current_user)

    # Check email uniqueness
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    import uuid
    pw_hash = bcrypt.hashpw(data.password.encode(), bcrypt.gensalt()).decode()
    user = User(
        id=str(uuid.uuid4()),
        email=data.email,
        first_name=data.first_name,
        last_name=data.last_name,
        password_hash=pw_hash,
        role=data.role,
        is_active=True,
    )
    db.add(user)
    await db.flush()

    # Create employee profile if title/dept provided
    if data.title or data.department:
        profile = EmployeeProfile(
            user_id=user.id,
            title=data.title,
            department=data.department,
        )
        db.add(profile)

    await db.commit()
    await db.refresh(user)

    # Notify all admins & owners
    admins_res = await db.execute(select(User).where(User.role.in_([UserRole.ADMIN, UserRole.OWNER])))
    admins = admins_res.scalars().all()
    ns = NotificationService(db)
    for adm in admins:
        # Prevent self-notification if admin created the user
        if adm.id != current_user.id:
            await ns.notify_user_hired(adm.id, f"{data.first_name} {data.last_name}", user.id)

    logger.info("Admin created user", admin_id=current_user.id, new_user_id=user.id)
    return AdminUserResponse.model_validate(user)


@router.put("/users/{user_id}", response_model=AdminUserResponse)
async def update_user(
    user_id: str,
    data: AdminUserUpdate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update user details or role."""
    require_admin(current_user)
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    for key, val in data.model_dump(exclude_unset=True).items():
        if key not in ('title', 'department'):
            setattr(user, key, val)
    await db.commit()
    await db.refresh(user)
    return AdminUserResponse.model_validate(user)


@router.post("/users/{user_id}/reset-password", status_code=status.HTTP_204_NO_CONTENT)
async def reset_user_password(
    user_id: str,
    data: ResetPasswordRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Reset a user's password — admin only."""
    require_admin(current_user)
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.password_hash = bcrypt.hashpw(data.new_password.encode(), bcrypt.gensalt()).decode()
    await db.commit()
    logger.info("Admin reset password", admin_id=current_user.id, target_user=user_id)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_user(
    user_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Deactivate (soft-delete) a user."""
    require_admin(current_user)
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate yourself")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = False
    await db.commit()

    # Notify all admins & owners
    admins_res = await db.execute(select(User).where(User.role.in_([UserRole.ADMIN, UserRole.OWNER])))
    admins = admins_res.scalars().all()
    ns = NotificationService(db)
    for adm in admins:
        # Prevent self-notification if admin deactivated the user
        if adm.id != current_user.id:
            await ns.notify_user_fired(adm.id, f"{user.first_name} {user.last_name}")


@router.get("/stats")
async def admin_stats(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin dashboard stats: user counts by role."""
    require_admin(current_user)
    role_counts_result = await db.execute(
        select(User.role, func.count(User.id)).group_by(User.role)
    )
    role_counts = {str(row[0]).split('.')[-1]: row[1] for row in role_counts_result.all()}
    total_result = await db.execute(select(func.count(User.id)))
    active_result = await db.execute(select(func.count(User.id)).where(User.is_active == True))
    return {
        "total_users": total_result.scalar() or 0,
        "active_users": active_result.scalar() or 0,
        "by_role": role_counts,
    }
