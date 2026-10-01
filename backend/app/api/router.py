from fastapi import APIRouter

from app.api.routes import admin, auth, chat, documents, learn, notifications, quiz, speech

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(documents.router, prefix="/documents", tags=["documents"])
api_router.include_router(chat.router, prefix="/chat", tags=["chat"])
api_router.include_router(learn.router, prefix="/learn", tags=["learn"])
api_router.include_router(quiz.router, prefix="/learn/quiz", tags=["learn-quiz"])
api_router.include_router(speech.router, prefix="/speech", tags=["speech"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(notifications.router, prefix="/ws", tags=["websockets"])
