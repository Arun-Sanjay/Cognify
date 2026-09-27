"""Pydantic schemas for authentication endpoints."""
from __future__ import annotations

import re
import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

# 3-30 chars, lowercase letters/digits/dot/underscore, must start alphanumeric.
USERNAME_RE = re.compile(r"[a-z0-9][a-z0-9_.]{2,29}")


# ══════════════════════════════════════
# Signup — extended per role
# ══════════════════════════════════════

UserRoleLiteral = Literal["student", "teacher", "admin"]


class SignupRequest(BaseModel):
    """Base signup fields. Role-specific fields are optional here and
    the service layer decides which profile to create.
    """

    email: EmailStr
    username: str = Field(..., min_length=3, max_length=30)
    password: str = Field(..., min_length=8, max_length=128)
    full_name: str = Field(..., min_length=2, max_length=255)
    role: UserRoleLiteral

    # Student-specific (optional)
    branch: str | None = Field(None, max_length=100)

    # Teacher-specific (optional)
    department_name: str | None = Field(None, max_length=255)
    designation: str | None = Field(None, max_length=255)

    @field_validator("username")
    @classmethod
    def normalize_username(cls, v: str) -> str:
        v = v.strip().lower()
        if not USERNAME_RE.fullmatch(v):
            raise ValueError(
                "Username must be 3-30 characters — lowercase letters, numbers, "
                "dot or underscore, starting with a letter or number."
            )
        return v

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if v.isdigit() or v.isalpha():
            raise ValueError("Password must contain letters and numbers")
        return v


class LoginRequest(BaseModel):
    """Login with either an email or a username (in `identifier`). The legacy
    `email` field is still accepted so existing clients keep working."""

    identifier: str | None = Field(None, max_length=255)
    email: str | None = Field(None, max_length=255)
    password: str = Field(..., min_length=1, max_length=128)

    @model_validator(mode="after")
    def _require_identifier(self) -> "LoginRequest":
        if not (self.identifier or self.email):
            raise ValueError("Provide an email or username to log in.")
        return self

    @property
    def login_id(self) -> str:
        return (self.identifier or self.email or "").strip().lower()


class TokenResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in_seconds: int
    user: "UserResponse"


# ══════════════════════════════════════
# User response schemas
# ══════════════════════════════════════

class StudentProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    branch: str | None = None


class TeacherProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    department_name: str | None = None
    designation: str | None = None


class UserResponse(BaseModel):
    """Public user representation returned by /me and /login."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    username: str
    full_name: str
    role: UserRoleLiteral
    is_active: bool = True
    last_login: datetime | None = None
    created_at: datetime

    student_profile: StudentProfileResponse | None = None
    teacher_profile: TeacherProfileResponse | None = None


# rebuild forward reference
TokenResponse.model_rebuild()
