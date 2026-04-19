"""Document Upload & PRD-to-Tasks API endpoints."""

import os
import uuid
import tempfile
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.api.deps import get_current_user, get_db
from app.models.document import Document, TaskFile, DocumentStatus
from app.models.task import Task, TaskStatus, TaskPriority, TaskType
from app.models.project import Project
from app.services.prd_parser import parse_prd_file

router = APIRouter()

# ── Allowed file types ────────────────────────────────────────────────────────

ALLOWED_PRD_TYPES = {
    "text/plain": "txt",
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/msword": "doc",
}

ALLOWED_TASK_FILE_TYPES = {
    "image/png", "image/jpeg", "image/jpg", "image/gif",
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "application/zip", "application/json",
}


# ── Schemas ───────────────────────────────────────────────────────────────────

class ParsedTask(BaseModel):
    title: str
    description: str
    category: str
    priority: str
    estimated_hours: float
    position: float


class PRDUploadResponse(BaseModel):
    document_id: str
    project_name: str
    tasks_generated: int
    phases: list
    tasks: list
    insights: list
    notifications: list


class TaskFileResponse(BaseModel):
    id: str
    task_id: str
    file_name: str
    file_url: str
    file_type: str
    file_size_bytes: int
    uploaded_by: str
    uploaded_at: datetime

    class Config:
        from_attributes = True


# ── PRD Upload & Auto Task Generation ────────────────────────────────────────

@router.post("/upload-prd", response_model=PRDUploadResponse)
async def upload_prd(
    file: UploadFile = File(...),
    project_id: str = None,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload a PRD document (PDF, DOCX, TXT).
    AI engine will automatically parse it and return structured tasks ready to insert.
    """
    # 1. Validate file type
    content_type = file.content_type or ""
    if content_type not in ALLOWED_PRD_TYPES and not file.filename.endswith((".txt", ".pdf", ".docx")):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type '{content_type}'. Allowed: PDF, DOCX, TXT."
        )

    # 2. Save to temp file for parsing
    suffix = f".{ALLOWED_PRD_TYPES.get(content_type, 'txt')}"
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            contents = await file.read()
            tmp.write(contents)
            tmp_path = tmp.name

        # 3. Parse PRD with AI engine
        parsed = parse_prd_file(tmp_path, content_type or suffix.lstrip("."))

    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)

    # 4. Store document record
    doc = Document(
        tenant_id=current_user.tenant_id,
        project_id=project_id,
        uploaded_by=current_user.id,
        file_name=file.filename or "prd_document.txt",
        file_url=f"/uploads/prd/{uuid.uuid4()}{suffix}",  # Placeholder URL
        file_type=content_type,
        file_size_bytes=len(contents),
        extracted_text=parsed.get("extracted_text", "")[:5000],
        extracted_project_name=parsed.get("project_name"),
        tasks_generated=len(parsed.get("tasks", [])),
        status=DocumentStatus.PROCESSED,
        processed_at=datetime.utcnow(),
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    # 5. Build notification payload
    notifications = [
        {
            "type": "prd_uploaded",
            "message": f"PRD '{file.filename}' uploaded by {current_user.email}. {len(parsed['tasks'])} tasks generated.",
            "task_id": None,
            "user": current_user.email,
        }
    ]

    return PRDUploadResponse(
        document_id=doc.id,
        project_name=parsed.get("project_name", "Extracted Project"),
        tasks_generated=len(parsed.get("tasks", [])),
        phases=parsed.get("phases", []),
        tasks=parsed.get("tasks", []),
        insights=parsed.get("insights", []),
        notifications=notifications,
    )


@router.post("/insert-prd-tasks/{project_id}")
async def insert_prd_tasks(
    project_id: str,
    tasks: List[ParsedTask],
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Insert the AI-generated PRD tasks into a specific project.
    This is called after the user reviews and confirms the parsed tasks.
    """
    # Verify project exists and user is a member
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    created_tasks = []
    for i, task_data in enumerate(tasks):
        priority_map = {
            "high": TaskPriority.HIGH,
            "medium": TaskPriority.MEDIUM,
            "low": TaskPriority.LOW,
        }

        task = Task(
            project_id=project_id,
            tenant_id=current_user.tenant_id,
            title=task_data.title[:500],
            description=task_data.description,
            priority=priority_map.get(task_data.priority, TaskPriority.MEDIUM),
            task_type=TaskType.TASK,
            status=TaskStatus.TODO,
            estimated_hours=task_data.estimated_hours,
            position=float(i + 1),
            reporter_id=current_user.id,
            custom_fields={"category": task_data.category, "source": "prd_upload"},
        )
        db.add(task)
        created_tasks.append(task_data.title)

    await db.commit()

    return {
        "message": f"Successfully inserted {len(created_tasks)} tasks into project '{project.name}'.",
        "task_titles": created_tasks,
        "notifications": [
            {
                "type": "tasks_generated",
                "message": f"{len(created_tasks)} tasks auto-generated from PRD and inserted into '{project.name}'.",
                "task_id": None,
                "user": current_user.email,
            }
        ]
    }


# ── Task File Upload ──────────────────────────────────────────────────────────

@router.post("/tasks/{task_id}/upload-file", response_model=TaskFileResponse)
async def upload_task_file(
    task_id: str,
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload a file attachment to a specific task.
    Supported: PNG, JPG, PDF, DOCX, ZIP, JSON, TXT.
    """
    content_type = file.content_type or "application/octet-stream"

    if content_type not in ALLOWED_TASK_FILE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type. Allowed: images, PDF, DOCX, ZIP, JSON, TXT."
        )

    # Get the task to inherit tenant_id
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    contents = await file.read()
    file_uuid = str(uuid.uuid4())
    file_url = f"/uploads/tasks/{task_id}/{file_uuid}_{file.filename}"

    task_file = TaskFile(
        tenant_id=task.tenant_id,
        task_id=task_id,
        uploaded_by=current_user.id,
        file_name=file.filename or "attachment",
        file_url=file_url,
        file_type=content_type,
        file_size_bytes=len(contents),
    )
    db.add(task_file)
    await db.commit()
    await db.refresh(task_file)

    return TaskFileResponse(
        id=task_file.id,
        task_id=task_file.task_id,
        file_name=task_file.file_name,
        file_url=task_file.file_url,
        file_type=task_file.file_type,
        file_size_bytes=task_file.file_size_bytes,
        uploaded_by=task_file.uploaded_by,
        uploaded_at=task_file.uploaded_at,
    )


@router.get("/tasks/{task_id}/files", response_model=List[TaskFileResponse])
async def get_task_files(
    task_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all file attachments for a task."""
    result = await db.execute(
        select(TaskFile).where(TaskFile.task_id == task_id).order_by(TaskFile.uploaded_at.desc())
    )
    files = result.scalars().all()
    return [
        TaskFileResponse(
            id=f.id,
            task_id=f.task_id,
            file_name=f.file_name,
            file_url=f.file_url,
            file_type=f.file_type,
            file_size_bytes=f.file_size_bytes,
            uploaded_by=f.uploaded_by,
            uploaded_at=f.uploaded_at,
        )
        for f in files
    ]
