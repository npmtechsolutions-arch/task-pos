"""API v1 routes."""

from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.boards import router as boards_router
from app.api.v1.comments import router as comments_router
from app.api.v1.activity import router as activity_router
from app.api.v1.critical_path import router as critical_path_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.kanban import router as kanban_router
from app.api.v1.milestones import router as milestones_router
from app.api.v1.notifications import router as notifications_router
from app.api.v1.phases import router as phases_router
from app.api.v1.projects import router as projects_router
from app.api.v1.reports import router as reports_router
from app.api.v1.tasks import router as tasks_router
from app.api.v1.team import router as team_router
from app.api.v1.templates import router as templates_router
from app.api.v1.users import router as users_router
from app.api.v1.workflows import router as workflows_router
from app.api.v1.timesheets import router as timesheets_router
from app.api.v1.capacity import router as capacity_router
from app.api.v1.landing import router as landing_router
# ── Employee Management Module ──────────────────────────────────────────────
from app.api.v1.employees import router as employees_router
from app.api.v1.org_teams import router as org_teams_router
from app.api.v1.rbac import router as rbac_router

api_router = APIRouter()

api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(users_router, prefix="/users", tags=["users"])
api_router.include_router(projects_router, prefix="/projects", tags=["projects"])
api_router.include_router(phases_router, prefix="/projects", tags=["phases"])
api_router.include_router(templates_router, prefix="/templates", tags=["templates"])
api_router.include_router(milestones_router, prefix="/milestones", tags=["milestones"])
api_router.include_router(critical_path_router, prefix="/projects", tags=["critical-path"])
api_router.include_router(tasks_router, prefix="/tasks", tags=["tasks"])
api_router.include_router(boards_router, prefix="/boards", tags=["boards"])
api_router.include_router(kanban_router, prefix="/kanban", tags=["kanban"])
api_router.include_router(dashboard_router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(team_router, prefix="/team", tags=["team"])
api_router.include_router(reports_router, prefix="/reports", tags=["reports"])
api_router.include_router(
    notifications_router, prefix="/notifications", tags=["notifications"]
)
api_router.include_router(workflows_router, prefix="/workflows", tags=["workflows"])
api_router.include_router(timesheets_router, prefix="/timesheets", tags=["timesheets"])
api_router.include_router(capacity_router, prefix="/capacity", tags=["capacity"])
api_router.include_router(landing_router, prefix="/landing", tags=["landing"])
api_router.include_router(landing_router, prefix="/onboarding", tags=["landing"])
api_router.include_router(comments_router, prefix="", tags=["comments"])
api_router.include_router(activity_router, prefix="/activity", tags=["activity"])
# ── Analytics & Reporting Module ───────────────────────────────────────────────
from app.api.v1.analytics import router as analytics_router
from app.api.v1.admin import router as admin_router
from app.api.v1.hr import router as hr_router
from app.api.v1.calendar_api import router as calendar_router

api_router.include_router(employees_router, prefix="/employees", tags=["employees"])
api_router.include_router(org_teams_router, prefix="/org-teams", tags=["org-teams"])
api_router.include_router(rbac_router, prefix="/rbac", tags=["rbac"])
api_router.include_router(analytics_router, prefix="/analytics", tags=["analytics"])
api_router.include_router(admin_router, prefix="/admin", tags=["admin"])
api_router.include_router(hr_router, prefix="/hr", tags=["hr"])
api_router.include_router(calendar_router, prefix="/calendar", tags=["calendar"])
