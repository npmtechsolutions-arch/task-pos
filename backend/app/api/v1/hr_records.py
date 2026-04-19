"""HR Records API (Candidates, Interns, Leaves)."""

from typing import List, Optional
from datetime import datetime
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.core.logging import get_logger
from app.models.user import User, UserRole
from app.models.hr_records import Candidate, Intern, LeaveRequest, ApprovalStatus, InternStatus
from app.services.notification import NotificationService

logger = get_logger(__name__)
router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────

class CandidateCreate(BaseModel):
    name: str
    email: str
    role: str
    resume_url: Optional[str] = None

class CandidateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    email: str
    role: str
    resume_url: Optional[str] = None
    status: ApprovalStatus
    created_at: datetime

class InternCreate(BaseModel):
    name: str
    email: str
    college: Optional[str] = None
    duration_months: int = 3
    mentor_id: Optional[str] = None

class InternResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    email: str
    college: Optional[str] = None
    duration_months: int
    status: InternStatus
    created_at: datetime
    mentor_id: Optional[str] = None

class LeaveCreate(BaseModel):
    from_date: datetime
    to_date: datetime
    reason: str

class LeaveResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    user_id: str
    from_date: datetime
    to_date: datetime
    reason: str
    status: ApprovalStatus
    created_at: datetime


# ── Candidate API ────────────────────────────────────────────────────────────

