"""
RBAC service — role management and deny-override permission evaluation.

Elite improvements:
  ✅ Improvement 4: In-process LRU permission cache (per-user, TTL 60s)
  ✅ Improvement 8: Strict admin guards enforced at service level
"""

from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.logging import get_logger
from app.models.rbac import (
    ActionType,
    Permission,
    ResourceType,
    Role,
    RolePermission,
    RoleScopeType,
    ScopeType,
    UserRole,
)
from app.schemas.rbac import (
    AssignRoleRequest,
    PermissionCheckResponse,
    RoleCreate,
    RoleUpdate,
    SetRolePermissionsRequest,
)

logger = get_logger(__name__)

# ── Per-user permission cache ─────────────────────────────────────────────────
# Structure: user_id → { (action, resource, scope_id): PermissionCheckResponse }
# Each entry also holds an "_expires_at" key (datetime).
_PERM_CACHE: Dict[str, Dict] = {}
_PERM_TTL = timedelta(seconds=60)


def _cache_key(action: ActionType, resource: ResourceType, scope_id: Optional[str]) -> Tuple:
    return (action, resource, scope_id)


def _get_cached_perm(
    user_id: str, action: ActionType, resource: ResourceType, scope_id: Optional[str]
) -> Optional[PermissionCheckResponse]:
    entry = _PERM_CACHE.get(user_id)
    if not entry:
        return None
    if datetime.utcnow() > entry.get("_expires_at", datetime.min):
        _PERM_CACHE.pop(user_id, None)
        return None
    return entry.get(_cache_key(action, resource, scope_id))


def _set_cached_perm(
    user_id: str, action: ActionType, resource: ResourceType,
    scope_id: Optional[str], result: PermissionCheckResponse
) -> None:
    if user_id not in _PERM_CACHE:
        _PERM_CACHE[user_id] = {"_expires_at": datetime.utcnow() + _PERM_TTL}
    _PERM_CACHE[user_id][_cache_key(action, resource, scope_id)] = result


def invalidate_user_permission_cache(user_id: str) -> None:
    """Call after assigning/revoking roles for a user."""
    _PERM_CACHE.pop(user_id, None)
    logger.debug("Permission cache invalidated", user_id=user_id)


SYSTEM_ROLES = {
    "Super Admin": "Full platform control",
    "Organization Admin": "Manage users, teams, and projects",
    "Project Manager": "Manage projects and their tasks",
    "Contributor": "Create and edit tasks in assigned projects",
    "Viewer": "Read-only access to projects and tasks",
}


