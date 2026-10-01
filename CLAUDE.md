# Cognify — Claude orientation

Cognify is a new AI-powered learning app (target use case: **GATE exam prep**). It was forked from the CampusIQ codebase on 2026-09-27 as a **clean base**: the architecture, API layer, AI/RAG pipeline and UI shell were kept; every CampusIQ feature (quizzes, coding platform, grading, placement prep, gamification, …) was removed. New features get built on top of this base. Deeper rules live in `backend/CLAUDE.md` and `frontend/CLAUDE.md`.

## What's in the base

- **Auth + roles** — email/username login, JWT, `student` / `teacher` / `admin` with role-gated routes on both sides. Lean `student_profiles` / `teacher_profiles` tables to extend.
- **Knowledge base (RAG)** — upload PDF/DOCX/PPTX/TXT/MD → background ingestion (extract → chunk → embed with Sentence Transformers → Claude summary) → pgvector semantic search. Teacher/admin uploads are **shared**; student uploads are **private** to that student.
- **AI Assistant** — streaming RAG chat with citations and three response modes (`explain` / `diagram` → Mermaid / `questions` → solved + unsolved practice cards). The reference implementation for every future AI surface.
- **Speech** — ElevenLabs Scribe ASR + TTS, OpenAI Whisper fallback, ElevenLabs conversational-agent signed URLs (`/speech/*`). All optional; the frontend has browser fallbacks.
- **Real-time notifications** — WebSocket with a TCP-style outbox (sequence numbers, ACKs, retry/backoff) + an admin delivery dashboard.
- **Learn** — NPTEL-style video courses: subject (GATE paper) → unit (syllabus section) → topics ("weeks") → curated YouTube lectures (a Hinglish and an English track per topic), each with a transcript, an authored notes deck (slides with key frames, diagrams, worked examples, practice) and a streaming **lecture tutor** grounded in the notes + transcript. Content is JSON on disk under `backend/content/learn/` (not the DB), built offline with `backend/scripts/learn_fetch.py` + `learn_assemble.py`. First unit live: CS → Operating System.
- **Quizzes (Learn)** — per-unit pre-authored GATE question bank (MCQ/MSQ/NAT, each tagged topic → subtopic → difficulty 1–5, with worked solution, per-option feedback and trap). Three modes: **adaptive** (hierarchical Elo learner model, items picked for ~70% predicted success, interleaving, spaced re-asking of misses), **custom practice** (pick subtopics/difficulty/types/count, instant feedback), **mock test** (GATE timer, palette, negative marking). Per-subtopic readiness/mastery persists across sessions; an AI tutor explains any answered question. Bank = JSON under `backend/content/learn/<s>/<u>/quiz/`; student state in DB. Live for CS → Operating System only (697 questions, difficulty-calibrated).
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
├── docs/
│   ├── GATE_2027_Syllabus_and_Exam_Guide.md   # ~9.5k lines — see "GATE reference" below
│   ├── adaptive-learning-research.md          # evidence + spec behind the adaptive quiz engine
│   └── learn-authoring/<subject>-<unit>/       # offline Learn curation inputs (not served) — see "Learn content pipeline"
├── frontend/                     # Vite SPA — see frontend/CLAUDE.md
└── backend/                      # FastAPI app (+ Dockerfile) — see backend/CLAUDE.md
    ├── content/learn/            # served Learn content (catalog, units, lectures, key frames)
    └── scripts/learn_fetch.py, learn_assemble.py, quiz_validate.py, quiz_verify.py, quiz_difficulty.py
