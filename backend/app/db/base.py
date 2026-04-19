"""SQLAlchemy base configuration with all models registered."""

from sqlalchemy import MetaData
from sqlalchemy.orm import DeclarativeBase, declared_attr

convention = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    """Base class for all models."""

    metadata = MetaData(naming_convention=convention)

    @declared_attr.directive
    def __tablename__(cls) -> str:
        return cls.__name__.lower() + "s"

    def to_dict(self) -> dict:
        return {
            column.name: getattr(self, column.name)
            for column in self.__table__.columns
        }


# Register all models for Alembic autogenerate
from app.models.tenant import Tenant
from app.models.user import User
from app.models.project import Project, ProjectMember, ProjectPhase
from app.models.task import (
    Task, Tag, KanbanLabel, TaskDependency, TaskComment, 
    TimeEntry, TaskAssignment, TaskActivity
)
from app.models.org_team import OrgTeam, OrgTeamMember, ReportingStructure
from app.models.employee import SkillCategory, Skill, UserSkill
from app.models.board import Board, BoardColumn, BoardSwimlane
from app.models.milestone import Milestone
from app.models.timesheet import Timesheet, TimesheetEntry
from app.models.hr_hierarchy import Department, HRAssignment, HRCustomRole
from app.models.rbac import Role, Permission, RolePermission, UserRole as RBACUserRole
from app.models.landing import (
    LandingNavbar, LandingHero, LandingStat, LandingFeature,
    LandingTestimonial, LandingBadge, PricingTier, PricingFeature,
    FooterCategory, FooterLink, LandingAbout, LandingStep,
    LandingCTA, LandingContact, LandingLead
)
from app.models.document import Document, TaskFile
