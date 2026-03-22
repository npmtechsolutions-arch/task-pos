"""Analytics and reporting database models."""

import uuid
from datetime import datetime
from enum import Enum as PyEnum
from typing import Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class ReportFrequency(str, PyEnum):
    HOURLY = "hourly"
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"


class ExportFormat(str, PyEnum):
    CSV = "csv"
    EXCEL = "excel"
    JSON = "json"
    PDF = "pdf"


class RetentionTier(str, PyEnum):
    ONLINE = "online"   # 0-2 years — active PostgreSQL
    COLD = "cold"       # 2-7 years — cold storage


class SavedReport(Base):
    """Persisted custom report definition (query + visualisation config)."""

    __tablename__ = "saved_reports"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)

    # The safe query definition (entity, filters, group_by, aggregations)
    definition: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    # Ownership / sharing
    owner_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)   # visible to all org members
    shared_with: Mapped[Optional[list]] = mapped_column(JSONB, default=list)  # list of user IDs

    # Meta
    last_run_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    run_count: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    schedules: Mapped[list["ReportSchedule"]] = relationship("ReportSchedule", back_populates="report", cascade="all, delete-orphan")
    archives: Mapped[list["ReportArchive"]] = relationship("ReportArchive", back_populates="report", cascade="all, delete-orphan")


class ReportSchedule(Base):
    """Scheduled execution config for a SavedReport."""

    __tablename__ = "report_schedules"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    report_id: Mapped[str] = mapped_column(String(36), ForeignKey("saved_reports.id", ondelete="CASCADE"), nullable=False, index=True)

    frequency: Mapped[ReportFrequency] = mapped_column(nullable=False)
    timezone: Mapped[str] = mapped_column(String(60), default="UTC")
    hour: Mapped[int] = mapped_column(Integer, default=8)           # 0-23 local hour
    day_of_week: Mapped[Optional[int]] = mapped_column(Integer)     # 0=Mon…6=Sun (weekly)
    day_of_month: Mapped[Optional[int]] = mapped_column(Integer)    # 1-31 (monthly)

    recipient_emails: Mapped[list] = mapped_column(JSONB, default=list)
    export_format: Mapped[ExportFormat] = mapped_column(default=ExportFormat.CSV)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    next_run_at: Mapped[Optional[datetime]] = mapped_column(DateTime, index=True)
    last_run_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    last_run_status: Mapped[Optional[str]] = mapped_column(String(20))   # success / failed

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    report: Mapped["SavedReport"] = relationship("SavedReport", back_populates="schedules")


class ReportArchive(Base):
    """Historical snapshot of a report execution result."""

    __tablename__ = "report_archives"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    report_id: Mapped[str] = mapped_column(String(36), ForeignKey("saved_reports.id", ondelete="CASCADE"), nullable=False, index=True)

    # Snapshot payload (row data) — inline for ONLINE tier
    snapshot_data: Mapped[Optional[dict]] = mapped_column(JSONB)
    row_count: Mapped[int] = mapped_column(Integer, default=0)

    export_format: Mapped[ExportFormat] = mapped_column(default=ExportFormat.JSON)
    file_path: Mapped[Optional[str]] = mapped_column(String(500))  # path for larger exports
    retention_tier: Mapped[RetentionTier] = mapped_column(default=RetentionTier.ONLINE)

    triggered_by: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id"))  # null = scheduled
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)

    report: Mapped["SavedReport"] = relationship("SavedReport", back_populates="archives")


class DashboardConfig(Base):
    """Per-user dashboard widget layout and configuration."""

    __tablename__ = "dashboard_configs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)

    # Ordered list of widget configs [{type, title, config}]
    widgets: Mapped[list] = mapped_column(JSONB, default=list)
    layout: Mapped[Optional[dict]] = mapped_column(JSONB, default=dict)  # grid positions
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)  # admin-defined system default

    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
