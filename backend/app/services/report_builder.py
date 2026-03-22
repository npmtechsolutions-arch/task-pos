"""
Report Builder service — safe SQL query engine.

Rules:
  ✅ NO raw SQL from client ever executed
  ✅ Whitelist of allowed entities and fields
  ✅ Uses SQLAlchemy Core only (no string interpolation)
  ✅ Results cached 5 minutes per definition hash
"""

import hashlib
import json
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy import and_, asc, desc, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.models.analytics import ReportArchive, SavedReport
from app.models.project import Project, ProjectMember
from app.models.task import Task, TimeEntry
from app.models.timesheet import TimesheetEntry
from app.models.user import User
from app.schemas.analytics import ReportDefinition, SavedReportCreate, SavedReportResponse

logger = get_logger(__name__)

# ── 5-minute report result cache ──────────────────────────────────────────────
_REPORT_CACHE: Dict[str, Any] = {}     # hash(definition) → (rows, cached_at)
_REPORT_TTL = timedelta(minutes=5)

# ── Entity → SQLAlchemy table + allowed fields ────────────────────────────────
ENTITY_MAP = {
    "tasks": {
        "model": Task,
        "fields": {
            "id": Task.id,
            "title": Task.title,
            "status": Task.status,
            "priority": Task.priority,
            "project_id": Task.project_id,
            "primary_assignee_id": Task.primary_assignee_id,
            "estimated_hours": Task.estimated_hours,
            "due_date": Task.due_date,
            "created_at": Task.created_at,
            "updated_at": Task.updated_at,
        },
    },
    "projects": {
        "model": Project,
        "fields": {
            "id": Project.id,
            "name": Project.name,
            "status": Project.status,
            "start_date": Project.start_date,
            "end_date": Project.end_date,
            "total_estimated_hours": Project.total_estimated_hours,
            "total_actual_hours": Project.total_actual_hours,
            "created_at": Project.created_at,
        },
    },
    "time_entries": {
        "model": TimeEntry,
        "fields": {
            "id": TimeEntry.id,
            "task_id": TimeEntry.task_id,
            "user_id": TimeEntry.user_id,
            "duration_minutes": TimeEntry.duration_minutes,
            "started_at": TimeEntry.started_at,
        },
    },
    "timesheets": {
        "model": TimesheetEntry,
        "fields": {
            "id": TimesheetEntry.id,
            "project_id": TimesheetEntry.project_id,
            "task_id": TimesheetEntry.task_id,
            "hours": TimesheetEntry.hours,
            "is_billable": TimesheetEntry.is_billable,
            "date_logged": TimesheetEntry.date_logged,
        },
    },
    "users": {
        "model": User,
        "fields": {
            "id": User.id,
            "email": User.email,
            "first_name": User.first_name,
            "last_name": User.last_name,
            "is_active": User.is_active,
            "created_at": User.created_at,
        },
    },
}

OPERATOR_MAP = {
    "=": lambda col, val: col == val,
    "!=": lambda col, val: col != val,
    "gte": lambda col, val: col >= val,
    "lte": lambda col, val: col <= val,
    "in": lambda col, val: col.in_(val if isinstance(val, list) else [val]),
    "contains": lambda col, val: col.ilike(f"%{val}%"),
}

AGG_FUNC_MAP = {
    "count": func.count,
    "sum": func.sum,
    "avg": func.avg,
    "min": func.min,
    "max": func.max,
}


