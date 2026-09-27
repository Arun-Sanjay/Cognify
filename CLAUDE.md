# Cognify — Claude orientation

Cognify is a new AI-powered learning app (target use case: **GATE exam prep**). It was forked from the CampusIQ codebase on 2026-09-27 as a **clean base**: the architecture, API layer, AI/RAG pipeline and UI shell were kept; every CampusIQ feature (quizzes, coding platform, grading, placement prep, gamification, …) was removed. New features get built on top of this base. Deeper rules live in `backend/CLAUDE.md` and `frontend/CLAUDE.md`.

## What's in the base

- **Auth + roles** — email/username login, JWT, `student` / `teacher` / `admin` with role-gated routes on both sides. Lean `student_profiles` / `teacher_profiles` tables to extend.
- **Knowledge base (RAG)** — upload PDF/DOCX/PPTX/TXT/MD → background ingestion (extract → chunk → embed with Sentence Transformers → Claude summary) → pgvector semantic search. Teacher/admin uploads are **shared**; student uploads are **private** to that student.
- **AI Assistant** — streaming RAG chat with citations and three response modes (`explain` / `diagram` → Mermaid / `questions` → solved + unsolved practice cards). The reference implementation for every future AI surface.
- **Speech** — ElevenLabs Scribe ASR + TTS, OpenAI Whisper fallback, ElevenLabs conversational-agent signed URLs (`/speech/*`). All optional; the frontend has browser fallbacks.
- **Real-time notifications** — WebSocket with a TCP-style outbox (sequence numbers, ACKs, retry/backoff) + an admin delivery dashboard.
- **Admin** — platform stats, user management (search, filter, activate/deactivate, role change).
- **UI shell** — marketing landing, login/signup, sidebar + topbar + mobile bottom tabs, 3 themes, UI primitives, chat components, PWA.

## Stack

- **Frontend:** React 19, Vite 8, TypeScript 6, Tailwind 3.4, Zustand 5, React Router 7, Framer Motion 12, Recharts, lucide-react, react-markdown + remark-gfm, Mermaid, GSAP + tsparticles (landing), vite-plugin-pwa.
- **Backend:** FastAPI, SQLAlchemy 2 (sync), Alembic, Pydantic v2, PyJWT + bcrypt, PyMuPDF + python-docx. SQLite locally, **Supabase Postgres + pgvector** in prod.
- **AI:** Anthropic SDK (Claude — Haiku 4.5 for dev), Sentence Transformers `all-MiniLM-L6-v2` (384-dim), ElevenLabs.

## Layout

```
cognify/                          # ← the git repo (parent dir holds the prod DB password file, not a repo)
├── CLAUDE.md, README.md
├── render.yaml, docker-compose.yml, .github/workflows/ci.yml
├── frontend/                     # Vite SPA — see frontend/CLAUDE.md
└── backend/                      # FastAPI app (+ Dockerfile) — see backend/CLAUDE.md
```

## Running locally

```bash
cd backend && .venv/bin/python -m alembic upgrade head        # first run: create backend/cognify.db
cd backend && .venv/bin/python -m uvicorn app.main:app --reload --port 8000
cd frontend && npm run dev                                     # http://localhost:5173
```

Health: `curl http://127.0.0.1:8000/health`. There are no seeded accounts — sign up through the UI (any role).

## Database

- **Local:** SQLite at `backend/cognify.db` (RAG falls back to a Python cosine loop — no pgvector needed).
- **Prod:** Supabase project **`cognify`** (ref `bqsjstfhldtppgqjdgij`, org "MainEl", region `ap-south-1`). Schema is applied (`alembic upgrade head`), pgvector enabled, HNSW index on `document_chunks.embedding`, **RLS enabled on every table** (new tables must enable it too). Connection string (Session pooler, `aws-0-ap-south-1.pooler.supabase.com:5432`) is commented in `backend/.env`; the DB password lives **outside the repo** in `../.cognify-prod-db`.
- Migrations: `000000000001_initial_schema` + `000000000002_enable_rls`. New tables → edit models, then `alembic revision --autogenerate`, then **inspect** (autogenerate misses enum-value additions and Postgres-only DDL).

## Cost rule (hard constraint)

1. Every Claude call goes through `backend/app/services/claude_client.py`, which reads `settings.active_anthropic_model` — Haiku 4.5 unless `USE_PRODUCTION_MODEL=True`. Never hardcode a model string.
2. Every Claude-touching route takes the `claude_rate_limit` dependency (per-user token bucket, `CLAUDE_REQUESTS_PER_MINUTE=20`).

## Locked design decisions

- No LangChain / LangGraph — hand-rolled prompt + retrieval code.
- No Celery / RQ / Redis — FastAPI `BackgroundTasks` until something is proven too slow.
- Theme via CSS variables only (see `frontend/CLAUDE.md`).

## Git

- **Never add a `Co-Authored-By: Claude` trailer** to commits.
- Remote: https://github.com/Arun-Sanjay/Cognify (public). Don't push without being asked.
