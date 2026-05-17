"""HR Records API — Hire, Fire, Intern with full approval pipeline."""

from typing import List, Optional
from datetime import datetime
import uuid
import random
import string

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.core.logging import get_logger
from app.models.user import User, UserRole, UserStatus
from app.models.hr_records import (
    Candidate, Intern, LeaveRequest, TerminationRequest,
    ApprovalStatus, InternStatus,
)
from app.services.notification import NotificationService
from app.core.security import get_password_hash

logger = get_logger(__name__)
router = APIRouter()

# ── Helpers ──────────────────────────────────────────────────────────────────

def _gen_password(length: int = 12) -> str:
    chars = string.ascii_letters + string.digits + "!@#$"
    return "".join(random.choices(chars, k=length))

def _gen_company_email(name: str, tenant_domain: str = "company.com") -> str:
    clean = name.lower().split()[0] + (("." + name.lower().split()[-1]) if " " in name else "")
    clean = "".join(c for c in clean if c.isalnum() or c == ".")
    return f"{clean}@{tenant_domain}"

async def _notify_admins(db, tenant_id: str, title: str, message: str, url: str):
    admins = (await db.execute(
        select(User).where(
            User.tenant_id == tenant_id,
            User.role.in_([UserRole.ADMIN, UserRole.OWNER]),
            User.is_active == True,
        )
    )).scalars().all()
    ns = NotificationService(db)
    from app.models.notification import NotificationType
    from app.schemas.notification import NotificationCreate
    for adm in admins:
        try:
            await ns.create(NotificationCreate(
                user_id=adm.id,
                dedupe_key=f"hr:{title[:20]}:{adm.id}:{datetime.utcnow().date()}",
                notification_type=NotificationType.SYSTEM_ALERT,
                title=title, message=message, action_url=url,
            ))
        except Exception:
            pass


# ══════════════════════════════════════════════════════════════════════════════
# SCHEMAS
# ══════════════════════════════════════════════════════════════════════════════

class CandidateCreate(BaseModel):
    name: str
    email: str
    role: str = "member"
    job_title: Optional[str] = None
    join_date: Optional[datetime] = None
    resume_url: Optional[str] = None

class CandidateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    tenant_id: Optional[str] = None
    name: str
    email: str
    role: str
    job_title: Optional[str] = None
    join_date: Optional[datetime] = None
    resume_url: Optional[str] = None
    status: ApprovalStatus
    rejection_reason: Optional[str] = None
    generated_email: Optional[str] = None
    generated_password: Optional[str] = None
    created_at: datetime

class RejectRequest(BaseModel):
    reason: Optional[str] = None

class InternCreate(BaseModel):
    name: str
    email: str
    college: Optional[str] = None
    duration_months: int = 3
    stipend: Optional[str] = None
    mentor_id: Optional[str] = None

class InternResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    tenant_id: Optional[str] = None
    name: str
    email: str
    college: Optional[str] = None
    duration_months: int
    stipend: Optional[str] = None
    approval_status: ApprovalStatus
    status: InternStatus
    generated_email: Optional[str] = None
    generated_password: Optional[str] = None
    created_at: datetime
    mentor_id: Optional[str] = None

class TerminationCreate(BaseModel):
    target_user_id: str
    reason: Optional[str] = None
    last_working_day: Optional[datetime] = None

class TerminationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    tenant_id: Optional[str] = None
    target_user_id: str
    reason: Optional[str] = None
    last_working_day: Optional[datetime] = None
    status: ApprovalStatus
    rejection_reason: Optional[str] = None
    created_at: datetime

class LeaveCreate(BaseModel):
    from_date: datetime
    to_date: datetime
    reason: str

class LeaveResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    user_id: str
    tenant_id: Optional[str] = None
    from_date: datetime
    to_date: datetime
    reason: str
    status: ApprovalStatus
    created_at: datetime


