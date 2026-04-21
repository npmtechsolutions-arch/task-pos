"""Project API routes."""

import json
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi import File, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.core.logging import get_logger
from app.models.project import ProjectMemberRole, ProjectStatus
from app.schemas.project import (
    ProjectCreate,
    ProjectDetailResponse,
    ProjectFilterParams,
    ProjectListResponse,
    ProjectMemberCreate,
    ProjectMemberResponse,
    ProjectMemberUpdate,
    ProjectMembersBulkCreate,
    ProjectPrdFileResponse,
    ProjectResponse,
    ProjectUpdate,
)
from app.services.file_storage import resolve_local_path, save_project_prd_upload
from app.services.project import ProjectService

logger = get_logger(__name__)
router = APIRouter()


async def _response_with_prd(project_service: ProjectService, project) -> ProjectResponse:
    latest = await project_service.get_latest_prd_file(project.id)
    base = ProjectResponse.model_validate(project)
    if latest:
        return base.model_copy(update={"prd_file": ProjectPrdFileResponse.model_validate(latest)})
    return base


@router.get("", response_model=ProjectListResponse)
async def list_projects(
    status: Optional[ProjectStatus] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProjectListResponse:
    """List projects for current user."""
    filters = ProjectFilterParams(
        status=status,
        search=search,
        page=page,
        per_page=per_page,
    )

    project_service = ProjectService(db)
    projects, total = await project_service.list_projects(
        user_id=current_user.id,
        filters=filters,
    )

    return ProjectListResponse(
        items=[ProjectResponse.model_validate(p) for p in projects],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    request: Request,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProjectResponse:
    """Create a new project. Send JSON body, or multipart form with `project` (JSON) and optional `prd_file`."""
    project_service = ProjectService(db)
    prd_upload: UploadFile | None = None
    content_type = request.headers.get("content-type", "")

    if "multipart/form-data" in content_type:
        form = await request.form()
        raw_project = form.get("project")
        if raw_project is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Multipart create requires a 'project' field with JSON metadata.",
            )
        if hasattr(raw_project, "read"):
            raw_project = (await raw_project.read()).decode("utf-8")
        try:
            body = json.loads(str(raw_project))
        except json.JSONDecodeError:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Invalid JSON in 'project' field")
        project_data = ProjectCreate.model_validate(body)
        maybe_file = form.get("prd_file")
        if maybe_file and isinstance(maybe_file, UploadFile) and maybe_file.filename:
            prd_upload = maybe_file
    else:
        try:
            body = await request.json()
        except json.JSONDecodeError:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Invalid JSON body")
        project_data = ProjectCreate.model_validate(body)

    if not project_data.tenant_id:
        project_data = project_data.model_copy(update={"tenant_id": current_user.tenant_id})

    try:
        project = await project_service.create(project_data, current_user.id)
        if prd_upload:
            try:
                key, fname, ctype, size = await save_project_prd_upload(project.id, prd_upload)
                await project_service.attach_prd_file(
                    project.id, current_user.id, key, fname, ctype, size
                )
            except ValueError as e:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(e))
        await db.refresh(project)
        return await _response_with_prd(project_service, project)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get("/{project_id}", response_model=ProjectDetailResponse)
