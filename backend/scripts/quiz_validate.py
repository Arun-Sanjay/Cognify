"""Validate Learn quiz question-bank files (dev tool — no app imports, stdlib only).

    python scripts/quiz_validate.py content/learn/cs/os/quiz/t06-deadlock.json [...]
    python scripts/quiz_validate.py content/learn/cs/os/quiz          # every topic file in the folder

Checks the schema described in docs/learn-authoring/cs-os/QUIZ.md and prints a
subtopic × difficulty coverage table. Exit code 1 if any file has errors.
"""
from __future__ import annotations

import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

TYPES = {"mcq", "msq", "nat"}
LETTERS = ["A", "B", "C", "D"]
MIN_PER_SUBTOPIC = 8
# Minimum questions per subtopic at each level (rubric: docs/learn-authoring/cs-os/DIFFICULTY.md).
MIN_PER_LEVEL = {1: 1, 2: 1, 3: 2, 4: 2, 5: 2}


def _load_taxonomy(folder: Path) -> dict:
    tax = json.loads((folder / "taxonomy.json").read_text())
    return {t["id"]: [s["id"] for s in t["subtopics"]] for t in tax["topics"]}


def validate(path: Path, taxonomy: dict[str, list[str]], seen_ids: set[str]) -> list[str]:
    errors: list[str] = []
    try:
        data = json.loads(path.read_text())
    except json.JSONDecodeError as exc:
        return [f"invalid JSON: {exc}"]
    topic = data.get("topic_id")
    if topic not in taxonomy:
        return [f"unknown topic_id {topic!r}"]
    all_subtopics = {s for subs in taxonomy.values() for s in subs}
    prefix = topic.split("-")[0]
    questions = data.get("questions") or []
    if not questions:
        return ["no questions"]

    coverage: dict[str, Counter] = defaultdict(Counter)
    types: Counter = Counter()
    for i, q in enumerate(questions):
        where = q.get("id") or f"#{i}"
        e = lambda msg: errors.append(f"{where}: {msg}")  # noqa: E731
        qid = q.get("id", "")
        if not re.fullmatch(rf"{prefix}-\d{{3}}", qid):
            e(f"id must look like {prefix}-001")
        if qid in seen_ids:
            e("duplicate id")
        seen_ids.add(qid)
        if q.get("subtopic") not in taxonomy[topic]:
            e(f"subtopic {q.get('subtopic')!r} not in {taxonomy[topic]}")
        for extra in q.get("also_tests") or []:
            if extra not in all_subtopics:
                e(f"also_tests {extra!r} is not a known subtopic")
        d = q.get("difficulty")
        if d not in (1, 2, 3, 4, 5):
            e("difficulty must be an int 1–5")
        if q.get("marks") not in (1, 2):
            e("marks must be 1 or 2")
        elif d in (1, 2, 3, 4, 5) and q["marks"] != (2 if d >= 4 else 1):
            e(f"marks must be {2 if d >= 4 else 1} for difficulty {d}")
        if not isinstance(q.get("est_seconds"), int) or not 15 <= q["est_seconds"] <= 900:
            e("est_seconds must be an int 15–900")
        concepts = q.get("concepts")
        if not isinstance(concepts, list) or not 1 <= len(concepts) <= 4:
            e("concepts must be a list of 1–4 strings")
        for field in ("stem", "explanation"):
            if not isinstance(q.get(field), str) or len(q[field].strip()) < 10:
                e(f"{field} missing/too short")
        t = q.get("type")
        types[t] += 1
        if t not in TYPES:
            e(f"type must be one of {sorted(TYPES)}")
            continue
        ans = q.get("answer")
        if t in ("mcq", "msq"):
            opts = q.get("options")
            if not isinstance(opts, list) or len(opts) != 4 or not all(isinstance(o, str) and o.strip() for o in opts):
                e("needs exactly 4 non-empty options")
            elif len({o.strip().lower() for o in opts}) != 4:
                e("duplicate options")
            elif any(re.match(r"^\(?[A-Da-d][).:]\s", o) for o in opts):
                e("options must not carry their own A)/B) labels")
            fb = q.get("option_feedback")
            if not isinstance(fb, list) or len(fb) != 4:
                e("option_feedback must have 4 entries")
            if t == "mcq" and ans not in LETTERS:
                e("mcq answer must be one letter A–D")
            if t == "msq":
                if not isinstance(ans, list) or not ans or any(a not in LETTERS for a in ans) or ans != sorted(set(ans)):
                    e('msq answer must be a sorted, de-duplicated list like ["A","C"]')
        else:
            if q.get("options"):
                e("nat must not have options")
            if not (isinstance(ans, dict) and set(ans) == {"min", "max"}
                    and all(isinstance(ans[k], (int, float)) and not isinstance(ans[k], bool) for k in ans)
                    and ans["min"] <= ans["max"]):
                e('nat answer must be {"min": number, "max": number} with min ≤ max')
        if isinstance(d, int):
            coverage[q.get("subtopic")][d] += 1

    print(f"\n{path.name}: {len(questions)} questions  types: "
          + ", ".join(f"{k}={v} ({v * 100 // len(questions)}%)" for k, v in sorted(types.items(), key=str)))
    print(f"  {'subtopic':32} total  d1 d2 d3 d4 d5")
    for sub in taxonomy[topic]:
        c = coverage.get(sub, Counter())
        total = sum(c.values())
        flag = ""
        if total < MIN_PER_SUBTOPIC:
            flag += f"  <-- fewer than {MIN_PER_SUBTOPIC}"
            errors.append(f"subtopic {sub}: only {total} questions")
        missing = [lvl for lvl in range(1, 6) if c[lvl] < MIN_PER_LEVEL[lvl]]
        if missing:
            flag += f"  <-- too few at d{missing}"
            errors.append(f"subtopic {sub}: too few questions at difficulty {missing} (need {MIN_PER_LEVEL})")
        print(f"  {sub:32} {total:5}  " + " ".join(f"{c[lvl]:2}" for lvl in range(1, 6)) + flag)
    return errors


def main(argv: list[str]) -> int:
    if not argv:
        print(__doc__)
        return 2
    paths: list[Path] = []
    for arg in argv:
        p = Path(arg)
        paths += sorted(x for x in p.glob("t[0-9]*.json")) if p.is_dir() else [p]
    taxonomy = _load_taxonomy(paths[0].parent)
    seen: set[str] = set()
    failed = False
    for path in paths:
        errors = validate(path, taxonomy, seen)
        if errors:
            failed = True
            print(f"  {len(errors)} error(s):")
            for err in errors[:60]:
                print("   -", err)
        else:
            print("  OK")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
