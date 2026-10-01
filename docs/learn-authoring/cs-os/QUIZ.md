# Question-bank authoring brief — Cognify Learn (GATE CS → Operating System)

You are writing part of a **pre-authored practice question bank** for GATE CS aspirants. Students pick subtopics and practise; an adaptive engine picks the next question's difficulty from their answers (Elo-style), so **difficulty labels must be honest and consistent** and every subtopic needs questions at every level. Quality bar: as good as or better than the best GATE test series (Made Easy / ACE / GO Classes). You author everything yourself (no API calls, no web copying).

## Files

- Taxonomy (topic + subtopic ids — use these exactly): `backend/content/learn/cs/os/quiz/taxonomy.json`
- Your output: `backend/content/learn/cs/os/quiz/<topic_id>.json` (paths relative to `/Users/arunsanjay/Documents/Projects/Cognify/cognify/`)
- Validator (run it until it prints OK for your file): `python3 backend/scripts/quiz_validate.py backend/content/learn/cs/os/quiz/<topic_id>.json`

## File format

```json
{
  "topic_id": "t06-deadlock",
  "questions": [
    {
      "id": "t06-001",                       // <topic prefix>-<3 digits>, unique, sequential
      "subtopic": "bankers-algorithm",       // a subtopic id of THIS topic from taxonomy.json
      "also_tests": ["necessary-conditions"],// optional: other subtopic ids (any topic) it also exercises
      "difficulty": 3,                       // 1–5, rubric below
      "type": "mcq",                         // mcq | msq | nat
      "marks": 1,                            // GATE weight: 1 or 2
      "est_seconds": 120,                    // realistic solve time for a prepared student
      "concepts": ["safe state", "need matrix"], // 1–4 short concept tags
      "stem": "Markdown question text",
      "options": ["…", "…", "…", "…"],       // mcq/msq: exactly 4, no "A)" prefixes (UI letters them)
      "answer": "B",                         // mcq: one letter | msq: ["A","C"] (≥1, sorted) | nat: {"min": 2.5, "max": 2.5}
      "explanation": "Markdown — full worked solution",
      "option_feedback": ["why A is wrong / right", "…", "…", "…"], // mcq/msq: one line per option
      "trap": "optional: the common mistake this question is designed to catch"
    }
  ]
}
```

- All text is GitHub Markdown. Use fenced code blocks (```` ```c ````) for code, GFM tables for matrices/process tables, `×`, `−`, `≤`, `→` Unicode for maths (no LaTeX — it isn't rendered). Bold key terms sparingly.
- **NAT**: answers are numbers. Exact integer → `{"min": 8, "max": 8}`. Non-integers → a GATE-style range, e.g. `{"min": 13.33, "max": 13.34}`; say in the stem what to round to ("correct to two decimal places") and make sure *every* reasonable rounding of the true value lands inside the range.
- **MSQ**: GATE rules — one or more correct, no partial credit. Avoid "all four correct" more than rarely.
- **MCQ**: exactly one correct option; distractors must be plausible and each map to a specific mistake (that's what `option_feedback` explains). Don't make "All/None of the above" the answer often. Spread the correct letter across A–D.

## Difficulty rubric (be strict — the adaptive engine depends on it)

**The authoritative rubric is `DIFFICULTY.md`** (measurable criteria + anchors). The table below is the summary. Expect your labels to be audited blind: authors consistently over-rate — a long or arithmetic-heavy question is not hard unless it has a real twist or needs non-standard reasoning.

| d | Meaning | Typical form | marks |
|---|---|---|---|
| 1 | Recall a definition / fact | "Which of the following is a PCB field?" | 1 |
| 2 | Understand / apply once, one step | identify state transition; 1-step formula | 1 |
| 3 | Standard GATE 1-mark: apply a method to a small instance | small Gantt chart, 3-process RAG, 1-level EMAT | 1 |
| 4 | GATE 2-mark: multi-step numerical or reasoning, one twist | Banker's with a request, SRTF with arrivals + context switch, 2-level paging sizes | 2 |
| 5 | Hardest GATE 2-mark: several interacting ideas, edge cases, tricky code traces | fork() in loops with conditions, semaphore code proving/finding violations, LRU vs Belady with tricky strings | 2 |

## Coverage (per topic file)

- **Every subtopic** in your topic gets **at least 8 questions** with **≥1 at d1 and d2 and ≥2 at d3, d4 and d5** (the validator enforces this). Heavily tested subtopics (numerical ones) get more: ~12–14. Total per topic: roughly 10 × number of subtopics.
- Type mix across the file: ~50% MCQ, ~20% MSQ, ~30% NAT. Numerical subtopics lean NAT; conceptual ones lean MCQ/MSQ. Don't force NAT where nothing is numeric.
- Cover the full GATE scope of each subtopic (standard textbook: Silberschatz/Galvin; Stallings for some details), including the classic GATE patterns and traps. Vary the instances — no two questions should be the same exercise with different numbers.
- Questions must be **original** (written by you), GATE-style. Do not claim a question is a past GATE question.

## Correctness (non-negotiable)

- **Solve every question yourself from scratch before writing the answer**, then re-check by a second method where possible (e.g. recompute the Gantt chart, recount fork processes by tree and by formula, recompute page-table sizes in bytes and in powers of two). For code traces, trace line by line.
- State every assumption the answer depends on in the stem (e.g. "ignore context-switch time", "1 KB = 1024 bytes", "tie broken by lower process id", "the disk head is moving towards larger cylinder numbers", "LRU with 3 frames initially empty").
- `explanation` must be a complete, step-by-step solution a student can learn from: show tables/Gantt charts (as GFM tables or code blocks), intermediate numbers, and why the answer follows. Keep it tight: no filler.
- If a standard convention is ambiguous across textbooks (e.g. C-SCAN return seek counted or not, "throughput" definitions), fix the convention in the stem.

## Process

1. Read `taxonomy.json` and plan your file: a table of subtopic × difficulty × type before writing.
2. Write questions subtopic by subtopic. Ids are sequential in file order.
3. Run the validator; fix every error. It also prints a coverage table — make sure each subtopic has ≥8 questions and all 5 difficulty levels.
4. Final pass: re-solve every d≥3 question once more, independently of your explanation. Fix anything that disagrees.
5. Reply with: question count, per-subtopic counts, type mix, and anything you were unsure about (keep it short).
