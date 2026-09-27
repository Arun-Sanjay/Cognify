# Cognify

An AI-powered learning platform — an AI tutor grounded in your own study material.

This repository is the **clean base**: auth + roles, a RAG knowledge base, a streaming AI assistant, speech, real-time notifications, admin tooling and the full UI shell. Product features are built on top.

## Quick start

```bash
# Backend
cd backend
python3.12 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
cp .env.example .env            # add ANTHROPIC_API_KEY + a JWT_SECRET_KEY
.venv/bin/python -m alembic upgrade head
.venv/bin/python -m uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm install
cp .env.example .env
npm run dev                     # http://localhost:5173
```

Sign up through the UI with any role (student / teacher / admin).

## Architecture

| Layer | What |
|---|---|
| Frontend | React 19 + Vite + TypeScript + Tailwind SPA, Zustand state, PWA |
| Backend | FastAPI + SQLAlchemy 2 + Alembic, JWT auth, role guards, per-user AI rate limit |
| RAG | Upload → extract (PyMuPDF / python-docx) → chunk → embed (Sentence Transformers, 384-d) → pgvector cosine search |
| AI | Claude via a single wrapper (`claude_client.py`) with a dev/prod model switch |
| Speech | ElevenLabs Scribe ASR + TTS, Whisper fallback, conversational-agent signed URLs |
| Realtime | WebSocket notifications with sequence numbers, ACKs and retry/backoff |
| Database | SQLite locally, Supabase Postgres + pgvector in production |

## API

All routes are under `/api/v1`:

- `/auth` — `signup`, `login` (email or username), `me`
- `/documents` — upload, list, get, chunks, search, reprocess, embed-backfill, download, delete
- `/chat` — sessions CRUD, streaming `messages`, `messages/blocking`
- `/speech` — `status`, `tts`, `transcribe`, `agent/signed-url`
- `/admin` — `stats`, `users` (list / patch), `notifications/status`, `notifications/stats`
- `/ws/notifications?token=…` — WebSocket

Interactive docs: http://127.0.0.1:8000/docs

## Checks

```bash
cd backend && .venv/bin/python -m pytest
cd frontend && npm run typecheck && npm run lint && npm test && npm run build
```