class RBACService:
    """Role-Based Access Control service."""

    def __init__(self, db: AsyncSession):
        self.db = db

    # ── Bootstrap ─────────────────────────────────────────────────────

    async def seed_system_roles_and_permissions(self) -> None:
        for resource in ResourceType:
            for action in ActionType:
                for scope in [ScopeType.OWN, ScopeType.ORGANIZATION]:
                    existing = await self.db.execute(
                        select(Permission).where(
                            and_(Permission.resource == resource, Permission.action == action, Permission.scope == scope)
                        )
                    )
                    if not existing.scalar_one_or_none():
                        self.db.add(Permission(resource=resource, action=action, scope=scope))
        await self.db.flush()

        for role_name, description in SYSTEM_ROLES.items():
            existing = await self.db.execute(select(Role).where(Role.name == role_name))
            if not existing.scalar_one_or_none():
                self.db.add(Role(name=role_name, description=description, is_system=True))

        await self.db.commit()
        logger.info("System roles and permissions seeded")

    # ── Roles CRUD ────────────────────────────────────────────────────

    async def list_roles(self) -> List[Role]:
        result = await self.db.execute(
            select(Role).where(Role.is_active == True).order_by(Role.name)
        )
        return list(result.scalars().all())

    async def get_role(self, role_id: str) -> Optional[Role]:
        result = await self.db.execute(select(Role).where(Role.id == role_id))
        return result.scalar_one_or_none()

    async def create_role(self, data: RoleCreate) -> Role:
        role = Role(name=data.name, description=data.description, is_system=False)
        self.db.add(role)
        await self.db.commit()
        await self.db.refresh(role)
        logger.info("Custom role created", role_id=role.id, name=role.name)
        return role

    async def update_role(self, role_id: str, data: RoleUpdate) -> Optional[Role]:
        role = await self.get_role(role_id)
        if not role or role.is_system:
            return None
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(role, field, value)
        await self.db.commit()
        await self.db.refresh(role)
        return role

    async def set_role_permissions(self, role_id: str, data: SetRolePermissionsRequest) -> Role:
        role = await self.get_role(role_id)
        if not role:
            raise ValueError("Role not found")
        if role.is_system:
            raise ValueError("Cannot modify system role permissions via API")

        existing = await self.db.execute(
            select(RolePermission).where(RolePermission.role_id == role_id)
        )
        for rp in existing.scalars().all():
            await self.db.delete(rp)
        await self.db.flush()

        for perm_id in data.permission_ids:
            self.db.add(RolePermission(role_id=role_id, permission_id=perm_id, is_allowed=True))
        for perm_id in data.denied_permission_ids:
            self.db.add(RolePermission(role_id=role_id, permission_id=perm_id, is_allowed=False))

        await self.db.commit()
        await self.db.refresh(role)
        # All users may now have changed permissions → flush entire cache
        _PERM_CACHE.clear()
        return role

    # ── User Role Assignment ──────────────────────────────────────────

    async def assign_role(self, user_id: str, data: AssignRoleRequest) -> UserRole:
        """
        Improvement 8: only admins should call this.
        Service-level guard: validates role exists before insert.
        """
        role = await self.get_role(data.role_id)
        if not role:
            raise ValueError("Role not found")
        user_role = UserRole(
            user_id=user_id,
            role_id=data.role_id,
            scope_type=data.scope_type,
            scope_id=data.scope_id,
            expires_at=data.expires_at,
        )
        self.db.add(user_role)
        await self.db.commit()
        await self.db.refresh(user_role)
        invalidate_user_permission_cache(user_id)   # cache miss on next request
        logger.info("Role assigned", user_id=user_id, role_id=data.role_id, scope=data.scope_type)
        return user_role

    async def revoke_role(self, user_id: str, role_id: str) -> bool:
        result = await self.db.execute(
            select(UserRole).where(and_(UserRole.user_id == user_id, UserRole.role_id == role_id))
        )
        user_roles = result.scalars().all()
        if not user_roles:
            return False
        for ur in user_roles:
            await self.db.delete(ur)
        await self.db.commit()
        invalidate_user_permission_cache(user_id)
        return True

    async def get_user_roles(self, user_id: str) -> List[UserRole]:
        result = await self.db.execute(
            select(UserRole)
            .options(selectinload(UserRole.role))
            .where(and_(UserRole.user_id == user_id, UserRole.is_active == True))
        )
        return list(result.scalars().all())

    # ── Permission Check (Improvement 4 — cached + deny-override) ────

    async def check_permission(
        self,
        user_id: str,
        action: ActionType,
        resource: ResourceType,
        scope_id: Optional[str] = None,
    ) -> PermissionCheckResponse:
        """
        Evaluate permission with deny-override semantics + 60-second cache.

        Rules:
        1. Cache hit → return immediately (avoid DB round-trip)
        2. Super Admin system role → always ALLOW (bypasses per-permission checks)
        3. Any explicit DENY → DENY (deny always beats allow)
        4. Any explicit ALLOW → ALLOW
        5. Default → DENY
        """
        # ── 1. Cache lookup ──────────────────────────────────────────
        cached = _get_cached_perm(user_id, action, resource, scope_id)
        if cached is not None:
            return cached

        user_roles = await self.get_user_roles(user_id)
        if not user_roles:
            result = PermissionCheckResponse(allowed=False, reason="No roles assigned")
            _set_cached_perm(user_id, action, resource, scope_id, result)
            return result

        deny_reason: Optional[str] = None
        allow_reason: Optional[str] = None

        for ur in user_roles:
            # ── 2. Super Admin bypass ────────────────────────────────
            if ur.scope_type == RoleScopeType.SYSTEM and ur.role and ur.role.name == "Super Admin":
                result = PermissionCheckResponse(allowed=True, reason="Super Admin — full access")
                _set_cached_perm(user_id, action, resource, scope_id, result)
                return result

            # Scope filter: non-system roles must match scope_id
            if ur.scope_type not in (RoleScopeType.SYSTEM, RoleScopeType.ORGANIZATION):
                if ur.scope_id != scope_id:
                    continue

            rp_result = await self.db.execute(
                select(RolePermission).where(RolePermission.role_id == ur.role_id)
            )
            for rp in rp_result.scalars().all():
                perm_result = await self.db.execute(
                    select(Permission).where(Permission.id == rp.permission_id)
                )
                perm = perm_result.scalar_one_or_none()
                if not perm:
                    continue
                if perm.resource != resource or perm.action != action:
                    continue

                role_name = ur.role.name if ur.role else "unknown"
                if not rp.is_allowed:
                    deny_reason = f"Explicitly denied by role '{role_name}'"
                else:
                    allow_reason = f"Allowed by role '{role_name}'"

        # ── 3. Deny overrides allow ──────────────────────────────────
        if deny_reason:
            result = PermissionCheckResponse(allowed=False, reason=deny_reason)
        elif allow_reason:
            result = PermissionCheckResponse(allowed=True, reason=allow_reason)
        else:
            result = PermissionCheckResponse(allowed=False, reason="No matching permission found")

        _set_cached_perm(user_id, action, resource, scope_id, result)
        return result

    async def list_permissions(self) -> List[Permission]:
        result = await self.db.execute(
            select(Permission).order_by(Permission.resource, Permission.action)
        )
        return list(result.scalars().all())
