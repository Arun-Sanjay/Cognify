"""Reusable FastAPI dependencies: DB session, current user, role guards.

Also home to the per-user Claude rate limiter (cost guardrail). A runaway
loop in any AI endpoint should hit 429 long before it burns the API budget.
"""
from __future__ import annotations

import threading
import time
import uuid
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt.exceptions import InvalidTokenError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import get_user_id_from_token
from app.models.user import User, UserRole
from app.services.auth import get_user_by_id

# HTTPBearer provides the raw "Authorization: Bearer <token>" header.
# auto_error=False so we can return a consistent 401 with our own message.
bearer_scheme = HTTPBearer(auto_error=False)

DbSession = Annotated[Session, Depends(get_db)]


def get_current_user(
    db: DbSession,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> User:
    """Resolve the authenticated user from the Authorization header."""
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user_id = get_user_id_from_token(credentials.credentials)
    except InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {e}",
            headers={"WWW-Authenticate": "Bearer"},
        ) from e

    user = get_user_by_id(db, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive",
        )

    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_role(*allowed_roles: UserRole | str):
    """Create a dependency that allows only users with one of the given roles.

    Usage:
        @router.post("/upload", dependencies=[Depends(require_role("teacher", "admin"))])
    """
    # Normalise strings to UserRole enum values
    allowed_values = {
        (r.value if isinstance(r, UserRole) else r)
        for r in allowed_roles
    }

    def _checker(user: CurrentUser) -> User:
        if user.role.value not in allowed_values:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"This action requires one of these roles: "
                    f"{', '.join(sorted(allowed_values))}"
                ),
            )
        return user

    return _checker


# ── Per-user Claude rate limiter ───────────────────────────
# In-process token bucket keyed by user id. `claude_requests_per_minute`
# from settings drives both the refill rate and the bucket capacity, so
# a user can burst up to the rate in one second then waits ~3s between
# subsequent calls. In-process state is fine for the single-instance
# demo deploy; Redis would be needed for multi-replica enforcement, and
# we're explicitly not introducing Redis on this project.

_buckets: dict[uuid.UUID, dict] = {}
_buckets_lock = threading.Lock()


def _consume_claude_token(user_id: uuid.UUID) -> bool:
    """Try to take 1 token from the user's bucket; return True on success.

    The bucket refills continuously at `rate / 60` tokens per second up
    to a cap of `rate` tokens.
    """
    settings = get_settings()
    rate = max(1, settings.claude_requests_per_minute)
    refill_per_second = rate / 60.0
    now = time.monotonic()
    with _buckets_lock:
        bucket = _buckets.get(user_id)
        if bucket is None:
            # First call from this user — start at full capacity.
            _buckets[user_id] = {"tokens": float(rate) - 1.0, "last_refill": now}
            return True
        elapsed = now - bucket["last_refill"]
        bucket["tokens"] = min(float(rate), bucket["tokens"] + elapsed * refill_per_second)
        bucket["last_refill"] = now
        if bucket["tokens"] >= 1.0:
            bucket["tokens"] -= 1.0
            return True
        return False


def claude_rate_limit(user: CurrentUser) -> User:
    """Dependency: 429s if this user has exhausted their Claude quota.

    Wire on every endpoint that calls Claude. Read-only endpoints stay unbounded.
    """
    if not _consume_claude_token(user.id):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                "AI request rate limit exceeded. Try again in a few seconds."
            ),
            headers={"Retry-After": "5"},
        )
    return user


def _reset_claude_buckets_for_tests() -> None:
    """Test-only helper: clear bucket state between tests."""
    with _buckets_lock:
        _buckets.clear()


ClaudeRateLimited = Annotated[User, Depends(claude_rate_limit)]
