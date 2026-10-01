"""Learn — curated YouTube lecture courses (NPTEL-style) read from JSON content.

Content is authored offline and lives on disk, not in the database:

    content/learn/
    ├── catalog.json                         # subjects → units (+ availability)
    ├── <subject>/<unit>/unit.json           # topics ("weeks") → ordered lecture ids
    ├── <subject>/<unit>/lectures/<id>.json  # video meta + transcript + notes deck
    └── media/<youtube_id>/<frame>.jpg       # key frames, served at /learn-media

Files are parsed once and cached by mtime, so edited content shows up without a
restart. The lecture tutor (`stream_lecture_answer`) grounds Claude in the
lecture's notes and transcript.
"""
from __future__ import annotations

import json
import re
import threading
from collections.abc import Iterator
from pathlib import Path
from typing import Any

from fastapi import HTTPException, status

from app.core.config import get_settings
from app.services import claude_client

MEDIA_URL_PREFIX = "/learn-media"

# Lecture/unit/subject ids are used to build file paths — keep them boring.
_SAFE_ID = re.compile(r"^[A-Za-z0-9_-]{1,64}$")

# Transcript budget for the tutor prompt (~15k tokens). Long lectures get
# trimmed from the end; the notes deck (always included) covers the whole video.
_MAX_TRANSCRIPT_CHARS = 60_000
_MAX_HISTORY_MESSAGES = 12

_cache: dict[Path, tuple[float, Any]] = {}
_cache_lock = threading.Lock()


def content_dir() -> Path:
    configured = get_settings().learn_content_dir
    if configured:
        return Path(configured)
    return Path(__file__).resolve().parents[2] / "content" / "learn"


def media_dir() -> Path:
    return content_dir() / "media"


