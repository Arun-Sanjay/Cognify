"""Blind re-solve check for a Learn quiz bank file (dev tool — stdlib only).

    # 1. Print the questions WITHOUT answers/explanations, for an independent solver:
    python scripts/quiz_verify.py blind content/learn/cs/os/quiz/t06-deadlock.json > /tmp/t06-blind.md
    # 2. The solver writes {"t06-001": "B", "t06-002": ["A","C"], "t06-003": 12.5, ...}
    # 3. Compare against the bank's keys:
    python scripts/quiz_verify.py compare content/learn/cs/os/quiz/t06-deadlock.json /tmp/t06-answers.json

Add `--ids t06-004,t06-058` to either command to check only those questions.

`compare` prints every disagreement (and any question the solver skipped) and exits 1 if there are any.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

LETTERS = "ABCD"


def _select(questions: list[dict], ids: set[str] | None) -> list[dict]:
    return [q for q in questions if ids is None or q["id"] in ids]


def blind(path: Path, ids: set[str] | None = None) -> None:
    data = json.loads(path.read_text())
    for q in _select(data["questions"], ids):
        print(f"## {q['id']} — {q['type'].upper()}, difficulty {q['difficulty']}, subtopic {q['subtopic']}\n")
        print(q["stem"].strip(), "\n")
        for i, opt in enumerate(q.get("options") or []):
            print(f"{LETTERS[i]}. {opt}")
        if q["type"] == "msq":
            print("\n(one or more options are correct)")
        if q["type"] == "nat":
            print("(numerical answer)")
        print("\n---\n")


def _matches(q: dict, given) -> bool:
    if q["type"] == "mcq":
        return isinstance(given, str) and given.strip().upper() == q["answer"]
    if q["type"] == "msq":
        return isinstance(given, list) and sorted({str(g).upper() for g in given}) == q["answer"]
    try:
        value = float(given)
    except (TypeError, ValueError):
        return False
    return q["answer"]["min"] - 1e-9 <= value <= q["answer"]["max"] + 1e-9


def compare(path: Path, answers_path: Path, ids: set[str] | None = None) -> int:
    questions = _select(json.loads(path.read_text())["questions"], ids)
    given = json.loads(answers_path.read_text())
    bad = 0
    for q in questions:
        if q["id"] not in given:
            print(f"{q['id']}: NOT SOLVED")
            bad += 1
        elif not _matches(q, given[q["id"]]):
            print(f"{q['id']} (d{q['difficulty']} {q['type']}): bank={json.dumps(q['answer'])} solver={json.dumps(given[q['id']])}")
            bad += 1
    print(f"\n{len(questions) - bad}/{len(questions)} agree")
    return 1 if bad else 0


if __name__ == "__main__":
    args = sys.argv[1:]
    only = None
    if "--ids" in args:
        i = args.index("--ids")
        only = {x.strip() for x in args[i + 1].split(",") if x.strip()}
        args = args[:i] + args[i + 2:]
    if len(args) >= 2 and args[0] == "blind":
        blind(Path(args[1]), only)
    elif len(args) >= 3 and args[0] == "compare":
        sys.exit(compare(Path(args[1]), Path(args[2]), only))
    else:
        print(__doc__)
        sys.exit(2)
