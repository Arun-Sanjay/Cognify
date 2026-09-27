# Backend — Claude rules

FastAPI + SQLAlchemy 2 (sync) + Alembic + Pydantic v2. Read `../CLAUDE.md` first.

## The cwd gotcha

**Always `cd backend` before starting the app, running Alembic or pytest.** `app/core/config.py` reads `.env` relative to the process cwd. Launched from the repo root, `backend/.env` is ignored and the app silently points at a fresh `./cognify.db` in the wrong directory.

```bash
cd backend
.venv/bin/python -m uvicorn app.main:app --reload --port 8000
.venv/bin/python -m pytest
.venv/bin/python -m alembic upgrade head
```

## Layout

```
backend/app/
├── main.py            # app factory, CORS, lifespan (audio cleanup + notification retry loops), /audio mount, /health
├── core/              # config.py (Settings, active_anthropic_model), database.py, security.py (JWT + bcrypt)
├── api/
│   ├── deps.py        # DbSession, CurrentUser, require_role(...), claude_rate_limit / ClaudeRateLimited
│   ├── router.py      # mounts each route module under /api/v1/<prefix>
│   └── routes/        # auth, documents, chat, speech, admin, notifications (WebSocket)
├── models/            # user.py, content.py (Document + DocumentChunk), chat.py, notification.py
├── schemas/           # Pydantic request/response shapes, one file per domain
└── services/          # business logic — see below
```

Routes are thin: validate → call a service → return. When adding a feature: model → migration → schema → service → route → register in `router.py`.

## Services

- `auth.py` — signup (creates the role profile), login by email **or** username, lookups.
- `claude_client.py` — the **only** Anthropic entry point: `generate_completion`, `generate_completion_multiturn`, `stream_completion`, `generate_completion_vision`, `summarize_document`. Never raises; returns `""`/fallbacks when the key is missing or the call fails.
- `embeddings.py` — lazy-loaded Sentence Transformers (`all-MiniLM-L6-v2`, 384-d). First call after a restart takes a few seconds.
- `text_extraction.py` → `chunking.py` → `document_processor.py` — the ingestion pipeline, run as a `BackgroundTask` (it imports `SessionLocal` inside the function so tests can repoint it).
- `vector_search.py` — `search_chunks(...)`: pgvector `<=>` on Postgres, Python cosine loop on SQLite. `visible_documents_filter` is the single visibility rule (admins: all; others: shared + own private).
- `document.py` — upload/list/get/delete + permission helpers (`can_view_document`, `can_modify_document`).
- `chat.py` — session + message persistence (keyed by `chat_type`). `ai_chat.py` — the RAG assistant: retrieve → prompt (per-mode system prompt) → stream → persist with citations + `assistant_meta.mode`.
- `speech.py` — ElevenLabs Scribe ASR (+ Whisper fallback) and TTS saved under `uploads/audio/` (served at `/audio`, auto-purged). `elevenlabs_agent.py` — conversational-agent signed URLs + transcript fetch.
- `notifications.py` — WebSocket registry + TCP-style outbox. From sync code call `publish_sync(...)`; add new event kinds to `NotificationType` (+ a migration extending the Postgres enum).

## Models + migrations

`app.models.__init__` re-exports every model and the lifespan imports it so everything is registered. Enums store **values** (`"student"`) via `values_callable`.

Schema history starts at `000000000001_initial_schema` (hand-written: enables `vector`, creates an HNSW index on Postgres, stays SQLite-safe). `000000000002_enable_rls` turns on row-level security for every table. **Any migration that creates a table must also `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` on Postgres.** Supabase serves `public` over REST to anyone with the anon key; the backend connects as the table owner, so it bypasses RLS. For changes: edit the model → `alembic revision --autogenerate -m "..."` → **inspect** (autogenerate misses enum-value additions and Postgres-only DDL) → `alembic upgrade head`. The Docker image runs `alembic upgrade head` on every boot.

## Auth

`CurrentUser` resolves the bearer JWT (HS256, 7-day expiry, issuer `cognify`). Gate by role with `Depends(require_role("teacher", "admin"))`, or a whole router via `APIRouter(dependencies=[...])` (that's how `/admin` works). `JWT_SECRET_KEY` must be overridden in prod — nothing rejects the default at startup.

## AI cost rule

Wire **both**: route Claude calls through `claude_client` (model from `settings.active_anthropic_model`), and add the `ClaudeRateLimited` dependency to any Claude-touching route.

## Tests

`tests/conftest.py` sets env vars before importing the app (ElevenLabs forced off), builds a temp SQLite DB with `create_all`, repoints `SessionLocal`, and truncates tables after each test. Mock Claude / embeddings in tests (see `test_documents.py`, `test_chat_modes.py`) — never hit real APIs.

## Don't

- Add a `Co-Authored-By: Claude` trailer.
- Hardcode a model string, or add a Claude route without the rate limiter.
- Introduce Celery / Redis / LangChain.
- Commit anything from `uploads/` or any `.env`.