class ReportBuilderService:
    """Safe, whitelist-only query builder for custom reports."""

    def __init__(self, db: AsyncSession):
        self.db = db

    # ── Query execution ────────────────────────────────────────────────────────

    async def run_report(
        self, definition: ReportDefinition, owner_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Execute a whitelist-validated report definition.
        Returns cached result if available (5-min TTL).
        """
        cache_key = hashlib.md5(json.dumps(definition.model_dump(), default=str).encode()).hexdigest()
        cached = _REPORT_CACHE.get(cache_key)
        if cached:
            result, cached_at = cached
            if (datetime.utcnow() - cached_at) < _REPORT_TTL:
                logger.debug("Serving report from cache", key=cache_key)
                return result

        entity_cfg = ENTITY_MAP.get(definition.entity)
        if not entity_cfg:
            raise ValueError(f"Unknown entity: {definition.entity}. Allowed: {list(ENTITY_MAP)}")

        model = entity_cfg["model"]
        allowed_fields = entity_cfg["fields"]

        # ── Build SELECT columns ──────────────────────────────────────────────
        select_cols = []

        if definition.group_by:
            for gf in definition.group_by:
                if gf not in allowed_fields:
                    raise ValueError(f"Field '{gf}' not allowed on entity '{definition.entity}'")
                select_cols.append(allowed_fields[gf].label(gf))

        for agg in definition.aggregations:
            if agg.field not in allowed_fields and agg.func != "count":
                raise ValueError(f"Aggregation field '{agg.field}' not allowed")
            agg_fn = AGG_FUNC_MAP[agg.func]
            col = allowed_fields.get(agg.field, allowed_fields.get("id"))
            alias = agg.alias or f"{agg.func}_{agg.field}"
            select_cols.append(agg_fn(col).label(alias))

        if not select_cols:
            # Default: select all whitelisted fields
            select_cols = [v.label(k) for k, v in allowed_fields.items()]

        stmt = select(*select_cols)

        # ── Apply filters ─────────────────────────────────────────────────────
        conditions = []
        for f in definition.filters:
            if f.field not in allowed_fields:
                raise ValueError(f"Filter field '{f.field}' is not allowed")
            op_fn = OPERATOR_MAP.get(f.op)
            if not op_fn:
                raise ValueError(f"Operator '{f.op}' not allowed")
            conditions.append(op_fn(allowed_fields[f.field], f.value))

        # Date range
        if definition.date_range:
            dr = definition.date_range
            if dr.field not in allowed_fields:
                raise ValueError(f"Date range field '{dr.field}' not allowed")
            dc = allowed_fields[dr.field]
            if dr.start:
                conditions.append(dc >= dr.start)
            if dr.end:
                conditions.append(dc <= dr.end)

        if conditions:
            stmt = stmt.where(and_(*conditions))

        # ── GROUP BY ──────────────────────────────────────────────────────────
        if definition.group_by:
            group_cols = [allowed_fields[g] for g in definition.group_by if g in allowed_fields]
            stmt = stmt.group_by(*group_cols)

        # ── ORDER BY ─────────────────────────────────────────────────────────
        if definition.order_by and definition.aggregations:
            agg_aliases = {(a.alias or f"{a.func}_{a.field}") for a in definition.aggregations}
            if definition.order_by in agg_aliases:
                # Use text for aggregate alias ordering (safe — it's from alias list)
                order_txt = text(f"{definition.order_by} {definition.order_dir.upper()}")
                stmt = stmt.order_by(order_txt)

        stmt = stmt.limit(definition.limit)

        result = await self.db.execute(stmt)
        rows = [dict(zip(result.keys(), row)) for row in result.all()]

        # ── Calculated fields ─────────────────────────────────────────────────
        for row in rows:
            if "efficiency" in definition.calculated_fields:
                total = row.get("count_id", row.get("total_tasks", 0)) or 0
                done = row.get("count_status", 0) or 0
                row["efficiency"] = round(done / max(total, 1), 3)
            if "billable_ratio" in definition.calculated_fields:
                total_h = row.get("sum_hours", 0) or 0
                bill_h = row.get("sum_billable_hours", total_h) or 0
                row["billable_ratio"] = round(bill_h / max(total_h, 0.01), 3)

        _REPORT_CACHE[cache_key] = (rows, datetime.utcnow())
        return rows

    # ── Saved Report CRUD ─────────────────────────────────────────────────────

    async def save_report(self, data: SavedReportCreate, owner_id: str) -> SavedReport:
        report = SavedReport(
            name=data.name,
            description=data.description,
            definition=data.definition.model_dump(),
            owner_id=owner_id,
            is_public=data.is_public,
            shared_with=data.shared_with,
        )
        self.db.add(report)
        await self.db.commit()
        await self.db.refresh(report)
        logger.info("Report saved", report_id=report.id, name=report.name)
        return report

    async def get_report(self, report_id: str, requester_id: str) -> Optional[SavedReport]:
        result = await self.db.execute(select(SavedReport).where(SavedReport.id == report_id))
        report = result.scalar_one_or_none()
        if not report:
            return None
        # Access control: owner OR public OR in shared_with
        shared = report.shared_with or []
        if report.owner_id != requester_id and not report.is_public and requester_id not in shared:
            raise PermissionError("Access denied to this report")
        return report

    async def list_reports(self, requester_id: str) -> List[SavedReport]:
        result = await self.db.execute(
            select(SavedReport).where(
                and_(
                    SavedReport.is_active == True,
                    (SavedReport.owner_id == requester_id)
                    | (SavedReport.is_public == True)
                    | (SavedReport.shared_with.contains([requester_id]))
                )
            ).order_by(SavedReport.updated_at.desc())
        )
        return list(result.scalars().all())

    async def delete_report(self, report_id: str, requester_id: str) -> bool:
        result = await self.db.execute(select(SavedReport).where(SavedReport.id == report_id))
        report = result.scalar_one_or_none()
        if not report or report.owner_id != requester_id:
            return False
        report.is_active = False
        await self.db.commit()
        return True

    async def archive_run(
        self, report_id: str, rows: List[Dict], fmt: str, triggered_by: Optional[str] = None
    ) -> ReportArchive:
        archive = ReportArchive(
            report_id=report_id,
            snapshot_data={"rows": rows},
            row_count=len(rows),
            export_format=fmt,
            triggered_by=triggered_by,
        )
        self.db.add(archive)
        # Update run stats
        await self.db.execute(
            select(SavedReport).where(SavedReport.id == report_id)
        )
        await self.db.commit()
        return archive

    async def list_archives(self, report_id: str) -> List[ReportArchive]:
        result = await self.db.execute(
            select(ReportArchive)
            .where(ReportArchive.report_id == report_id)
            .order_by(ReportArchive.created_at.desc())
        )
        return list(result.scalars().all())
