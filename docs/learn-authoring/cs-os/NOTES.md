# Notes-deck authoring brief — Cognify Learn (GATE CS → Operating System)

You are writing the **AI study notes deck** for YouTube lectures. Students watch the video above the notes; the notes must let them revise the lecture in a few minutes and be beautiful, accurate, and GATE-focused. You author the notes yourself (no API calls).

Paths:
- Work dir per video: `<scratchpad>/yt/work/<id>/` → `transcript.txt` ("[mm:ss] text", ~20 s lines), `base.json` (meta), `frames/f_NNNN.jpg` (960 px, one every N s), `frames.json` (file → seconds), `sheets/sheet_NN.jpg` (4×4 contact sheets with frame number + mm:ss labels).
- Output notes JSON: `<scratchpad>/yt/notes/<id>.json`
- Selected frames: copy to `/Users/arunsanjay/Documents/Projects/Cognify/cognify/backend/content/learn/media/<id>/` (keep the original file name, e.g. `f_0042.jpg`).
- Schema: `/Users/arunsanjay/Documents/Projects/Cognify/cognify/backend/content/learn/README.md` → section "Notes deck" + block types. Follow it exactly (valid JSON, only the listed block types/fields).

## Reference example
Read `<scratchpad>/yt/notes/rWFH6PLOIEI.json` first: it's a finished deck for a 12-minute lecture and shows the expected depth, tone, block mix, a correction `warning` callout, and practice questions. Match or beat it.

## Process (per video)
1. Read the WHOLE `transcript.txt` (Hinglish lectures come as English subtitles/translation — interpret meaning, not literal phrasing).
2. Look at EVERY contact sheet to see what is on the board/slides over time.
3. Pick 3–8 key frames that genuinely help (a finished diagram, a worked table, the final board state for a section). Prefer frames where the teacher does NOT block the content — usually the last frames of a section. Open the full frame (`frames/f_NNNN.jpg`) to confirm it's legible before using it. Never use a frame that's mostly the teacher's back or a title card.
4. Write the deck.

## Deck content rules
- **Accuracy first.** Everything must match the lecture AND be correct GATE-level CS. If the lecturer makes a mistake or uses a non-standard definition, keep the lecture's point but add a `callout` with `tone: "warning"` giving the correct/standard version.
- **Coverage:** every concept, definition, algorithm, example and numerical the lecture covers, in lecture order. Aim for 1 slide per ~2–3 min of video (min 4, max 16 slides).
- **timestamp** on every slide = the second where that part starts (from transcript.txt).
- **Make it visual and scannable:** mix block types. Use `definition` for definitions, `table`/`compare` for comparisons, `steps` for algorithms/procedures, `formula` for formulas (plain Unicode like `TAT = CT − AT`, `EAT = h·(c+m) + (1−h)·(c+2m)`), `example` for worked problems with a full step-by-step `solution`, `callout` (`tip`/`gate`/`warning`/`insight`) for exam hints and traps, `diagram` (Mermaid) where a picture helps (state diagrams, RAGs, flows, Gantt-like sequences). Keep bullets short (≤ 20 words). Use **bold** for key terms.
- **Mermaid:** prefer `flowchart TD` (vertical renders larger in the notes column than a long LR chain); keep edge labels to 1–2 words. Use only `flowchart LR`/`flowchart TD` (or `graph`), `stateDiagram-v2`, `sequenceDiagram`. Quote any label with spaces or symbols: `A["Ready queue"] --> B["CPU"]`. No HTML, no `classDef`, no emojis. Keep ≤ 15 nodes.
- **headline:** one catchy line. **summary:** 2–3 sentences. **read_minutes:** honest estimate. **key_takeaways:** 4–7. **gate_focus:** 2–5 concrete notes on what GATE asks about this (question types, typical traps, PYQ patterns).
- **practice:** 3–5 original GATE-style questions (mix mcq/msq/nat) with correct `answer` and a short `explanation`. Double-check every answer by working it out.
- Language: clear English. No filler ("In this video…"). Don't mention the teacher's personal anecdotes unless they're the example used to teach the concept (then keep them brief — e.g. the bank-account deadlock example is a good memorable hook).
- `slide.id`: `s1`, `s2`, …; `image`: bare file name (e.g. `f_0042.jpg`) and it MUST exist in the media folder you copied to; `image_caption`: what the frame shows.

## Validate before finishing
Run: `python3 -c "import json,sys; d=json.load(open(sys.argv[1])); assert d['slides']; print(len(d['slides']),'slides')" <scratchpad>/yt/notes/<id>.json` and check each referenced image exists in the media folder.
