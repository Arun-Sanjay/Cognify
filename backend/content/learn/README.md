# Learn content

Curated, NPTEL-style video courses. Served read-only by `app/services/learn.py`
(`/api/v1/learn/*`); key frames are served from `media/` at `/learn-media`.

```
content/learn/
├── catalog.json                          # subjects → units (only `available: true` units are browsable)
├── <subject>/<unit>/unit.json            # topics ("weeks") → ordered lecture ids
├── <subject>/<unit>/lectures/<id>.json   # one lecture (id = YouTube video id)
└── media/<youtube_id>/<frame>.jpg        # key frames referenced by notes slides
```

## unit.json

```json
{
  "name": "Operating System",
  "description": "…",
  "syllabus": "official GATE syllabus text for the unit",
  "topics": [
    {
      "id": "t06-deadlock",
      "number": 6,
      "title": "Deadlock",
      "summary": "one or two sentences",
      "syllabus_points": ["Necessary conditions", "Banker's algorithm", "…"],
      "lectures": ["<youtube_id>", "<youtube_id>"]
    }
  ]
}
```

## lectures/<id>.json

```json
{
  "id": "rWFH6PLOIEI",
  "youtube_id": "rWFH6PLOIEI",
  "title": "L-4.1: Deadlock concept …",
  "channel": "Gate Smashers",
  "channel_url": "https://www.youtube.com/@GateSmashers",
  "language": "hinglish",            // "hinglish" | "english"
  "duration_sec": 741,
  "views": 2723123, "likes": 46500, "comments": 873,
  "upload_date": "20190127",
  "why": "Why this video was picked (numbers + comment sentiment).",
  "comment_highlights": ["real comment", "…"],
  "transcript": {
    "source": "manual-en",             // manual-en | auto-en | auto-hi→en | …
    "language": "en",
    "segments": [ { "start": 0.0, "dur": 4.2, "text": "…" } ]
  },
  "notes": { …notes deck, below… }
}
```

## Notes deck

```json
{
  "headline": "One-line hook for the lecture",
  "summary": "2–3 sentence overview.",
  "read_minutes": 6,
  "key_takeaways": ["…", "…"],
  "gate_focus": ["What GATE actually asks from this lecture", "…"],
  "slides": [
    {
      "id": "s1",
      "title": "Slide title",
      "timestamp": 95,                   // seconds into the video (jump-to), optional
      "image": "f_0012.jpg",             // key frame in media/<youtube_id>/, optional
      "image_caption": "What the frame shows",
      "blocks": [ …blocks… ]
    }
  ],
  "practice": [
    {
      "type": "mcq",                    // mcq | msq | nat | short
      "question": "Markdown",
      "options": ["…", "…", "…", "…"],   // mcq/msq only
      "answer": "Markdown (e.g. 'B' or '12')",
      "explanation": "Markdown"
    }
  ]
}
```

All text fields are Markdown (GFM). Block types:

| type | fields |
|---|---|
| `text` | `md` |
| `bullets` | `items: string[]` |
| `steps` | `title?`, `items: string[]` (rendered as a numbered procedure) |
| `definition` | `term`, `md` |
| `formula` | `label?`, `expr` (plain text/Unicode, e.g. `EAT = h·(c+m) + (1−h)·(c+2m)`), `note?` |
| `table` | `headers: string[]`, `rows: string[][]`, `caption?` |
| `compare` | `left: {title, items[]}`, `right: {title, items[]}` |
| `example` | `title?`, `question`, `solution` |
| `callout` | `tone: tip \| gate \| warning \| insight`, `title?`, `md` |
| `diagram` | `mermaid` (Mermaid source), `caption?` |
| `code` | `language`, `code` |

## quiz/ (practice question bank)

```
<subject>/<unit>/quiz/
├── taxonomy.json        # {"topics": [{"id", "title", "subtopics": [{"id", "name"}]}]}
└── <topic_id>.json      # {"topic_id", "questions": [...]}
```

Question format, difficulty rubric and authoring rules: `docs/learn-authoring/cs-os/QUIZ.md`.
Validate with `python3 scripts/quiz_validate.py content/learn/<s>/<u>/quiz`; blind-check with
`scripts/quiz_verify.py`. Question ids are permanent — student history and learned
difficulty are keyed on them.
