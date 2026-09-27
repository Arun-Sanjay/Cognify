"""Admin user-management schemas."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class AdminUserRow(BaseModel):
    id: uuid.UUID
    email: str
    username: str
    full_name: str
    role: Literal["student", "teacher", "admin"]
    is_active: bool
    branch: str | None = None
    department: str | None = None
    last_login: datetime | None = None
    created_at: datetime


class AdminUserListResponse(BaseModel):
    total: int
    items: list[AdminUserRow]


class AdminUserUpdate(BaseModel):
    is_active: bool | None = None
    role: Literal["student", "teacher", "admin"] | None = None


class AdminStatsResponse(BaseModel):
    total_users: int
    students: int
    teachers: int
    admins: int
    documents: int
    ready_documents: int
    chat_sessions: int
