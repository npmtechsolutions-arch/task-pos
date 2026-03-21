"""Employee skill models — extends the User model with skill intelligence."""

import uuid
from datetime import datetime
from enum import Enum as PyEnum
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class ValidationStatus(str, PyEnum):
    """Skill validation status."""
    SELF = "self"
    PEER = "peer"
    CERTIFIED = "certified"


class SkillCategory(Base):
    """Hierarchical skill taxonomy node (e.g. Development → Backend → Python)."""

    __tablename__ = "skill_categories"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    parent_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("skill_categories.id"), nullable=True, index=True
    )
    description: Mapped[Optional[str]] = mapped_column(Text)
    color: Mapped[str] = mapped_column(String(7), default="#6366F1")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Self-referential: children categories
    children: Mapped[List["SkillCategory"]] = relationship(
        "SkillCategory",
        primaryjoin="SkillCategory.parent_id == SkillCategory.id",
        lazy="selectin",
        cascade="all, delete-orphan",
    )
    skills: Mapped[List["Skill"]] = relationship(
        "Skill", back_populates="category", lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<SkillCategory(id={self.id}, name={self.name})>"


class Skill(Base):
    """Individual skill record linked to a category."""

    __tablename__ = "skills"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    category_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("skill_categories.id"), nullable=True, index=True
    )
    description: Mapped[Optional[str]] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    category: Mapped[Optional["SkillCategory"]] = relationship(
        "SkillCategory", back_populates="skills", lazy="selectin"
    )
    user_skills: Mapped[List["UserSkill"]] = relationship(
        "UserSkill", back_populates="skill", lazy="noload"
    )

    def __repr__(self) -> str:
        return f"<Skill(id={self.id}, name={self.name})>"


class UserSkill(Base):
    """Maps a user to a skill with proficiency level and validation status."""

    __tablename__ = "user_skills"
    __table_args__ = (UniqueConstraint("user_id", "skill_id", name="uq_user_skill"),)

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    skill_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("skills.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    # Proficiency 1=Beginner, 2=Elementary, 3=Intermediate, 4=Advanced, 5=Expert
    proficiency_level: Mapped[int] = mapped_column(Integer, default=1)
    validation_status: Mapped[ValidationStatus] = mapped_column(
        default=ValidationStatus.SELF
    )
    # Admin/peer who validated (nullable for self-assessed)
    validated_by: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=True
    )
    validated_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    notes: Mapped[Optional[str]] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    user: Mapped["User"] = relationship(
        "User", foreign_keys=[user_id], lazy="selectin"
    )
    skill: Mapped["Skill"] = relationship(
        "Skill", back_populates="user_skills", lazy="selectin"
    )
    validator: Mapped[Optional["User"]] = relationship(
        "User", foreign_keys=[validated_by], lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<UserSkill(user={self.user_id}, skill={self.skill_id}, level={self.proficiency_level})>"


class EmployeeProfile(Base):
    """Extended employee profile — professional details beyond the base User model."""

    __tablename__ = "employee_profiles"

    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True
    )
    title: Mapped[Optional[str]] = mapped_column(String(150))
    department: Mapped[Optional[str]] = mapped_column(String(100), index=True)
    hire_date: Mapped[Optional[datetime]] = mapped_column(DateTime)
    location: Mapped[Optional[str]] = mapped_column(String(150))

    # Flexible preferences stored as JSONB
    preferences: Mapped[dict] = mapped_column(
        JSONB,
        default=lambda: {
            "notification_settings": {"email": True, "push": True, "in_app": True},
            "default_view": "board",
            "calendar_integration": None,
        }
    )

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    user: Mapped["User"] = relationship("User", foreign_keys=[user_id], lazy="selectin")

    def __repr__(self) -> str:
        return f"<EmployeeProfile(user={self.user_id}, title={self.title})>"