def _not_found(what: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{what} not found")


def _check_id(value: str, what: str) -> str:
    if not _SAFE_ID.match(value):
        raise _not_found(what)
    return value


def _load_json(path: Path) -> Any:
    try:
        mtime = path.stat().st_mtime
    except FileNotFoundError:
        return None
    with _cache_lock:
        hit = _cache.get(path)
        if hit and hit[0] == mtime:
            return hit[1]
    data = json.loads(path.read_text(encoding="utf-8"))
    with _cache_lock:
        _cache[path] = (mtime, data)
    return data


def clear_cache() -> None:
    with _cache_lock:
        _cache.clear()


# ── Catalog / units / lectures ─────────────────────────────────


def get_catalog() -> dict:
    catalog = _load_json(content_dir() / "catalog.json")
    return catalog or {"subjects": []}


def catalog_with_counts() -> list[dict]:
    """Catalog subjects with topic/lecture counts filled in for available units."""
    subjects = []
    for subject in get_catalog().get("subjects", []):
        units = []
        for unit in subject.get("units", []):
            topic_count = lecture_count = 0
            if unit.get("available"):
                content = _load_json(content_dir() / subject["id"] / unit["id"] / "unit.json") or {}
                topics = content.get("topics", [])
                topic_count = len(topics)
                lecture_count = sum(len(t.get("lectures", [])) for t in topics)
            units.append({
                **unit,
                "topic_count": topic_count,
                "lecture_count": lecture_count,
                "has_quiz": bool(unit.get("available")) and has_quiz(subject["id"], unit["id"]),
            })
        subjects.append({**subject, "units": units})
    return subjects


def has_quiz(subject_id: str, unit_id: str) -> bool:
    """Whether the unit has a practice question bank (content/learn/<s>/<u>/quiz/)."""
    return (content_dir() / subject_id / unit_id / "quiz" / "taxonomy.json").is_file()


def _find_subject(subject_id: str) -> dict:
    for subject in get_catalog().get("subjects", []):
        if subject.get("id") == subject_id:
            return subject
    raise _not_found("Subject")


def _load_lecture_raw(subject_id: str, unit_id: str, lecture_id: str) -> dict | None:
    return _load_json(content_dir() / subject_id / unit_id / "lectures" / f"{lecture_id}.json")


def lecture_summary(lecture: dict) -> dict:
    """The lightweight view used in course outlines (no transcript/notes)."""
    notes = lecture.get("notes") or {}
    return {
        "id": lecture["id"],
        "youtube_id": lecture["youtube_id"],
        "title": lecture["title"],
        "channel": lecture.get("channel", ""),
        "language": lecture.get("language", "english"),
        "duration_sec": lecture.get("duration_sec", 0),
        "views": lecture.get("views"),
        "headline": notes.get("headline"),
        "has_notes": bool(notes.get("slides")),
    }


def get_unit(subject_id: str, unit_id: str) -> dict:
    """Unit with its topics and each topic's lecture summaries."""
    _check_id(subject_id, "Subject")
    _check_id(unit_id, "Unit")
    subject = _find_subject(subject_id)
    unit_meta = next((u for u in subject.get("units", []) if u.get("id") == unit_id), None)
    if unit_meta is None:
        raise _not_found("Unit")
    unit = _load_json(content_dir() / subject_id / unit_id / "unit.json")
    if unit is None:
        raise _not_found("Unit content")

    topics = []
    for topic in unit.get("topics", []):
        lectures = []
        for lecture_id in topic.get("lectures", []):
            raw = _load_lecture_raw(subject_id, unit_id, lecture_id)
            if raw is not None:
                lectures.append(lecture_summary(raw))
        topics.append({**{k: v for k, v in topic.items() if k != "lectures"}, "lectures": lectures})

    return {
        "subject": {"id": subject["id"], "code": subject.get("code", ""), "name": subject["name"]},
        "id": unit_id,
        "name": unit.get("name", unit_meta.get("name", unit_id)),
        "description": unit.get("description", ""),
        "syllabus": unit.get("syllabus", unit_meta.get("syllabus", "")),
        "has_quiz": has_quiz(subject_id, unit_id),
        "topics": topics,
    }


def _locate_lecture(lecture_id: str) -> tuple[dict, dict, dict, dict]:
    """Find a lecture by id across all available units → (subject, unit, topic, lecture)."""
    _check_id(lecture_id, "Lecture")
    for subject in get_catalog().get("subjects", []):
        for unit_meta in subject.get("units", []):
            if not unit_meta.get("available"):
                continue
            unit = _load_json(content_dir() / subject["id"] / unit_meta["id"] / "unit.json")
            if not unit:
                continue
            for topic in unit.get("topics", []):
                if lecture_id in topic.get("lectures", []):
                    raw = _load_lecture_raw(subject["id"], unit_meta["id"], lecture_id)
                    if raw is None:
                        break
                    return subject, unit_meta, topic, raw
    raise _not_found("Lecture")


def _with_media_urls(notes: dict | None, youtube_id: str) -> dict | None:
    """Rewrite bare frame filenames in the notes deck to servable URLs."""
    if not notes:
        return notes
    slides = []
    for slide in notes.get("slides", []):
        image = slide.get("image")
        if image and not image.startswith(("http://", "https://", "/")):
            slide = {**slide, "image": f"{MEDIA_URL_PREFIX}/{youtube_id}/{image}"}
        slides.append(slide)
    return {**notes, "slides": slides}


def get_lecture(lecture_id: str) -> dict:
    subject, unit_meta, topic, raw = _locate_lecture(lecture_id)
    return {
        **raw,
        "subject_id": subject["id"],
        "unit_id": unit_meta["id"],
        "topic_id": topic["id"],
        "topic_title": topic.get("title", ""),
        "notes": _with_media_urls(raw.get("notes"), raw["youtube_id"]),
    }


# ── AI tutor ───────────────────────────────────────────────────

_TUTOR_SYSTEM = """You are Cognify's lecture tutor for GATE exam preparation.
The student is studying this lecture:

Subject: {subject} → {unit} → {topic}
Lecture: "{title}" by {channel} ({language})

You have the lecture's study-notes deck and its transcript below. Ground your
answers in them: when the lecture covers something, explain it the way the
lecture does and cite the moment as [mm:ss] so the student can jump there.
If the question goes beyond the lecture, answer from solid GATE-level knowledge
and say that the lecture doesn't cover it. Never invent what the lecturer said.

Style:
- Concise, exam-focused, friendly. Use Markdown: short headings, bullets, tables.
- Numericals: show every step; state the final answer clearly.
- For any diagram, emit a ```mermaid fenced block (flowchart/graph syntax).
  Never draw ASCII-art diagrams.
- For practice questions, use ```solved fences for worked examples and
  ```unsolved fences for questions left to the student.
{focus}
=== NOTES DECK (JSON) ===
{notes}

=== TRANSCRIPT ([mm:ss] text) ===
{transcript}
"""


def _fmt_ts(seconds: float) -> str:
    seconds = int(seconds)
    return f"{seconds // 60:02d}:{seconds % 60:02d}"


def _transcript_text(lecture: dict) -> str:
    segments = (lecture.get("transcript") or {}).get("segments", [])
    lines = [f"[{_fmt_ts(s.get('start', 0))}] {s.get('text', '')}" for s in segments]
    text = "\n".join(lines)
    if len(text) > _MAX_TRANSCRIPT_CHARS:
        text = text[:_MAX_TRANSCRIPT_CHARS] + "\n[… transcript truncated …]"
    return text


def build_tutor_system_prompt(lecture: dict, slide_id: str | None = None) -> str:
    notes = lecture.get("notes") or {}
    focus = ""
    if slide_id:
        slide = next((s for s in notes.get("slides", []) if s.get("id") == slide_id), None)
        if slide:
            focus = (
                f"\nThe student is currently looking at the notes slide "
                f"\"{slide.get('title', '')}\" (id {slide_id}). Prioritise it.\n"
            )
    return _TUTOR_SYSTEM.format(
        subject=lecture.get("subject_id", ""),
        unit=lecture.get("unit_id", ""),
        topic=lecture.get("topic_title", ""),
        title=lecture.get("title", ""),
        channel=lecture.get("channel", ""),
        language=lecture.get("language", ""),
        focus=focus,
        notes=json.dumps(notes, ensure_ascii=False, separators=(",", ":")),
        transcript=_transcript_text(lecture),
    )


def stream_lecture_answer(
    lecture_id: str, messages: list[dict], slide_id: str | None = None
) -> Iterator[str]:
    """Stream the tutor's reply. `messages` is the client-held conversation
    ({role, content}, ending with the user's question); nothing is persisted."""
    lecture = get_lecture(lecture_id)
    history = [
        {"role": m["role"], "content": m["content"]}
        for m in messages[-_MAX_HISTORY_MESSAGES:]
        if m.get("role") in ("user", "assistant") and m.get("content")
    ]
    # Claude requires the conversation to start with a user turn.
    while history and history[0]["role"] != "user":
        history.pop(0)
    if not history or history[-1]["role"] != "user":
        raise HTTPException(status_code=400, detail="The last message must be the student's question")
    system = build_tutor_system_prompt(lecture, slide_id)
    yield from claude_client.stream_completion(system, history, max_tokens=1500)