# ══════════════════════════════════════════════════════════════════════════════
# HIRE FLOW — Candidates
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/candidates", response_model=CandidateResponse, status_code=201)
async def create_candidate(
    data: CandidateCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """HR proposes a hire. Sends notification to all admins."""
    if current_user.role not in (UserRole.ADMIN, UserRole.OWNER, UserRole.HR):
        raise HTTPException(403, "Only HR/Admins can propose candidates")

    candidate = Candidate(
        id=str(uuid.uuid4()),
        tenant_id=current_user.tenant_id,
        name=data.name, email=data.email, role=data.role,
        job_title=data.job_title, join_date=data.join_date,
        resume_url=data.resume_url,
        created_by_id=current_user.id,
    )
    db.add(candidate)
    await db.commit()
    await db.refresh(candidate)

    await _notify_admins(
        db, current_user.tenant_id,
        title="New Hiring Request",
        message=f"{current_user.first_name or current_user.email} proposed hiring "
                f"{data.name} as {data.job_title or data.role}",
        url=f"/hr/approval/hire/{candidate.id}",
    )
    return CandidateResponse.model_validate(candidate)


@router.get("/candidates", response_model=List[CandidateResponse])
async def list_candidates(
    status_filter: Optional[ApprovalStatus] = Query(None, alias="status"),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role not in (UserRole.ADMIN, UserRole.OWNER, UserRole.HR):
        raise HTTPException(403, "Access denied")
    q = (select(Candidate)
         .where(Candidate.tenant_id == current_user.tenant_id)
         .order_by(Candidate.created_at.desc()))
    if status_filter:
        q = q.where(Candidate.status == status_filter)
    res = await db.execute(q)
    return [CandidateResponse.model_validate(c) for c in res.scalars().all()]


@router.get("/candidates/{id}", response_model=CandidateResponse)
async def get_candidate(
    id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get single candidate by ID."""
    if current_user.role not in (UserRole.ADMIN, UserRole.OWNER, UserRole.HR):
        raise HTTPException(403, "Access denied")
    c = await db.scalar(select(Candidate).where(
        Candidate.id == id, Candidate.tenant_id == current_user.tenant_id
    ))
    if not c:
        raise HTTPException(404, "Candidate not found")
    return CandidateResponse.model_validate(c)



@router.post("/candidates/{id}/approve", response_model=CandidateResponse)
async def approve_candidate(

    id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Super Admin approves → creates system user + sends credentials."""
    if current_user.role not in (UserRole.ADMIN, UserRole.OWNER):
        raise HTTPException(403, "Admin approval required")

    candidate = await db.scalar(
        select(Candidate).where(
            Candidate.id == id,
            Candidate.tenant_id == current_user.tenant_id,
        )
    )
    if not candidate:
        raise HTTPException(404, "Candidate not found")
    if candidate.status == ApprovalStatus.APPROVED:
        raise HTTPException(400, "Already approved")

    # Check duplicate email
    if await db.scalar(select(User).where(User.email == candidate.email)):
        raise HTTPException(400, "A user with this email already exists")

    # Generate company email + temporary password
    company_email = _gen_company_email(candidate.name)
    temp_password = _gen_password()

    try:
        role_enum = UserRole(candidate.role)
    except ValueError:
        role_enum = UserRole.MEMBER

    new_user = User(
        id=str(uuid.uuid4()),
        tenant_id=candidate.tenant_id or current_user.tenant_id,
        email=company_email,
        first_name=candidate.name.split()[0],
        last_name=candidate.name.split()[-1] if " " in candidate.name else "",
        password_hash=get_password_hash(temp_password),
        role=role_enum,
        is_active=True,
        status=UserStatus.ACTIVE,
    )
    db.add(new_user)

    # Employee profile
    try:
        from app.models.employee import EmployeeProfile
        db.add(EmployeeProfile(user_id=new_user.id))
    except Exception:
        pass

    candidate.status = ApprovalStatus.APPROVED
    candidate.approved_by_id = current_user.id
    candidate.generated_email = company_email
    candidate.generated_password = temp_password  # shown once in UI

    await db.commit()
    await db.refresh(candidate)

    # Notify the HR who created the request
    ns = NotificationService(db)
    from app.models.notification import NotificationType
    from app.schemas.notification import NotificationCreate
    try:
        await ns.create(NotificationCreate(
            user_id=candidate.created_by_id,
            notification_type=NotificationType.CANDIDATE_APPROVED,
            title="Hire Approved!",
            message=f"{candidate.name} is now a system user. Email: {company_email}",
            action_url="/hr",
        ))
    except Exception:
        pass

    return CandidateResponse.model_validate(candidate)


@router.post("/candidates/{id}/reject", response_model=CandidateResponse)
async def reject_candidate(
    id: str,
    body: RejectRequest = RejectRequest(),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role not in (UserRole.ADMIN, UserRole.OWNER):
        raise HTTPException(403, "Admin approval required")

    candidate = await db.scalar(
        select(Candidate).where(
            Candidate.id == id, Candidate.tenant_id == current_user.tenant_id
        )
    )
    if not candidate:
        raise HTTPException(404, "Candidate not found")

    candidate.status = ApprovalStatus.REJECTED
    candidate.approved_by_id = current_user.id
    candidate.rejection_reason = body.reason
    await db.commit()
    await db.refresh(candidate)

    ns = NotificationService(db)
    from app.models.notification import NotificationType
    from app.schemas.notification import NotificationCreate
    try:
        await ns.create(NotificationCreate(
            user_id=candidate.created_by_id,
            notification_type=NotificationType.CANDIDATE_REJECTED,
            title="Hire Request Rejected",
            message=f"{candidate.name}'s application was rejected."
                    + (f" Reason: {body.reason}" if body.reason else ""),
            action_url="/hr",
        ))
    except Exception:
        pass
    return CandidateResponse.model_validate(candidate)


# ══════════════════════════════════════════════════════════════════════════════
# FIRE FLOW — Termination Requests
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/terminations", response_model=TerminationResponse, status_code=201)
async def request_termination(
    data: TerminationCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """HR submits a termination request for Super Admin approval."""
    if current_user.role not in (UserRole.ADMIN, UserRole.OWNER, UserRole.HR):
        raise HTTPException(403, "HR/Admin access required")

    # Validate target user exists in same tenant
    target = await db.scalar(
        select(User).where(
            User.id == data.target_user_id,
            User.tenant_id == current_user.tenant_id,
        )
    )
    if not target:
        raise HTTPException(404, "Employee not found in your organisation")
    if not target.is_active:
        raise HTTPException(400, "Employee is already inactive")

    req = TerminationRequest(
        id=str(uuid.uuid4()),
        tenant_id=current_user.tenant_id,
        target_user_id=data.target_user_id,
        reason=data.reason,
        last_working_day=data.last_working_day,
        created_by_id=current_user.id,
    )
    db.add(req)
    await db.commit()
    await db.refresh(req)

    await _notify_admins(
        db, current_user.tenant_id,
        title="Termination Request",
        message=f"{current_user.first_name or current_user.email} requested termination "
                f"of {target.first_name or target.email}."
                + (f" Reason: {data.reason}" if data.reason else ""),
        url=f"/hr/approval/fire/{req.id}",
    )
    return TerminationResponse.model_validate(req)


@router.get("/terminations", response_model=List[TerminationResponse])
async def list_terminations(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role not in (UserRole.ADMIN, UserRole.OWNER, UserRole.HR):
        raise HTTPException(403, "Access denied")
    res = await db.execute(
        select(TerminationRequest)
        .where(TerminationRequest.tenant_id == current_user.tenant_id)
        .order_by(TerminationRequest.created_at.desc())
    )
    return [TerminationResponse.model_validate(r) for r in res.scalars().all()]


@router.get("/terminations/{id}", response_model=TerminationResponse)
async def get_termination(
    id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role not in (UserRole.ADMIN, UserRole.OWNER, UserRole.HR):
        raise HTTPException(403, "Access denied")
    req = await db.scalar(select(TerminationRequest).where(
        TerminationRequest.id == id, TerminationRequest.tenant_id == current_user.tenant_id
    ))
    if not req:
        raise HTTPException(404, "Termination request not found")
    return TerminationResponse.model_validate(req)


@router.post("/terminations/{id}/approve", response_model=TerminationResponse)
async def approve_termination(
    id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Super Admin approves → disables user login + removes from active projects."""
    if current_user.role not in (UserRole.ADMIN, UserRole.OWNER):
        raise HTTPException(403, "Admin approval required")

    req = await db.scalar(
        select(TerminationRequest).where(
            TerminationRequest.id == id,
            TerminationRequest.tenant_id == current_user.tenant_id,
        )
    )
    if not req:
        raise HTTPException(404, "Termination request not found")
    if req.status == ApprovalStatus.APPROVED:
        raise HTTPException(400, "Already approved")

    # Disable the user
    target = await db.scalar(select(User).where(User.id == req.target_user_id))
    if target:
        target.is_active = False
        target.status = UserStatus.INACTIVE

    # Remove from active project memberships
    try:
        from app.models.project import ProjectMember
        await db.execute(
            select(ProjectMember).where(ProjectMember.user_id == req.target_user_id)
        )
        members = (await db.execute(
            select(ProjectMember).where(ProjectMember.user_id == req.target_user_id)
        )).scalars().all()
        for m in members:
            await db.delete(m)
    except Exception:
        pass

    req.status = ApprovalStatus.APPROVED
    req.approved_by_id = current_user.id
    await db.commit()
    await db.refresh(req)

    # Notify HR who created the request
    ns = NotificationService(db)
    from app.models.notification import NotificationType
    from app.schemas.notification import NotificationCreate
    try:
        await ns.create(NotificationCreate(
            user_id=req.created_by_id,
            notification_type=NotificationType.SYSTEM_ALERT,
            title="Termination Approved",
            message=f"The termination of {target.full_name if target else 'the employee'} "
                    "has been approved. Their account is now disabled.",
            action_url="/hr",
        ))
    except Exception:
        pass
    return TerminationResponse.model_validate(req)


@router.post("/terminations/{id}/reject", response_model=TerminationResponse)
async def reject_termination(
    id: str,
    body: RejectRequest = RejectRequest(),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role not in (UserRole.ADMIN, UserRole.OWNER):
        raise HTTPException(403, "Admin approval required")

    req = await db.scalar(
        select(TerminationRequest).where(
            TerminationRequest.id == id,
            TerminationRequest.tenant_id == current_user.tenant_id,
        )
    )
    if not req:
        raise HTTPException(404, "Not found")

    req.status = ApprovalStatus.REJECTED
    req.approved_by_id = current_user.id
    req.rejection_reason = body.reason
    await db.commit()
    await db.refresh(req)
    return TerminationResponse.model_validate(req)


# ══════════════════════════════════════════════════════════════════════════════
# INTERN FLOW
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/interns", response_model=InternResponse, status_code=201)
async def add_intern(
    data: InternCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role not in (UserRole.ADMIN, UserRole.OWNER, UserRole.HR):
        raise HTTPException(403, "Access denied")

    intern = Intern(
        id=str(uuid.uuid4()),
        tenant_id=current_user.tenant_id,
        name=data.name, email=data.email,
        college=data.college, duration_months=data.duration_months,
        stipend=data.stipend, mentor_id=data.mentor_id,
        created_by_id=current_user.id,
    )
    db.add(intern)
    await db.commit()
    await db.refresh(intern)

    await _notify_admins(
        db, current_user.tenant_id,
        title="New Intern Request",
        message=f"{current_user.first_name or current_user.email} added intern "
                f"{data.name} from {data.college or 'N/A'}",
        url=f"/hr/approval/intern/{intern.id}",
    )
    return InternResponse.model_validate(intern)


@router.get("/interns", response_model=List[InternResponse])
async def list_interns(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(Intern)
        .where(Intern.tenant_id == current_user.tenant_id)
        .order_by(Intern.created_at.desc())
    )
    return [InternResponse.model_validate(i) for i in res.scalars().all()]


@router.get("/interns/{id}", response_model=InternResponse)
async def get_intern(
    id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    intern = await db.scalar(select(Intern).where(
        Intern.id == id, Intern.tenant_id == current_user.tenant_id
    ))
    if not intern:
        raise HTTPException(404, "Intern not found")
    return InternResponse.model_validate(intern)


@router.post("/interns/{id}/approve", response_model=InternResponse)
async def approve_intern(
    id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Approve intern → create limited-access user account."""
    if current_user.role not in (UserRole.ADMIN, UserRole.OWNER):
        raise HTTPException(403, "Admin approval required")

    intern = await db.scalar(
        select(Intern).where(
            Intern.id == id, Intern.tenant_id == current_user.tenant_id
        )
    )
    if not intern:
        raise HTTPException(404, "Intern not found")
    if intern.approval_status == ApprovalStatus.APPROVED:
        raise HTTPException(400, "Already approved")

    company_email = _gen_company_email(intern.name, "intern.company.com")
    temp_password = _gen_password(10)

    if not await db.scalar(select(User).where(User.email == company_email)):
        new_user = User(
            id=str(uuid.uuid4()),
            tenant_id=intern.tenant_id or current_user.tenant_id,
            email=company_email,
            first_name=intern.name.split()[0],
            last_name=intern.name.split()[-1] if " " in intern.name else "",
            password_hash=get_password_hash(temp_password),
            role=UserRole.VIEWER,   # limited access
            is_active=True,
            status=UserStatus.ACTIVE,
        )
        db.add(new_user)

    intern.approval_status = ApprovalStatus.APPROVED
    intern.approved_by_id = current_user.id
    intern.generated_email = company_email
    intern.generated_password = temp_password
    await db.commit()
    await db.refresh(intern)

    if intern.created_by_id:
        ns = NotificationService(db)
        from app.models.notification import NotificationType
        from app.schemas.notification import NotificationCreate
        try:
            await ns.create(NotificationCreate(
                user_id=intern.created_by_id,
                notification_type=NotificationType.SYSTEM_ALERT,
                title="Intern Approved",
                message=f"{intern.name} has been approved. Login: {company_email}",
                action_url="/hr",
            ))
        except Exception:
            pass
    return InternResponse.model_validate(intern)


@router.post("/interns/{id}/reject", response_model=InternResponse)
async def reject_intern(
    id: str,
    body: RejectRequest = RejectRequest(),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role not in (UserRole.ADMIN, UserRole.OWNER):
        raise HTTPException(403, "Admin approval required")

    intern = await db.scalar(
        select(Intern).where(
            Intern.id == id, Intern.tenant_id == current_user.tenant_id
        )
    )
    if not intern:
        raise HTTPException(404, "Not found")

    intern.approval_status = ApprovalStatus.REJECTED
    intern.approved_by_id = current_user.id
    intern.rejection_reason = body.reason
    await db.commit()
    await db.refresh(intern)
    return InternResponse.model_validate(intern)


# ══════════════════════════════════════════════════════════════════════════════
# LEAVE FLOW
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/leaves", response_model=LeaveResponse, status_code=201)
async def apply_leave(
    data: LeaveCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    leave = LeaveRequest(
        id=str(uuid.uuid4()),
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        from_date=data.from_date,
        to_date=data.to_date,
        reason=data.reason,
    )
    db.add(leave)
    await db.commit()
    await db.refresh(leave)
    await _notify_admins(
        db, current_user.tenant_id,
        title="Leave Request",
        message=f"{current_user.first_name or current_user.email} requested leave",
        url="/hr",
    )
    return LeaveResponse.model_validate(leave)


@router.get("/leaves", response_model=List[LeaveResponse])
async def list_leaves(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = (select(LeaveRequest)
         .where(LeaveRequest.tenant_id == current_user.tenant_id)
         .order_by(LeaveRequest.created_at.desc()))
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
        raise HTTPException(403, "Access denied")
    leave = await db.scalar(
        select(LeaveRequest).where(
            LeaveRequest.id == id, LeaveRequest.tenant_id == current_user.tenant_id
        )
    )
    if not leave:
        raise HTTPException(404, "Not found")
    leave.status = ApprovalStatus.APPROVED
    leave.approved_by_id = current_user.id
    await db.commit()
    await db.refresh(leave)
    ns = NotificationService(db)
    from app.models.notification import NotificationType
    from app.schemas.notification import NotificationCreate
    try:
        await ns.create(NotificationCreate(
            user_id=leave.user_id,
            notification_type=NotificationType.LEAVE_APPROVED,
            title="Leave Approved",
            message="Your leave request was approved.",
            action_url="/hr",
        ))
    except Exception:
        pass
    return LeaveResponse.model_validate(leave)


@router.post("/leaves/{id}/reject", response_model=LeaveResponse)
async def reject_leave(
    id: str,
    body: RejectRequest = RejectRequest(),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role not in (UserRole.ADMIN, UserRole.OWNER, UserRole.HR):
        raise HTTPException(403, "Access denied")
    leave = await db.scalar(
        select(LeaveRequest).where(
            LeaveRequest.id == id, LeaveRequest.tenant_id == current_user.tenant_id
        )
    )
    if not leave:
        raise HTTPException(404, "Not found")
    leave.status = ApprovalStatus.REJECTED
    leave.approved_by_id = current_user.id
    await db.commit()
    await db.refresh(leave)
    ns = NotificationService(db)
    from app.models.notification import NotificationType
    from app.schemas.notification import NotificationCreate
    try:
        await ns.create(NotificationCreate(
            user_id=leave.user_id,
            notification_type=NotificationType.LEAVE_REJECTED,
            title="Leave Rejected",
            message="Your leave request was rejected.",
            action_url="/hr",
        ))
    except Exception:
        pass
    return LeaveResponse.model_validate(leave)
