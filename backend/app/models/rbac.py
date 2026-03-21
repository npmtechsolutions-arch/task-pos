"""Role-Based Access Control (RBAC) models.

Permission evaluation order:
  1. DENY overrides all ALLOW
  2. User-level role > Team-level role
  3. Project role + Org role = combined (additive)
"""

import uuid
from datetime import datetime
from enum import Enum as PyEnum
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class ResourceType(str, PyEnum):
    """Resources that can be access-controlled."""
    TASK = "task"
    PROJECT = "project"
    USER = "user"
    TEAM = "team"
    REPORT = "report"
    ADMIN = "admin"
    TIMESHEET = "timesheet"
    SKILL = "skill"
    CAPACITY = "capacity"


class ActionType(str, PyEnum):
    """Actions that can be performed on resources."""
    CREATE = "create"
    READ = "read"
    UPDATE = "update"
    DELETE = "delete"
    ADMINISTER = "administer"


class ScopeType(str, PyEnum):
    """Permission scope."""
    OWN = "own"               # Only own resources
    TEAM = "team"             # Team-level
    PROJECT = "project"       # Project-level
    ORGANIZATION = "organization"  # Org-wide


class RoleScopeType(str, PyEnum):
    """Scope at which a role is assigned to a user."""
    SYSTEM = "system"         # Platform-wide (Super Admin, Org Admin)
    PROJECT = "project"       # Project-scoped role
    TEAM = "team"             # Team-scoped role


class Role(Base):
    """Role definition — system-defined or custom."""

    __tablename__ = "roles"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    description: Mapped[Optional[str]] = mapped_column(Text)
    # is_system: True for built-in roles (Super Admin, Org Admin, etc.)
    is_system: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    role_permissions: Mapped[List["RolePermission"]] = relationship(
        "RolePermission", back_populates="role", lazy="selectin",
        cascade="all, delete-orphan"
    )
    user_roles: Mapped[List["UserRole"]] = relationship(
        "UserRole", back_populates="role", lazy="noload"
    )

    def __repr__(self) -> str:
        return f"<Role(id={self.id}, name={self.name})>"


class Permission(Base):
    """Atomic permission: a (resource, action, scope) triple."""

    __tablename__ = "permissions"
    __table_args__ = (
        UniqueConstraint("resource", "action", "scope", name="uq_permission"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    resource: Mapped[ResourceType] = mapped_column(nullable=False)
    action: Mapped[ActionType] = mapped_column(nullable=False)
    scope: Mapped[ScopeType] = mapped_column(default=ScopeType.ORGANIZATION)
    description: Mapped[Optional[str]] = mapped_column(String(255))

    role_permissions: Mapped[List["RolePermission"]] = relationship(
        "RolePermission", back_populates="permission", lazy="noload"
    )

    def __repr__(self) -> str:
        return f"<Permission({self.resource}:{self.action}:{self.scope})>"


class RolePermission(Base):
    """Many-to-many junction: Role → Permissions."""

    __tablename__ = "role_permissions"
    __table_args__ = (
        UniqueConstraint("role_id", "permission_id", name="uq_role_permission"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    role_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("roles.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    permission_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("permissions.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    # True = ALLOW, False = DENY (deny overrides all allows)
    is_allowed: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    role: Mapped["Role"] = relationship("Role", back_populates="role_permissions")
    permission: Mapped["Permission"] = relationship(
        "Permission", back_populates="role_permissions", lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<RolePermission(role={self.role_id}, perm={self.permission_id}, allowed={self.is_allowed})>"


class UserRole(Base):
    """Assigns a Role to a User at a certain scope."""

    __tablename__ = "user_roles"
    __table_args__ = (
        UniqueConstraint("user_id", "role_id", "scope_type", "scope_id", name="uq_user_role_scope"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    role_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("roles.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    scope_type: Mapped[RoleScopeType] = mapped_column(default=RoleScopeType.SYSTEM)
    # scope_id: project_id or team_id depending on scope_type (null for SYSTEM)
    scope_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True, index=True)

    assigned_by: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=True
    )
    assigned_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    user: Mapped["User"] = relationship(
        "User", foreign_keys=[user_id], lazy="selectin"
    )
    role: Mapped["Role"] = relationship("Role", back_populates="user_roles", lazy="selectin")
    assigner: Mapped[Optional["User"]] = relationship(
        "User", foreign_keys=[assigned_by], lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<UserRole(user={self.user_id}, role={self.role_id}, scope={self.scope_type})>"
