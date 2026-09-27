"""Security utilities: password hashing (bcrypt) and JWT tokens.

CN concepts applied:
- JWT authentication (Application Layer Security, Unit V)
- Bcrypt password hashing with salt (Authentication, Unit V)
- Constant-time password verification (timing-attack prevention)
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
import jwt
from jwt.exceptions import InvalidTokenError

from app.core.config import get_settings

settings = get_settings()


# ═══════════════════════════════════════
# Password hashing (bcrypt)
# ═══════════════════════════════════════

def hash_password(plain_password: str) -> str:
    """Hash a plaintext password using bcrypt with a random salt.

    Returns a UTF-8 string safe to store in the database.
    """
    if not plain_password:
        raise ValueError("Password cannot be empty")
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(plain_password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against a bcrypt hash.

    Uses bcrypt's constant-time comparison to prevent timing attacks.
    """
    if not plain_password or not hashed_password:
        return False
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8"),
        )
    except (ValueError, TypeError):
        # malformed hash
        return False


# ═══════════════════════════════════════
# JWT tokens
# ═══════════════════════════════════════

def create_access_token(
    subject: str | uuid.UUID,
    extra_claims: dict[str, Any] | None = None,
    expires_delta: timedelta | None = None,
) -> str:
    """Create a signed JWT access token.

    Args:
        subject: The user's UUID (goes into the `sub` claim)
        extra_claims: Additional fields to include (role, email, etc.)
        expires_delta: Override default expiration

    Returns:
        Encoded JWT string (HS256 by default)
    """
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(minutes=settings.jwt_expire_minutes))

    payload: dict[str, Any] = {
        "sub": str(subject),
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
        "iss": "cognify",
    }
    if extra_claims:
        payload.update(extra_claims)

    return jwt.encode(
        payload,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )


def decode_access_token(token: str) -> dict[str, Any]:
    """Decode and verify a JWT access token.

    Raises:
        InvalidTokenError: if the token is expired, tampered with, or malformed.
    """
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
            options={"require": ["exp", "sub"]},
        )
    except InvalidTokenError:
        raise
    return payload


def get_user_id_from_token(token: str) -> uuid.UUID:
    """Extract the user UUID from a token, raising InvalidTokenError on failure."""
    payload = decode_access_token(token)
    sub = payload.get("sub")
    if not sub:
        raise InvalidTokenError("Token missing 'sub' claim")
    try:
        return uuid.UUID(sub)
    except ValueError as e:
        raise InvalidTokenError(f"Invalid user id in token: {sub}") from e