@router.post("/candidates", response_model=CandidateResponse, status_code=status.HTTP_201_CREATED)
async def create_candidate(
    data: CandidateCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """HR Proposes a candidate to the Super Admin."""
    if current_user.role not in (UserRole.ADMIN, UserRole.OWNER, UserRole.HR):
        raise HTTPException(status_code=403, detail="Only HR/Admins can propose candidates")
        
    candidate = Candidate(
        id=str(uuid.uuid4()),
        name=data.name,
        email=data.email,
        role=data.role,
        resume_url=data.resume_url,
        created_by_id=current_user.id
    )
    db.add(candidate)
    await db.commit()
    await db.refresh(candidate)
    
    # Notify all admins & owners
    admins_res = await db.execute(select(User).where(User.role.in_([UserRole.ADMIN, UserRole.OWNER])))
    admins = admins_res.scalars().all()
    ns = NotificationService(db)
    
    from app.models.notification import NotificationType
    from app.schemas.notification import NotificationCreate
    for adm in admins:
        await ns.create(NotificationCreate(
            user_id=adm.id,
            notification_type=NotificationType.CANDIDATE_SUBMITTED,
            title="New Hiring Request",
            message=f"{current_user.first_name} proposed hiring {data.name} as {data.role}",
            action_url="/admin"
        ))

    return CandidateResponse.model_validate(candidate)


@router.get("/candidates", response_model=List[CandidateResponse])
async def list_candidates(
    status_filter: Optional[ApprovalStatus] = Query(None),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """View proposed candidates (HR/Admin only)."""
    if current_user.role not in (UserRole.ADMIN, UserRole.OWNER, UserRole.HR):
        raise HTTPException(status_code=403, detail="Access denied")
    
    q = select(Candidate).order_by(Candidate.created_at.desc())
    if status_filter:
        q = q.where(Candidate.status == status_filter)
        
    res = await db.execute(q)
    return [CandidateResponse.model_validate(c) for c in res.scalars().all()]


@router.post("/candidates/{id}/approve", response_model=CandidateResponse)
async def approve_candidate(
    id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Super Admin approves a candidate and triggers employee generation."""
    if current_user.role not in (UserRole.ADMIN, UserRole.OWNER):
        raise HTTPException(status_code=403, detail="Super Admin access required")
        
    candidate = await db.scalar(select(Candidate).where(Candidate.id == id))
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
        
    if candidate.status == ApprovalStatus.APPROVED:
        raise HTTPException(status_code=400, detail="Candidate already approved")

    candidate.status = ApprovalStatus.APPROVED
    candidate.approved_by_id = current_user.id
    
    import bcrypt
    from app.models.employee import EmployeeProfile
    
    # 1. Create User
    pw_hash = bcrypt.hashpw(b"Welcome123!", bcrypt.gensalt()).decode()
    new_user = User(
        id=str(uuid.uuid4()),
        email=candidate.email,
        first_name=candidate.name.split()[0],
        last_name=candidate.name.split()[-1] if " " in candidate.name else "",
        password_hash=pw_hash,
        role=candidate.role,
        is_active=True,
    )
    db.add(new_user)
    
    profile = EmployeeProfile(user_id=new_user.id)
    db.add(profile)
    
    await db.commit()
    await db.refresh(candidate)

    # 2. Notify HR who created it
    ns = NotificationService(db)
    from app.models.notification import NotificationType
    from app.schemas.notification import NotificationCreate
    await ns.create(NotificationCreate(
        user_id=candidate.created_by_id,
        notification_type=NotificationType.CANDIDATE_APPROVED,
        title="Candidate Approved!",
        message=f"Super Admin approved {candidate.name}",
        action_url="/hr"
    ))
    
    return CandidateResponse.model_validate(candidate)


@router.post("/candidates/{id}/reject", response_model=CandidateResponse)
async def reject_candidate(
    id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role not in (UserRole.ADMIN, UserRole.OWNER):
        raise HTTPException(status_code=403, detail="Super Admin access required")
        
    candidate = await db.scalar(select(Candidate).where(Candidate.id == id))
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
        
    candidate.status = ApprovalStatus.REJECTED
    await db.commit()
    await db.refresh(candidate)
    
    ns = NotificationService(db)
    from app.models.notification import NotificationType
    from app.schemas.notification import NotificationCreate
    await ns.create(NotificationCreate(
        user_id=candidate.created_by_id,
        notification_type=NotificationType.CANDIDATE_REJECTED,
        title="Candidate Rejected",
        message=f"{candidate.name}'s application was rejected.",
        action_url="/hr"
    ))
    
    return CandidateResponse.model_validate(candidate)

# ── Intern API ───────────────────────────────────────────────────────────────

@router.post("/interns", response_model=InternResponse, status_code=status.HTTP_201_CREATED)
async def add_intern(
    data: InternCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a new intern tracking record."""
    if current_user.role not in (UserRole.ADMIN, UserRole.OWNER, UserRole.HR):
        raise HTTPException(status_code=403, detail="Access denied")
        
    intern = Intern(
        id=str(uuid.uuid4()),
        name=data.name,
        email=data.email,
        college=data.college,
        duration_months=data.duration_months,
        mentor_id=data.mentor_id
    )
    db.add(intern)
    await db.commit()
    await db.refresh(intern)
    return InternResponse.model_validate(intern)


@router.get("/interns", response_model=List[InternResponse])
async def list_interns(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(Intern).order_by(Intern.created_at.desc()))
    return [InternResponse.model_validate(i) for i in res.scalars().all()]


# ── Leave API ────────────────────────────────────────────────────────────────

@router.post("/leaves", response_model=LeaveResponse, status_code=status.HTTP_201_CREATED)
async def apply_leave(
    data: LeaveCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Employee applies for leave."""
    leave = LeaveRequest(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        from_date=data.from_date,
        to_date=data.to_date,
        reason=data.reason
    )
    db.add(leave)
    await db.commit()
    await db.refresh(leave)
    
    # Notify HR and Managers
    hr_res = await db.execute(select(User).where(User.role.in_([UserRole.ADMIN, UserRole.HR])))
    hrs = hr_res.scalars().all()
    ns = NotificationService(db)
    
    from app.models.notification import NotificationType
    from app.schemas.notification import NotificationCreate
    for hr in hrs:
        await ns.create(NotificationCreate(
            user_id=hr.id,
            notification_type=NotificationType.LEAVE_REQUESTED,
            title="Leave Request",
            message=f"{current_user.first_name} requested leave",
            action_url="/hr"
        ))

    return LeaveResponse.model_validate(leave)


@router.get("/leaves", response_model=List[LeaveResponse])
async def list_leaves(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Employees see own leaves, HR/Admin see all."""
    q = select(LeaveRequest).order_by(LeaveRequest.created_at.desc())
    if current_user.role not in (UserRole.ADMIN, UserRole.OWNER, UserRole.HR):
        q = q.where(LeaveRequest.user_id == current_user.id)
        
    res = await db.execute(q)
    return [LeaveResponse.model_validate(l) for l in res.scalars().all()]


@router.post("/leaves/{id}/approve", response_model=LeaveResponse)
async def approve_leave(
    id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role not in (UserRole.ADMIN, UserRole.OWNER, UserRole.HR):
        raise HTTPException(status_code=403, detail="Access denied")
        
    leave = await db.scalar(select(LeaveRequest).where(LeaveRequest.id == id))
    if not leave:
        raise HTTPException(status_code=404, detail="Leave request not found")
        
    leave.status = ApprovalStatus.APPROVED
    leave.approved_by_id = current_user.id
    await db.commit()
    await db.refresh(leave)
    
    ns = NotificationService(db)
    from app.models.notification import NotificationType
    from app.schemas.notification import NotificationCreate
    await ns.create(NotificationCreate(
        user_id=leave.user_id,
        notification_type=NotificationType.LEAVE_APPROVED,
        title="Leave Approved",
        message="Your leave request was approved.",
        action_url="/hr"
    ))
    return LeaveResponse.model_validate(leave)


@router.post("/leaves/{id}/reject", response_model=LeaveResponse)
async def reject_leave(
    id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role not in (UserRole.ADMIN, UserRole.OWNER, UserRole.HR):
        raise HTTPException(status_code=403, detail="Access denied")
        
    leave = await db.scalar(select(LeaveRequest).where(LeaveRequest.id == id))
    if not leave:
        raise HTTPException(status_code=404, detail="Leave request not found")
        
    leave.status = ApprovalStatus.REJECTED
    leave.approved_by_id = current_user.id
    await db.commit()
    await db.refresh(leave)
    
    ns = NotificationService(db)
    from app.models.notification import NotificationType
    from app.schemas.notification import NotificationCreate
    await ns.create(NotificationCreate(
        user_id=leave.user_id,
        notification_type=NotificationType.LEAVE_REJECTED,
        title="Leave Rejected",
        message="Your leave request was rejected.",
        action_url="/hr"
    ))
    return LeaveResponse.model_validate(leave)
