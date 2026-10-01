# Frontend — Claude rules

Vite 8 + React 19 + TypeScript 6 SPA. Read `../CLAUDE.md` first.

## Run / verify

```bash
cd frontend
npm run dev          # http://localhost:5173 (use localhost, not 127.0.0.1 — Vite binds IPv6)
npm run typecheck    # tsc --noEmit
npm run lint         # ESLint (only lints .js/.jsx — TSX correctness rides on typecheck)
npm test             # vitest run
npm run build
```

Tailwind is **v3**, not v4. `strict: true`, but unused locals/params are allowed.

## Routing

`src/routes/AppRouter.tsx` is the single source of truth. Wrappers: `ProtectedRoute` (role-gated, validates the token via `authApi.me()`), `PublicOnlyRoute` (bounces authed users off `/login` `/signup`), `AppLayout` (sidebar shell + ErrorBoundary per page).

- Public: `/`, `/login`, `/signup`
- Student `/student/*`: index (`HomePage`), `learn`, `assistant`, `library`
- Teacher `/teacher/*`: index (`HomePage`), `learn`, `assistant`, `library`
- Admin `/admin/*`: index (`DashboardPage`), `learn`, `assistant`, `library`, `users`, `notifications`
- Learn (every role): `learn` (`LearnHomePage` — subjects → units), `learn/:subjectId/:unitId[/:lectureId]` (`LearnUnitPage` — course outline + course overview or `LectureView`).
- Quizzes (every role): `learn/:subjectId/:unitId/quiz` (`QuizHomePage` — mode, subtopic picker, filters, readiness; `?topic=<topic id>` preselects a topic), `learn/:subjectId/:unitId/quiz/:attemptId` (`QuizAttemptPage` — runner while active, results when completed). Static `quiz` outranks the `:lectureId` param in React Router.

**Adding a page:** add the route in `AppRouter.tsx`, then an entry in `src/components/layout/navConfig.ts` — the sidebar, mobile bottom tabs (`primaryNavByRole`, max 4) and the TopBar title (`titleForPath`) all derive from it. Pages shared across roles live in `src/pages/shared/`.

## State

- Auth: `src/store/authStore.ts` — Zustand + `persist` (key `cognify-auth`), `{user, token}`. Any non-auth 401 logs out.
- Theme: `src/hooks/useTheme.ts` (key `cognify-theme`) — `nebula` (default) / `light` / `dark`.
- Notifications: `src/store/notificationStore.ts` (toasts), fed by `useNotificationsSocket`.

Everything else is local component state — no React Query / Redux.

## Theming (hard rule)

Style with the CSS variables in `src/index.css` (`--bg-*`, `--text-*`, `--border-*`, `--input-bg`, `--shadow-*`, `--glass-*`, `--gradient-accent`). No hardcoded hex or fixed-color Tailwind utilities in app components. **Exception:** the marketing landing (`src/pages/marketing/`, `LandingPage.tsx`) uses its own `landing.css` brand colors.

## API client

`src/api/client.ts` — one method per endpoint, grouped: `authApi`, `documentsApi`, `chatApi`, `learnApi`, `quizApi`, `speechApi`, `adminApi` (+ low-level `api` / `apiRequest`). Base URL from `VITE_API_BASE_URL`. Errors throw `ApiError(status, detail, body)`. `FormData` bodies pass through untouched. Streaming goes through the shared `streamPost` helper (raw `fetch` + `ReadableStream`, `onChunk` callback) — used by `chatApi.streamMessage`, `learnApi.ask` and `quizApi.ask`; reuse it for new streaming surfaces. Types live in `src/types/` (one file per domain, mirroring `backend/app/schemas/*.py`). Add the type → the client method → call it from the page; never `fetch` from a component (the Library's authed blob download is the one exception).

## Components

- `components/ui/` — `Button`, `Input`, `TextArea`, `Select`, `Card` (+ `CardHeader`/`CardTitle`/`CardLabel`), `Badge`, `Avatar`, `Modal`, `ProgressBar`, `ResponsiveTable`, `ImageZoomModal` (barrel: `components/ui/index.ts`; `Disclosure` imported directly).
- `components/layout/` — `AppLayout`, `Sidebar`, `TopBar`, `BottomTabBar`, `PageTransition`, `NotificationToasts`, `GradientMesh`, `navConfig`.
- `components/chat/` — `ChatLayout` (messages + input + optional side panels), `ChatMessage` (react-markdown + remark-gfm + `markdownComponents`), `ChatInput`, `ModeSelector`, and `cards/` — `FenceDispatcher` turns fenced blocks (```` ```solved ````, ```` ```unsolved ````, ```` ```mermaid ````, …) into `SolvedCard` / `UnsolvedCard` / `StepCard` / `AnswerBox` / `HintReveal` / `MermaidDiagram`. Reuse for any new AI surface.
- `components/learn/` — `CourseOutline` (NPTEL-style topic/lecture rail + language filter), `LectureView` (YouTube player via `useYouTubePlayer`, AI Notes / Transcript tabs, prev/next), `NotesDeck` + `NoteBlockView` (renders the notes-deck block types from `backend/content/learn/README.md`), `TranscriptView` (click-to-seek, follows playback), `LectureTutor` (slide-over streaming tutor; `[mm:ss]` citations seek the video). Progress + language preference are per-device localStorage (`useLearnProgress` / `useLearnLanguage`).
- `components/quiz/` — `QuestionCard` (MCQ/MSQ/NAT input, locked review, reveal with per-option feedback, trap, worked solution), `PracticeRunner` (practice + adaptive; keys A–D / Enter), `ExamRunner` (GATE palette, countdown, mark-for-review, auto-submit), `QuizResults`, `QuestionTutor` (slide-over AI help), `ReadinessBar` / `SkillMeter` / `MasteryBadge`, `quizFormat.ts` (labels, `poolSize`, `parseNat`, `parseServerTime` — always parse server times with it).
- `components/dashboard/` — `StatCard`, `ScoreRing`, `TaskFeed`, `ActivityFeed`.
- `AuthedImage` — renders a private image fetched with the bearer token.
- Hooks: `useBrowserSpeechRecognition` / `useBrowserSpeechSynthesis` (free fallbacks), `useMediaRecorder`, `useMediaQuery`, `useNotificationsSocket`.

## Animation

Stagger + fade-up on overview pages (see `HomePage.tsx`); keep transactional pages calm.

## lucide-react gotcha

Pinned `^1.7.0` — verify an icon exists before importing (`Github` does not).

## Verifying UI changes

Use the Playwright MCP against `http://localhost:5173` when the dev servers are running. A backend 5xx often shows up as a CORS error in the browser console.