```

## GATE reference

`docs/GATE_2027_Syllabus_and_Exam_Guide.md` is the source of truth for exam facts and syllabus wording. Built from IIT Madras's official GATE 2027 syllabus PDFs + Information Brochure (word-level checked against the PDF text).

- **Part 1** — at a glance: exam 6–7, 13–14, 20–21 Feb 2027; results 19 Mar 2027; regular registration closes 5 Oct 2026 (late fee until 12 Oct; corrections 14–21 Oct). New for 2027: Robotics & Automation (RA) paper; Textile moved into XE (XE9); XE/XH/XL section codes renumbered.
- **Part 2** — pattern (65 Q / 100 marks / 3 h, GA = 15 marks), question types, negative marking, score + normalization formulas, eligibility, fees, two-paper combinations, zones/cities, PSU use.
- **Part 3** — full Section → Topic → Subtopic syllabus for all 30 papers + every XE/XH/XL section. Official typos kept and marked *(sic)*.
- **Appendix** — GATE 2026 (IIT Guwahati) cut-offs + registered/appeared/qualified per paper, and the 2026 session schedule.

Learn's units for a subject = that paper's syllabus sections from this file (CS has 10).

## Running locally

```bash
cd backend && .venv/bin/python -m alembic upgrade head        # first run: create backend/cognify.db
cd backend && .venv/bin/python -m uvicorn app.main:app --reload --port 8000
cd frontend && npm run dev                                     # http://localhost:5173
```

Health: `curl http://127.0.0.1:8000/health`. There are no seeded accounts — sign up through the UI (any role).

## Learn content pipeline (offline, run by Claude — not part of the app)

1. **Curate** — per topic, pick the best Hinglish + English lectures (views, likes, top-comment sentiment, GATE coverage; must have captions). Research brief: `docs/learn-authoring/cs-os/RESEARCH.md`. Output: `picks/T<n>.json`; manual fixes go in `extras.json` (added videos) and `overrides.json` (removals/re-ordering). `python3 build_spec.py` merges them into `unit_spec.json`.
2. **Fetch** — `backend/scripts/learn_fetch.py --out <work> <ids…>` (metadata, English transcript, 480p video, key frames, 4×4 contact sheets). Needs its own venv: `pip install "yt-dlp[default,curl-cffi]" youtube-transcript-api deno pillow` + ffmpeg (this ffmpeg has no `drawtext`; sheets are drawn with Pillow).
3. **Write notes** — one notes-deck JSON per lecture, authored by Claude (agents) from the transcript + contact sheets, following `docs/learn-authoring/cs-os/NOTES.md`. The quality bar is the finished Deadlock deck `notes/rWFH6PLOIEI.json`. Chosen frames are copied to `backend/content/learn/media/<id>/`.
4. **Assemble** — `backend/scripts/learn_assemble.py --spec unit_spec.json --work <work> --notes <notes>` → `content/learn/<subject>/<unit>/unit.json` + `lectures/<id>.json`. Set the unit `available: true` in `catalog.json`.

Gotchas:
- **Keep curation inputs in `docs/learn-authoring/`, never only in a session scratchpad** — the first OS run's scratchpad was wiped and the picks had to be recovered from session logs. Fetch output (`work/`, videos/frames, ~GBs) is disposable and can live in scratch.
- YouTube rate-limits: heavy yt-dlp traffic got the transcript endpoint (`youtube-transcript-api`) IP-blocked (429) for hours; video downloads kept working. Always use `--impersonate chrome`; on 403, `learn_fetch.py` falls back to HLS / ≤480p formats. Don't run research searches and transcript fetches at the same time.
- The dev machine is an 8 GB Mac: running both dev servers + background fetches + parallel agents got processes killed for low memory. Stop the dev servers before the multi-agent notes step.
- `NOTES.md`/`RESEARCH.md` refer to `<scratchpad>/yt/...` paths from the original run — substitute the current work dir.

## Quiz bank pipeline (offline, run by Claude)

