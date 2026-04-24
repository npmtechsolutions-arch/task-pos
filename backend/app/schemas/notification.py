"""Notification schemas for request/response validation."""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, AliasChoices

from app.models.notification import NotificationChannel, NotificationType


class NotificationBase(BaseModel):
    """Base notification schema."""

    title: str
    message: str
    notification_type: NotificationType


class NotificationCreate(NotificationBase):
    """Notification creation schema."""

    user_id: str
    tenant_id: Optional[str] = None
    dedupe_key: Optional[str] = None
    project_id: Optional[str] = None
    task_id: Optional[str] = None
    comment_id: Optional[str] = None
    extra_data: dict = Field(default_factory=dict, validation_alias=AliasChoices('extra_data', 'metadata'))
    channels: List[NotificationChannel] = [NotificationChannel.IN_APP]
    action_url: Optional[str] = None


class NotificationResponse(NotificationBase):
    """Notification response schema."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    tenant_id: Optional[str] = None
    dedupe_key: Optional[str] = None
    project_id: Optional[str] = None
    task_id: Optional[str] = None
    comment_id: Optional[str] = None
    metadata: dict = Field(default_factory=dict, validation_alias=AliasChoices('extra_data', 'metadata'))
    channels: List[str]
    is_read: bool
    read_at: Optional[datetime] = None
    action_url: Optional[str] = None
    created_at: datetime


class NotificationListResponse(BaseModel):
    """Notification list response schema."""

    items: List[NotificationResponse]
    total: int
    unread_count: int
    page: int
    per_page: int


class NotificationUpdateRequest(BaseModel):
    """Notification update request schema."""

    is_read: bool


class NotificationPreferenceBase(BaseModel):
    """Base notification preference schema."""

    email_enabled: bool = True
    push_enabled: bool = True
    in_app_enabled: bool = True


class NotificationPreferenceUpdate(BaseModel):
    """Notification preference update schema."""

    email_enabled: Optional[bool] = None
    push_enabled: Optional[bool] = None
    in_app_enabled: Optional[bool] = None
    type_preferences: Optional[dict] = None
    quiet_hours_enabled: Optional[bool] = None
    quiet_hours_start: Optional[str] = None
    quiet_hours_end: Optional[str] = None
    quiet_hours_timezone: Optional[str] = None


class NotificationPreferenceResponse(NotificationPreferenceBase):
    """Notification preference response schema."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    type_preferences: dict
    quiet_hours_enabled: bool
    quiet_hours_start: Optional[str] = None
    quiet_hours_end: Optional[str] = None
    quiet_hours_timezone: str
    created_at: datetime
    updated_at: datetime


class MarkReadRequest(BaseModel):
    """Mark notifications as read request."""

    notification_ids: Optional[List[str]] = None  # If None, mark all as read
