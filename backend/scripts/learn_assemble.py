"""Assemble Learn content from a unit spec + fetched material + authored notes (dev tool).

    python scripts/learn_assemble.py --spec unit_spec.json --work /tmp/learn-work --notes /tmp/learn-notes

unit_spec.json:
    {
      "subject": "cs", "unit": "os",
      "name": "Operating System", "description": "…", "syllabus": "…",
      "topics": [
        {"id": "t06-deadlock", "number": 6, "title": "Deadlock", "summary": "…",
         "syllabus_points": ["…"],
         "lectures": [{"id": "<youtube id>", "language": "hinglish", "why": "…",
                       "comment_highlights": ["…"]}]}
      ]
    }

Reads <work>/<id>/base.json (from learn_fetch.py) and, if present, <notes>/<id>.json.
Writes content/learn/<subject>/<unit>/unit.json and lectures/<id>.json. Lectures
whose base.json is missing are skipped (and reported).
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

CONTENT = Path(__file__).resolve().parents[1] / "content" / "learn"
MEDIA = CONTENT / "media"


def _check_notes(video_id: str, notes: dict) -> list[str]:
    problems = []
    if not notes.get("slides"):
        problems.append("no slides")
    for slide in notes.get("slides", []):
        image = slide.get("image")
        if image and not (MEDIA / video_id / image).exists():
            problems.append(f"missing frame {image}")
    return problems


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--spec", required=True, type=Path)
    parser.add_argument("--work", required=True, type=Path)
    parser.add_argument("--notes", required=True, type=Path)
    args = parser.parse_args()

    spec = json.loads(args.spec.read_text())
    unit_dir = CONTENT / spec["subject"] / spec["unit"]
    (unit_dir / "lectures").mkdir(parents=True, exist_ok=True)

    topics, skipped, warnings = [], [], []
    for topic in spec["topics"]:
        ids = []
        for lecture in topic["lectures"]:
            vid = lecture["id"]
            base_path = args.work / vid / "base.json"
            if not base_path.exists():
                skipped.append(vid)
                continue
            data = json.loads(base_path.read_text())
            data.update(
                language=lecture["language"],
                why=lecture.get("why", ""),
                comment_highlights=lecture.get("comment_highlights", []),
            )
            notes_path = args.notes / f"{vid}.json"
            if notes_path.exists():
                data["notes"] = json.loads(notes_path.read_text())
                warnings += [f"{vid}: {p}" for p in _check_notes(vid, data["notes"])]
            else:
                warnings.append(f"{vid}: no notes yet")
            (unit_dir / "lectures" / f"{vid}.json").write_text(json.dumps(data, ensure_ascii=False, indent=1))
            ids.append(vid)
        topics.append({k: v for k, v in topic.items() if k != "lectures"} | {"lectures": ids})

    unit = {"name": spec["name"], "description": spec.get("description", ""), "syllabus": spec.get("syllabus", ""), "topics": topics}
    (unit_dir / "unit.json").write_text(json.dumps(unit, ensure_ascii=False, indent=2))

    total = sum(len(t["lectures"]) for t in topics)
    print(f"wrote {unit_dir}/unit.json — {len(topics)} topics, {total} lectures")
    for w in warnings:
        print(f"  warn: {w}")
    if skipped:
        print(f"  skipped (no base.json): {' '.join(skipped)}", file=sys.stderr)


if __name__ == "__main__":
    main()
