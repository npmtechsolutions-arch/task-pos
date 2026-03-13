"""Critical path and dependency analysis API."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.services.critical_path import CriticalPathService
from app.services.project import ProjectService
from pydantic import BaseModel

router = APIRouter()


class DelaySimulationRequest(BaseModel):
    task_id: str
    delay_hours: float


@router.get("/{project_id}/critical-path")
async def get_critical_path(
    project_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Compute the critical path for a project.
    Returns task analysis data and the ordered critical path.
    """
    project_service = ProjectService(db)
    if not await project_service.is_project_member(project_id, current_user.id):
        raise HTTPException(status_code=403, detail="Access denied")

    cp_service = CriticalPathService(db)
    result = await cp_service.analyze_project(project_id)

    if "error" in result:
        raise HTTPException(status_code=400, detail=result)

    return result


@router.post("/{project_id}/simulate-delay")
async def simulate_delay(
    project_id: str,
    body: DelaySimulationRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    What-if analysis: simulate delaying a specific task
    and return the cascade impact on the project timeline.
    """
    project_service = ProjectService(db)
    if not await project_service.is_project_member(project_id, current_user.id):
        raise HTTPException(status_code=403, detail="Access denied")

    cp_service = CriticalPathService(db)
    result = await cp_service.simulate_delay(project_id, body.task_id, body.delay_hours)
    return result
