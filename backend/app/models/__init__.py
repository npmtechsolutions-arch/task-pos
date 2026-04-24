"""Models package."""

from app.models.board import Board, BoardColumn, BoardSwimlane
from app.models.communication import CommentReaction, EmailLog, EmailStatus
from app.models.milestone import Milestone, MilestoneRisk, MilestoneStatus, MilestoneType
from app.models.notification import Notification, NotificationPreference
from app.models.project import (
    PhaseStatus,
    Project,
    ProjectMember,
    ProjectMemberRole,
    ProjectPhase,
    ProjectStatus,
    ProjectTemplate,
    ProjectVisibility,
    TemplateType,
)
from app.models.task import (
    ActivityAction,
    DependencyType,
    KanbanLabel,
    Tag,
    Task,
    TaskActivity,
    TaskAssignment,
    TaskComment,
    TaskDependency,
    TaskPriority,
    TaskStatus,
    TaskType,
    TimeEntry,
)
from app.models.task_workflow import TaskWorkflow, TaskWorkflowState
from app.models.timesheet import Timesheet, TimesheetEntry, TimesheetStatus
from app.models.user import User, UserRole, UserStatus
from app.models.workflow import (
    WorkflowStage,
    WorkflowTemplate,
    WorkflowTemplateType,
    WorkflowTransition,
)
from app.models.landing import (
    LandingHero,
    LandingFeature,
    LandingBadge,
    PricingTier,
    PricingFeature,
    FooterCategory,
    FooterLink,
    LandingLead,
)

# ── Employee Management Module ──────────────────────────────────────
from app.models.employee import (
    EmployeeProfile,
    Skill,
    SkillCategory,
    UserSkill,
    ValidationStatus,
)
from app.models.org_team import (
    OrgTeam,
    OrgTeamMember,
    OrgTeamMemberRole,
    OrgTeamType,
    ReportingStructure,
)
from app.models.rbac import (
    ActionType,
    Permission,
    ResourceType,
    Role,
    RolePermission,
    RoleScopeType,
    ScopeType,
    UserRole as UserRoleAssignment,
)
from app.models.capacity import (
    AvailabilityStatus,
    UserAvailability,
    UserCapacity,
)

__all__ = [
    # Core
    "User", "UserRole", "UserStatus",
    "Project", "ProjectMember", "ProjectMemberRole", "ProjectStatus",
    "ProjectVisibility", "ProjectPhase", "PhaseStatus",
    "ProjectTemplate", "TemplateType",
    "Task", "TaskStatus", "TaskPriority", "TaskType",
    "TaskComment", "TaskAssignment", "TaskActivity",
    "TaskDependency", "DependencyType", "ActivityAction",
    "Tag", "KanbanLabel", "TimeEntry",
    "TaskWorkflow", "TaskWorkflowState",
    "Timesheet", "TimesheetEntry", "TimesheetStatus",
    "Board", "BoardColumn", "BoardSwimlane",
    "Milestone", "MilestoneType", "MilestoneStatus", "MilestoneRisk",
    "WorkflowTemplate", "WorkflowStage", "WorkflowTransition", "WorkflowTemplateType",
    "Notification", "NotificationPreference",
    "CommentReaction", "EmailLog", "EmailStatus",
    "LandingHero", "LandingFeature", "LandingBadge", "PricingTier",
    "PricingFeature", "FooterCategory", "FooterLink", "LandingLead",
    # Employee Management Module
    "EmployeeProfile", "Skill", "SkillCategory", "UserSkill", "ValidationStatus",
    "OrgTeam", "OrgTeamMember", "OrgTeamMemberRole", "OrgTeamType", "ReportingStructure",
    "Role", "Permission", "RolePermission", "UserRoleAssignment",
    "ResourceType", "ActionType", "ScopeType", "RoleScopeType",
    "UserCapacity", "UserAvailability", "AvailabilityStatus",
    # Analytics & Reporting Module
    "SavedReport", "ReportSchedule", "ReportArchive", "DashboardConfig",
    "ReportFrequency", "ExportFormat", "RetentionTier",
    # HR & Tenant & Calendar & Document
    "Tenant", "TenantStatus",
    "Candidate", "Intern", "LeaveRequest", "ApprovalStatus", "InternStatus",
    "CalendarEvent", "CalendarEventType",
    "Document", "TaskFile", "DocumentStatus",
    # Support System
    "Ticket", "TicketStatus", "TicketPriority", "TicketCategory", "TicketMessage",
]

# ── Analytics & Reporting Module ────────────────────────────────────
from app.models.analytics import (  # noqa: E402
    DashboardConfig,
    ExportFormat,
    ReportArchive,
    ReportFrequency,
    ReportSchedule,
    RetentionTier,
    SavedReport,
)

from app.models.tenant import Tenant, TenantStatus
from app.models.hr_records import Candidate, Intern, LeaveRequest, ApprovalStatus, InternStatus
from app.models.calendar import CalendarEvent, CalendarEventType
from app.models.document import Document, TaskFile, DocumentStatus

# ── Support System Module ───────────────────────────────────────────
from app.models.support import (
    Ticket,
    TicketCategory,
    TicketMessage,
    TicketPriority,
    TicketStatus,
)