async def get_project(
    project_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProjectDetailResponse:
    """Get project by ID."""
    project_service = ProjectService(db)
    project = await project_service.get_with_members(project_id)

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    # Check if user is a member
    if not await project_service.is_project_member(project_id, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )

    base = ProjectDetailResponse.model_validate(project)
    latest = await project_service.get_latest_prd_file(project_id)
    if latest:
        return base.model_copy(update={"prd_file": ProjectPrdFileResponse.model_validate(latest)})
    return base


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str,
    project_data: ProjectUpdate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProjectResponse:
    """Update project."""
    project_service = ProjectService(db)

    # Check permissions
    if not await project_service.has_permission(
        project_id, current_user.id, ProjectMemberRole.ADMIN
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions",
        )

    updated_project = await project_service.update(project_id, project_data)

    if not updated_project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    return await _response_with_prd(project_service, updated_project)


@router.post("/{project_id}/transition", response_model=ProjectResponse)
async def transition_project_status(
    project_id: str,
    status: ProjectStatus = Query(...),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProjectResponse:
    """Transition project lifecycle status."""
    project_service = ProjectService(db)

    # Check permissions
    if not await project_service.has_permission(
        project_id, current_user.id, ProjectMemberRole.ADMIN
    ):
        raise HTTPException(
            status_code=403,
            detail="Insufficient permissions",
        )

    # Note: In a real system, robust validation would live in the service layer
    updated_project = await project_service.update(project_id, ProjectUpdate(status=status))

    if not updated_project:
        raise HTTPException(status_code=404, detail="Project not found")

    return await _response_with_prd(project_service, updated_project)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def archive_project(
    project_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Archive project."""
    project_service = ProjectService(db)

    # Check permissions (only owner can archive)
    if not await project_service.has_permission(
        project_id, current_user.id, ProjectMemberRole.OWNER
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only project owner can archive",
        )

    success = await project_service.archive(project_id)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )


@router.get("/{project_id}/prd/download")
async def download_project_prd(
    project_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Download latest PRD file (project members and task assignees only)."""
    project_service = ProjectService(db)
    if not await project_service.user_can_access_prd(project_id, current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    latest = await project_service.get_latest_prd_file(project_id)
    if not latest:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No PRD uploaded for this project")
    try:
        path = resolve_local_path(latest.storage_key)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid file reference")
    if not path.is_file():
        raise HTTPException(status_code=404, detail="PRD file is no longer on the server")
    return FileResponse(
        path,
        filename=latest.file_name,
        media_type=latest.file_type or "application/octet-stream",
    )


# Member management

@router.post("/{project_id}/members", response_model=ProjectMemberResponse)
async def add_project_member(
    project_id: str,
    member_data: ProjectMemberCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProjectMemberResponse:
    """Add member to project."""
    project_service = ProjectService(db)

    # Check permissions
    if not await project_service.has_permission(
        project_id, current_user.id, ProjectMemberRole.ADMIN
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions",
        )

    try:
        member = await project_service.add_member(project_id, member_data)

        # 🔔 Notify the new member that they were added to this project
        try:
            from app.services.notification import NotificationService
            from app.websocket.manager import manager
            project = await project_service.get_by_id(project_id)
            notif_service = NotificationService(db)
            notif = await notif_service.notify_project_invitation(
                user_id=member_data.user_id,
                project_id=project_id,
                project_name=project.name if project else project_id,
                inviter_name=f"{current_user.first_name or ''} {current_user.last_name or ''}".strip() or current_user.email,
            )
            await manager.send_to_user(member_data.user_id, {
                "type": "notification",
                "data": {
                    "id": notif.id,
                    "notification_type": notif.notification_type.value if hasattr(notif.notification_type, 'value') else str(notif.notification_type),
                    "title": notif.title,
                    "message": notif.message,
                    "action_url": notif.action_url,
                    "is_read": False,
                    "created_at": notif.created_at.isoformat(),
                }
            })
        except Exception:
            pass  # Notifications must never break the main request

        return ProjectMemberResponse.model_validate(member)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post("/{project_id}/members/bulk", response_model=List[ProjectMemberResponse])
async def add_project_members_bulk(
    project_id: str,
    body: ProjectMembersBulkCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[ProjectMemberResponse]:
    """Add up to 50 members in one request."""
    project_service = ProjectService(db)
    if not await project_service.has_permission(
        project_id, current_user.id, ProjectMemberRole.ADMIN
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions",
        )
    members = await project_service.add_members_bulk(project_id, body)
    return [ProjectMemberResponse.model_validate(m) for m in members]


@router.put("/{project_id}/members/{user_id}", response_model=ProjectMemberResponse)
async def update_project_member(
    project_id: str,
    user_id: str,
    member_data: ProjectMemberUpdate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProjectMemberResponse:
    """Update project member."""
    project_service = ProjectService(db)

    # Check permissions
    if not await project_service.has_permission(
        project_id, current_user.id, ProjectMemberRole.ADMIN
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions",
        )

    member = await project_service.update_member(project_id, user_id, member_data)

    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found",
        )

    return ProjectMemberResponse.model_validate(member)


@router.delete("/{project_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_project_member(
    project_id: str,
    user_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Remove member from project."""
    project_service = ProjectService(db)

    # Check permissions (can't remove owner, admins can remove others)
    if user_id != current_user.id:
        if not await project_service.has_permission(
            project_id, current_user.id, ProjectMemberRole.ADMIN
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )

    success = await project_service.remove_member(project_id, user_id)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found",
        )