1. Taxonomy: `content/learn/<s>/<u>/quiz/taxonomy.json` — topics = the unit's Learn topics, subtopics = their `syllabus_points` (slugged). Questions must use these ids.
2. Author: one agent per topic following `docs/learn-authoring/cs-os/QUIZ.md` (format, difficulty rubric, coverage ≥8 per subtopic with all 5 levels, correctness rules) → `quiz/<topic_id>.json`. `python3 scripts/quiz_validate.py content/learn/cs/os/quiz` must print OK.
3. Verify: a *different* agent per topic solves blind (`scripts/quiz_verify.py blind …` hides answers), then `quiz_verify.py compare …`, then fixes keys/ambiguous stems. OS result: 610/611 blind agreement (the 1 was the checker's slip), 6 wording fixes, 0 key changes.
4. Calibrate difficulty: a fresh agent per topic rates every question blind against `docs/learn-authoring/cs-os/DIFFICULTY.md` (`scripts/quiz_difficulty.py blind/compare` hides level, marks, time), then rewrites/relabels; changed questions get another blind correctness check (`quiz_verify.py … --ids`). **Authors over-rate difficulty** — on OS only 52% of original labels survived, and 61 of 65 "d5"s were really d3–d4, so never skip this step. After calibration: 697 questions (d1–d5: 125/191/163/111/107); the validator enforces ≥1 d1/d2, ≥2 d3/d4/d5 per subtopic and marks = 2 iff d ≥ 4. When a question's content or level changes, delete its `quiz_item_stats` row (learned difficulty is keyed by id).
5. Question ids are permanent (student history + learned item difficulty key off `<subject>/<unit>/<id>`) — edit questions in place, never renumber; add new ones at the end.

## Current status (as of 2026-10-01)

- **Quizzes for CS → OS are done** (697 verified, difficulty-calibrated questions, 3 modes, adaptive engine, AI help; migration `000000000003_learn_quiz`). Backend 72 tests, frontend 20 tests pass; checked in the browser (adaptive flow, mock test, results, mobile). Not yet applied to the Supabase prod DB.
- **Uncommitted** on `main`: the whole Learn feature (backend route/service/schema/tests, frontend pages/components/hooks, `content/learn/`, both scripts), `docs/` (GATE guide + `learn-authoring/`), and CLAUDE.md updates. Backend: 55 tests pass (8 Learn). Frontend: typecheck, lint, vitest pass.
- **CS → Operating System**: 11 topics, **84 lectures** curated in `docs/learn-authoring/cs-os/unit_spec.json` (Gate Smashers / Jenny's Lectures / Neso Academy / Sudhakar Atchala…). Only **1 lecture is live** — Deadlock L-4.1 (`rWFH6PLOIEI`, Gate Smashers), with transcript, notes deck and 3 key frames; `unit.json` currently lists just that one.
- **Next steps**: (1) confirm the YouTube transcript block has lifted, (2) fetch transcripts + frames for the other 83 (the earlier frame downloads were lost with the scratchpad), (3) parallel agents write the 83 notes decks per `NOTES.md`, (4) assemble the full unit and check it in the browser.
- Polish noted: Mermaid diagrams in notes slides render a bit small.
- Local test account (SQLite only, not in prod): `learntester`. Test lecture URL: `http://localhost:5173/student/learn/cs/os/rWFH6PLOIEI`.

## Database

- **Local:** SQLite at `backend/cognify.db` (RAG falls back to a Python cosine loop — no pgvector needed).
- **Prod:** Supabase project **`cognify`** (ref `bqsjstfhldtppgqjdgij`, org "MainEl", region `ap-south-1`). Schema is applied (`alembic upgrade head`), pgvector enabled, HNSW index on `document_chunks.embedding`, **RLS enabled on every table** (new tables must enable it too). Connection string (Session pooler, `aws-0-ap-south-1.pooler.supabase.com:5432`) is commented in `backend/.env`; the DB password lives **outside the repo** in `../.cognify-prod-db`.
- Migrations: `000000000001_initial_schema` + `000000000002_enable_rls` + `000000000003_learn_quiz`. New tables → edit models, then `alembic revision --autogenerate`, then **inspect** (autogenerate misses enum-value additions and Postgres-only DDL).

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
