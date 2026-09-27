"""Authentication service: signup, login, get current user."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import StudentProfile, TeacherProfile, User, UserRole
from app.schemas.auth import LoginRequest, SignupRequest, TokenResponse, UserResponse


def _user_with_profiles_query():
    """SELECT for User with both profiles eager-loaded."""
    return (
        select(User)
        .options(
            selectinload(User.student_profile),
            selectinload(User.teacher_profile),
        )
    )


def get_user_by_email(db: Session, email: str) -> User | None:
    stmt = _user_with_profiles_query().where(User.email == email.lower())
    return db.scalar(stmt)


def get_user_by_username(db: Session, username: str) -> User | None:
    stmt = _user_with_profiles_query().where(User.username == username.strip().lower())
    return db.scalar(stmt)


def get_user_by_identifier(db: Session, identifier: str) -> User | None:
    """Look up a user by email OR username (login accepts either)."""
    ident = identifier.strip().lower()
    return get_user_by_email(db, ident) or get_user_by_username(db, ident)


def get_user_by_id(db: Session, user_id: uuid.UUID) -> User | None:
    stmt = _user_with_profiles_query().where(User.id == user_id)
    return db.scalar(stmt)


def signup(db: Session, data: SignupRequest) -> TokenResponse:
    """Create a new user + role-specific profile, return a JWT."""
    # Check email uniqueness
    existing = db.scalar(select(User).where(User.email == data.email.lower()))
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    # Check username uniqueness (already normalized to lowercase by the schema)
    existing_username = db.scalar(select(User).where(User.username == data.username))
    if existing_username is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="That username is already taken",
        )

    # Create the user
    user = User(
        email=data.email.lower(),
        username=data.username,
        full_name=data.full_name.strip(),
        role=UserRole(data.role),
        hashed_password=hash_password(data.password),
        is_active=True,
    )
    db.add(user)
    db.flush()  # populate user.id

    # Create the role-specific profile
    if data.role == "student":
        profile = StudentProfile(
            user_id=user.id,
            branch=data.branch,
        )
        db.add(profile)
    elif data.role == "teacher":
        profile = TeacherProfile(
            user_id=user.id,
            department_name=data.department_name,
            designation=data.designation,
        )
        db.add(profile)
    # admin has no extra profile table

    user.last_login = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)

    # Eager-load profiles for the response
    user = get_user_by_id(db, user.id)
    return _build_token_response(user)


def login(db: Session, data: LoginRequest) -> TokenResponse:
    """Verify credentials and return a JWT. Accepts an email or a username."""
    user = get_user_by_identifier(db, data.login_id)

    # Constant-time behaviour: always run verify_password even if user missing
    if user is None:
        # Verify against a dummy hash so timing doesn't leak existence
        verify_password(data.password, "$2b$12$" + "x" * 53)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email/username or password",
        )

    if not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email/username or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive. Contact your administrator.",
        )

    user.last_login = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)

    return _build_token_response(user)


def _build_token_response(user: User) -> TokenResponse:
    """Create the JWT + wrap in a TokenResponse."""
    from app.core.config import get_settings
    settings = get_settings()

    token = create_access_token(
        subject=user.id,
        extra_claims={
            "role": user.role.value,
            "email": user.email,
        },
    )

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in_seconds=settings.jwt_expire_minutes * 60,
        user=UserResponse.model_validate(user),
    )
