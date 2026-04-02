"""Org team and hierarchy models — separate from project-level team membership."""

import uuid
from datetime import datetime
from enum import Enum as PyEnum
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.tenant import Tenant


class OrgTeamType(str, PyEnum):
    """Organization team type."""
    PERMANENT = "permanent"    # Departmental (e.g. Frontend Team)
    PROJECT = "project"        # Cross-functional, project-driven
    ADHOC = "adhoc"            # Temporary working group


class OrgTeamMemberRole(str, PyEnum):
    """Role within an org team."""
    LEADER = "leader"
    MEMBER = "member"


class OrgTeam(Base):
    """Organization-level team (distinct from project members)."""

    __tablename__ = "org_teams"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    tenant_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    team_type: Mapped[OrgTeamType] = mapped_column(default=OrgTeamType.PERMANENT)
    department: Mapped[Optional[str]] = mapped_column(String(100), index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    created_by: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="teams")
    creator: Mapped[Optional["User"]] = relationship(
        "User", foreign_keys=[created_by], lazy="selectin"
    )
    members: Mapped[List["OrgTeamMember"]] = relationship(
        "OrgTeamMember",
        back_populates="team",
        lazy="selectin",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<OrgTeam(id={self.id}, name={self.name}, type={self.team_type})>"


class OrgTeamMember(Base):
    """Membership record linking a User to an OrgTeam."""

    __tablename__ = "org_team_members"
    __table_args__ = (
        UniqueConstraint("team_id", "user_id", name="uq_org_team_user"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    team_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("org_teams.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    role: Mapped[OrgTeamMemberRole] = mapped_column(default=OrgTeamMemberRole.MEMBER)
    joined_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    team: Mapped["OrgTeam"] = relationship(
        "OrgTeam", back_populates="members", lazy="selectin"
    )
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id], lazy="selectin")

    def __repr__(self) -> str:
        return f"<OrgTeamMember(team={self.team_id}, user={self.user_id}, role={self.role})>"


class ReportingStructure(Base):
    """Manager → Subordinate reporting hierarchy (supports matrix org)."""

    __tablename__ = "reporting_structure"
    __table_args__ = (
        UniqueConstraint(
            "manager_id", "subordinate_id",
            name="uq_reporting_pair",
        ),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    manager_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    subordinate_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    is_primary: Mapped[bool] = mapped_column(Boolean, default=True)  # Primary vs dotted-line
    effective_from: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    effective_to: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    manager: Mapped["User"] = relationship(
        "User", foreign_keys=[manager_id], lazy="selectin"
    )
    subordinate: Mapped["User"] = relationship(
        "User", foreign_keys=[subordinate_id], lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<ReportingStructure(manager={self.manager_id}, sub={self.subordinate_id})>"
