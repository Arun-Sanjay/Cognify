"""Authentication endpoints: POST /signup, POST /login, GET /me."""
from __future__ import annotations

from fastapi import APIRouter, status

from app.api.deps import CurrentUser, DbSession
from app.schemas.auth import (
    LoginRequest,
    SignupRequest,
    TokenResponse,
    UserResponse,
)
from app.services import auth as auth_service

router = APIRouter()


@router.post(
    "/signup",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new user account",
)
def signup(data: SignupRequest, db: DbSession) -> TokenResponse:
    """Create a new user (student / teacher / admin) and return a JWT.

    Role-specific profile fields:
    - `student`: branch
    - `teacher`: department_name, designation
    - `admin`: no extra fields
    """
    return auth_service.signup(db, data)


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Login with email and password",
)
def login(data: LoginRequest, db: DbSession) -> TokenResponse:
    """Verify credentials and return a JWT."""
    return auth_service.login(db, data)


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get the currently authenticated user",
)
def me(current_user: CurrentUser) -> UserResponse:
    """Return the user associated with the `Authorization: Bearer <token>` header."""
    return UserResponse.model_validate(current_user)
