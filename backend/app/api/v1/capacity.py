"""Capacity Management API."""

from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.deps import get_current_user, get_db
from app.services.capacity import CapacityService

router = APIRouter()

@router.get("/check")
async def check_user_capacity(
    user_id: str,
    new_estimated_hours: float = Query(..., gt=0),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Check if assigning X hours to a user will cause overallocation.
    """
    capacity_service = CapacityService(db)
    now = datetime.utcnow()
    
    result = await capacity_service.check_allocation_threshold(user_id, new_estimated_hours, now)
    return result

@router.get("/user/{user_id}")
async def get_user_workload(
    user_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get generic capacity workload information for a user over the next 7 days.
    """
    capacity_service = CapacityService(db)
    now = datetime.utcnow()
    from datetime import timedelta
    end = now + timedelta(days=7)
    
    result = await capacity_service.get_user_capacity(user_id, now, end)
    return result
