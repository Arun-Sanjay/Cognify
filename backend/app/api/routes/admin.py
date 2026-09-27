"""Admin-only endpoints — platform stats, user management, notification delivery."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select

from app.api.deps import CurrentUser, DbSession, require_role
from app.models.chat import ChatSession
from app.models.content import Document, DocumentStatus
from app.models.notification import NotificationDelivery
from app.models.user import StudentProfile, TeacherProfile, User, UserRole
from app.schemas.admin import (
    AdminStatsResponse,
    AdminUserListResponse,
    AdminUserRow,
    AdminUserUpdate,
)
from app.schemas.notification_admin import (
    NotificationDeliveryRow,
    NotificationStatsResponse,
    NotificationStatusResponse,
)
from app.services import notifications as notifications_service

# Every route here is admin-only.
router = APIRouter(dependencies=[Depends(require_role("admin"))])


def _count(db, stmt) -> int:
    return int(db.scalar(stmt) or 0)


@router.get("/stats", response_model=AdminStatsResponse, summary="Platform-wide counters")
def stats(db: DbSession) -> AdminStatsResponse:
    by_role = dict(db.execute(select(User.role, func.count(User.id)).group_by(User.role)).all())
    return AdminStatsResponse(
        total_users=sum(by_role.values()),
        students=by_role.get(UserRole.STUDENT, 0),
        teachers=by_role.get(UserRole.TEACHER, 0),
        admins=by_role.get(UserRole.ADMIN, 0),
        documents=_count(db, select(func.count(Document.id))),
        ready_documents=_count(
            db,
            select(func.count(Document.id)).where(
                Document.processing_status == DocumentStatus.READY
            ),
        ),
        chat_sessions=_count(db, select(func.count(ChatSession.id))),
    )


def _user_row(user: User, sp: StudentProfile | None, tp: TeacherProfile | None) -> AdminUserRow:
    return AdminUserRow(
        id=user.id,
        email=user.email,
        username=user.username,
        full_name=user.full_name,
        role=user.role.value,  # type: ignore[arg-type]
        is_active=user.is_active,
        branch=sp.branch if sp else None,
        department=tp.department_name if tp else None,
        last_login=user.last_login,
        created_at=user.created_at,
    )


@router.get("/users", response_model=AdminUserListResponse, summary="List users (filterable, searchable)")
def list_users(
    db: DbSession,
    role: str | None = Query(None, description="student | teacher | admin | all"),
    search: str | None = Query(None, description="Match name, email or username"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> AdminUserListResponse:
    stmt = (
        select(User, StudentProfile, TeacherProfile)
        .outerjoin(StudentProfile, StudentProfile.user_id == User.id)
        .outerjoin(TeacherProfile, TeacherProfile.user_id == User.id)
    )
    count_stmt = select(func.count(User.id))

    if role and role != "all":
        try:
            role_value = UserRole(role)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=f"Unknown role: {role}") from exc
        stmt = stmt.where(User.role == role_value)
        count_stmt = count_stmt.where(User.role == role_value)

    if search:
        like = f"%{search.strip().lower()}%"
        cond = or_(
            func.lower(User.full_name).like(like),
            func.lower(User.email).like(like),
            func.lower(User.username).like(like),
        )
        stmt = stmt.where(cond)
        count_stmt = count_stmt.where(cond)

    rows = db.execute(stmt.order_by(User.created_at.desc()).limit(limit).offset(offset)).all()
    return AdminUserListResponse(
        total=_count(db, count_stmt),
        items=[_user_row(u, sp, tp) for u, sp, tp in rows],
    )


@router.patch("/users/{user_id}", response_model=AdminUserRow, summary="Activate/deactivate or change role")
def update_user(
    user_id: uuid.UUID,
    data: AdminUserUpdate,
    db: DbSession,
    current_user: CurrentUser,
) -> AdminUserRow:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You can't change your own account here.",
        )
    if data.is_active is not None:
        user.is_active = data.is_active
    if data.role is not None:
        user.role = UserRole(data.role)
    db.commit()
    db.refresh(user)
    return _user_row(user, user.student_profile, user.teacher_profile)


# ── Notification delivery monitoring ──────────────────────────────────


def _latency_ms(row: NotificationDelivery) -> int | None:
    """Latency from publish → ACKED, or publish → last SENT if not yet ACKed."""
    if row.acked_at is not None:
        return int((row.acked_at - row.created_at).total_seconds() * 1000)
    if row.last_sent_at is not None:
        return int((row.last_sent_at - row.created_at).total_seconds() * 1000)
    return None


@router.get(
    "/notifications/status",
    response_model=NotificationStatusResponse,
    summary="Recent notification deliveries with status + retries",
)
def notification_status(
    db: DbSession,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> NotificationStatusResponse:
    stmt = (
        select(NotificationDelivery, User.full_name, User.email)
        .join(User, User.id == NotificationDelivery.user_id, isouter=True)
        .order_by(NotificationDelivery.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    rows = [
        NotificationDeliveryRow(
            id=d.id,
            user_id=d.user_id,
            user_name=full_name,
            user_email=email,
            notification_type=d.notification_type.value,
            title=d.title,
            content=d.content,
            sequence_number=d.sequence_number,
            status=d.status.value,
            retry_count=d.retry_count,
            last_sent_at=d.last_sent_at,
            acked_at=d.acked_at,
            created_at=d.created_at,
            latency_ms=_latency_ms(d),
        )
        for d, full_name, email in db.execute(stmt).all()
    ]
    return NotificationStatusResponse(
        rows=rows, total=_count(db, select(func.count()).select_from(NotificationDelivery))
    )


@router.get(
    "/notifications/stats",
    response_model=NotificationStatsResponse,
    summary="Aggregate notification delivery counters",
)
def notification_stats(db: DbSession) -> NotificationStatsResponse:
    return NotificationStatsResponse(**notifications_service.compute_delivery_stats(db))
