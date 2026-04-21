"""Local file storage for project PRD uploads (S3 can be added behind the same interface)."""

import os
import re
import uuid
from pathlib import Path

from fastapi import UploadFile

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

# Allowed PRD MIME types / extensions
ALLOWED_PRD = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    "text/plain",
}


def _safe_filename(name: str) -> str:
    base = os.path.basename(name or "document")
    base = re.sub(r"[^a-zA-Z0-9._-]", "_", base)[:180]
    return base or "document"


async def save_project_prd_upload(project_id: str, upload: UploadFile) -> tuple[str, str, str, int]:
    """
    Persist upload under local storage. Returns (storage_key, original_filename, content_type, size_bytes).
    storage_key is relative to upload root (e.g. prd/<project_id>/...).
    """
    content_type = (upload.content_type or "").split(";")[0].strip().lower()
    if content_type and content_type not in ALLOWED_PRD:
        # Allow by extension if browser sends wrong MIME
        fn = (upload.filename or "").lower()
        if not fn.endswith((".pdf", ".docx", ".doc", ".txt")):
            raise ValueError("Unsupported PRD file type. Use PDF, DOCX, DOC, or TXT.")

    raw = await upload.read()
    size = len(raw)
    if size > 25 * 1024 * 1024:
        raise ValueError("PRD file too large (max 25MB).")

    upload_root = Path(os.getenv("LOCAL_UPLOAD_DIR", "uploads")).resolve()
    subdir = upload_root / "prd" / project_id
    subdir.mkdir(parents=True, exist_ok=True)

    suffix = Path(_safe_filename(upload.filename or "prd")).suffix or ".bin"
    file_id = str(uuid.uuid4())
    dest_name = f"{file_id}{suffix}"
    dest_path = subdir / dest_name
    dest_path.write_bytes(raw)

    storage_key = f"prd/{project_id}/{dest_name}"
    logger.info("Saved PRD upload", project_id=project_id, key=storage_key, bytes=size)
    return storage_key, upload.filename or dest_name, content_type or "application/octet-stream", size


def resolve_local_path(storage_key: str) -> Path:
    """Map storage key to absolute filesystem path."""
    upload_root = Path(os.getenv("LOCAL_UPLOAD_DIR", "uploads")).resolve()
    # Disallow path traversal
    key = storage_key.lstrip("/").replace("..", "")
    path = (upload_root / key).resolve()
    if not str(path).startswith(str(upload_root)):
        raise ValueError("Invalid storage key")
    return path
