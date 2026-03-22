"""Scheduler helper — compute next run time for report schedules."""

from datetime import datetime, timedelta, timezone
from typing import Optional


def compute_next_run(
    frequency: str,
    hour: int = 8,
    tz_name: str = "UTC",
    day_of_week: Optional[int] = None,
    day_of_month: Optional[int] = None,
) -> datetime:
    """
    Compute the next UTC datetime for a scheduled report.

    Args:
        frequency: hourly | daily | weekly | monthly
        hour: local hour (0-23) for non-hourly frequencies
        tz_name: IANA timezone string, e.g. "Asia/Kolkata"
        day_of_week: 0=Mon … 6=Sun (for weekly)
        day_of_month: 1-31 (for monthly)
    Returns:
        Aware UTC datetime of the next scheduled execution
    """
    try:
        import pytz
        tz = pytz.timezone(tz_name)
    except Exception:
        import datetime as dt
        tz = dt.timezone.utc

    now_local = datetime.now(tz)
    if frequency == "hourly":
        next_run = (now_local + timedelta(hours=1)).replace(minute=0, second=0, microsecond=0)
    elif frequency == "daily":
        candidate = now_local.replace(hour=hour, minute=0, second=0, microsecond=0)
        if candidate <= now_local:
            candidate += timedelta(days=1)
        next_run = candidate
    elif frequency == "weekly":
        target_dow = day_of_week if day_of_week is not None else 0  # default Mon
        days_ahead = (target_dow - now_local.weekday()) % 7
        if days_ahead == 0 and now_local.hour >= hour:
            days_ahead = 7
        candidate = (now_local + timedelta(days=days_ahead)).replace(hour=hour, minute=0, second=0, microsecond=0)
        next_run = candidate
    elif frequency == "monthly":
        target_day = day_of_month if day_of_month else 1
        try:
            candidate = now_local.replace(day=target_day, hour=hour, minute=0, second=0, microsecond=0)
        except ValueError:
            # Day out of range for current month — use last valid day
            import calendar
            last_day = calendar.monthrange(now_local.year, now_local.month)[1]
            candidate = now_local.replace(day=last_day, hour=hour, minute=0, second=0, microsecond=0)
        if candidate <= now_local:
            # Move to next month
            if now_local.month == 12:
                candidate = candidate.replace(year=now_local.year + 1, month=1)
            else:
                candidate = candidate.replace(month=now_local.month + 1)
        next_run = candidate
    else:
        next_run = now_local + timedelta(days=1)

    # Convert to UTC
    if hasattr(next_run, "utctimetuple"):
        return next_run.astimezone(timezone.utc)
    return next_run
