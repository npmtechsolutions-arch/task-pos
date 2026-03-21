"""Pydantic schemas for RBAC — roles, permissions, and user-role assignments."""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict

from app.models.rbac import ActionType, ResourceType, RoleScopeType, ScopeType


class PermissionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    resource: ResourceType
    action: ActionType
    scope: ScopeType
    description: Optional[str] = None


class RolePermissionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    role_id: str
    permission_id: str
    permission: PermissionResponse
    is_allowed: bool


class RoleCreate(BaseModel):
    name: str
    description: Optional[str] = None


class RoleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class RoleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: Optional[str] = None
    is_system: bool
    is_active: bool
    created_at: datetime
    permissions: List[RolePermissionResponse] = []


class RoleListResponse(BaseModel):
    items: List[RoleResponse]
    total: int


class SetRolePermissionsRequest(BaseModel):
    """Replace permissions on a role (full replacement for custom roles)."""
    permission_ids: List[str]  # IDs of permissions to ALLOW
    denied_permission_ids: List[str] = []  # IDs of permissions to DENY


class AssignRoleRequest(BaseModel):
    role_id: str
    scope_type: RoleScopeType = RoleScopeType.SYSTEM
    scope_id: Optional[str] = None  # project_id or team_id
    expires_at: Optional[datetime] = None


class UserRoleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    role_id: str
    role: RoleResponse
    scope_type: RoleScopeType
    scope_id: Optional[str] = None
    assigned_at: datetime
    expires_at: Optional[datetime] = None
    is_active: bool


class PermissionCheckRequest(BaseModel):
    resource: ResourceType
    action: ActionType
    scope_id: Optional[str] = None  # Project or team context


class PermissionCheckResponse(BaseModel):
    allowed: bool
    reason: str  # e.g. "Allowed by role 'Project Manager'", "Denied by explicit deny rule"
