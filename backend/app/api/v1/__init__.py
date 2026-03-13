"""API v1 routes."""

from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.boards import router as boards_router
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
from app.api.v1.landing import router as landing_router

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
api_router.include_router(landing_router, prefix="/landing", tags=["landing"])
api_router.include_router(landing_router, prefix="/onboarding", tags=["landing"])
