"""Model package for Alembic autogenerate discovery.

All models must be imported here so Alembic picks them up during `revision --autogenerate`.
"""

from app.core.database import Base
from app.models.chat import ChatMessage, ChatSession, ChatType, MessageRole
from app.models.content import Document, DocumentChunk, DocumentStatus
from app.models.notification import (
    NotificationDelivery,
    NotificationStatus,
    NotificationType,
)
from app.models.quiz import (
    TOPIC_SKILL_PREFIX,
    LearnerSkill,
    QuizAttempt,
    QuizItemStat,
    QuizResponse,
)
from app.models.user import StudentProfile, TeacherProfile, User, UserRole

__all__ = [
    "Base",
    # Users
    "User",
    "UserRole",
    "StudentProfile",
    "TeacherProfile",
    # Knowledge base (RAG)
    "Document",
    "DocumentChunk",
    "DocumentStatus",
    # Chat
    "ChatSession",
    "ChatMessage",
    "ChatType",
    "MessageRole",
    # Notifications
    "NotificationDelivery",
    "NotificationType",
    "NotificationStatus",
    # Learn quizzes
    "QuizAttempt",
    "QuizResponse",
    "LearnerSkill",
    "QuizItemStat",
    "TOPIC_SKILL_PREFIX",
]
