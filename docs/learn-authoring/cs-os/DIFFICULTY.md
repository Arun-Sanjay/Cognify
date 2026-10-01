# Difficulty calibration rubric — Cognify quiz bank (GATE CS)

Difficulty drives the adaptive engine (author level → initial Elo difficulty −2, −1, 0, +1, +2), so a
level must mean the **same thing in every topic**. Rate the *thinking* a question demands from a
student who has studied the topic properly (watched the lectures, knows the standard methods) —
not reading length, not how obscure the wording is.

## Measure these first (for every question)

| Feature | How to count |
|---|---|
| **steps** | Distinct reasoning/computation steps in the shortest correct solution (one table row filled = 1 step only if it needs a decision; mechanical repetition of the same step counts once + "volume") |
| **concepts** | Distinct ideas that must be combined (e.g. SRTF + context-switch overhead + idle CPU = 3) |
| **trap** | Is there a natural wrong path most students would take? (none / mild / strong) |
| **non-standard** | Does it need reasoning beyond applying a textbook procedure (case analysis, proving a property, working backwards, finding a min/max over choices)? |
| **solve time** | Realistic time for a prepared student, done carefully |

## Levels

| Level | Steps | Concepts | Trap | Non-standard | Time | What it feels like |
|---|---|---|---|---|---|---|
| **1 · Recall** | 1 | 1 | none | no | ≤ 40 s | You either know the fact/definition or you don't |
| **2 · Easy** | 1–2 | 1 | none/mild | no | 40–90 s | Apply one formula or rule once; direct question |
| **3 · Medium (GATE 1-mark)** | 3–5 | 1–2 | mild | no | 1.5–3 min | Run a standard procedure on a small instance |
| **4 · Hard (GATE 2-mark)** | 5–10 | 2–3 | strong *or* a twist | sometimes | 3–5 min | Standard procedure + a twist that changes the method or result |
| **5 · GATE+** (hardest ~10% of GATE 2-markers) | many / exhaustive | 3+ interacting | strong | **yes** | 5–8 min | A well-prepared student is more likely wrong than right on first try |

Rules of thumb:
- **Long ≠ hard.** A 10-row Gantt chart that is pure mechanical FCFS is a 3, not a 5. Volume alone can add at most one level.
- **A twist** = something that breaks the template: an arrival during a context switch, a request that makes the state unsafe, a reference string that triggers Belady, a semaphore initialised to 0, a page table that doesn't fit in one page, a C-SCAN return seek that counts, `fork()` inside `&&`/`||`.
- **MSQ** is ~half a level harder than the same content as MCQ (all options must be judged, no elimination). Four independent true/false judgements of *recall* facts is still only a 2.
- **A 1 must not need calculation.** A 5 must not be solvable by plugging into one formula.

## Anchors (OS)

| Level | Examples |
|---|---|
| 1 | Which field is not in the PCB? · Which condition does resource ordering break? · What does the TLB cache? |
| 2 | Offset bits for a 4 KB page · Number of child processes from `fork(); fork(); fork();` · Rotational latency at 7200 RPM |
| 3 | FCFS average waiting time for 4 processes with arrivals · LRU page faults, 12 refs, 3 frames · SSTF total head movement, 8 requests · Banker's: is this state safe (3 processes) |
| 4 | SRTF with arrivals + context-switch cost, find avg TAT · Banker's with an incoming request, safe or not · 2-level paging: size of outer table · EMAT with TLB + page-fault service + dirty pages · minimum resources so n processes needing kᵢ each never deadlock |
| 5 | `fork()` in a loop with `if (fork() && fork())` counting printf · min/max final value of a shared variable over all interleavings of 3 threads · find the largest x for which a Banker's state is safe · find a reference string length/frame count where Belady's anomaly appears · prove which of 4 semaphore solutions violate mutual exclusion or progress |

## When the label is wrong

Decide per question (prefer the first option that fits):
1. **Labelled hard (4–5) but really easier** → **rewrite it to be genuinely hard**: add a real twist, combine a second concept, ask for a less direct quantity (work backwards, find the min/max, count across all cases). Keep the subtopic and id.
2. **Labelled easy (1–2) but really harder** → **simplify it** to the label (strip the twist, smaller instance, ask directly) — unless the subtopic is short of hard questions, then relabel it up instead.
3. **Off by one in the middle (2↔3, 3↔4)** and the question is good as is → **relabel**.

Whenever difficulty changes, also set `marks` (1 for d1–3, 2 for d4–5) and `est_seconds` to match the table, and keep `explanation`, `option_feedback`, `trap` consistent with any rewrite.

## Coverage after calibration

Every subtopic: ≥ 1 question at d1, d2 and d3 and **≥ 2 at d4 and ≥ 2 at d5**. Add new questions (next free id at the end of the file — never renumber) where needed; new and rewritten questions follow `QUIZ.md` and must be solved and checked by simulation where possible.
