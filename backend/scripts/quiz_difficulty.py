"""Blind difficulty calibration for a Learn quiz bank file (dev tool — stdlib only).

    # 1. Print questions WITH answers/solutions but WITHOUT difficulty, marks or time:
    python scripts/quiz_difficulty.py blind content/learn/cs/os/quiz/t06-deadlock.json > /tmp/t06-rate.md
    # 2. The rater writes {"t06-001": {"rating": 2, "steps": 1, "concepts": 1, "secs": 45, "why": "..."}, ...}
    # 3. Compare the blind ratings with the file's labels:
    python scripts/quiz_difficulty.py compare content/learn/cs/os/quiz/t06-deadlock.json /tmp/t06-ratings.json

Rubric: docs/learn-authoring/cs-os/DIFFICULTY.md.
"""
from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path

LETTERS = "ABCD"


def _answer(q: dict) -> str:
    a = q["answer"]
    if q["type"] == "nat":
        return f"{a['min']:g}" if a["min"] == a["max"] else f"{a['min']:g} to {a['max']:g}"
    return ", ".join(a) if isinstance(a, list) else str(a)


def blind(path: Path) -> None:
    for q in json.loads(path.read_text())["questions"]:
        print(f"## {q['id']} — {q['type'].upper()}, subtopic {q['subtopic']}\n")
        print(q["stem"].strip(), "\n")
        for i, opt in enumerate(q.get("options") or []):
            print(f"{LETTERS[i]}. {opt}")
        print(f"\n**Answer:** {_answer(q)}\n\n**Solution:**\n{q['explanation'].strip()}\n")
        if q.get("trap"):
            print(f"**Trap:** {q['trap']}\n")
        print("---\n")


def compare(path: Path, ratings_path: Path) -> None:
    qs = json.loads(path.read_text())["questions"]
    ratings = json.loads(ratings_path.read_text())
    matrix: Counter = Counter()
    off = []
    for q in qs:
        r = ratings.get(q["id"])
        if r is None:
            print(f"{q['id']}: NOT RATED")
            continue
        rating = r["rating"] if isinstance(r, dict) else r
        matrix[(q["difficulty"], rating)] += 1
        if rating != q["difficulty"]:
            off.append((abs(rating - q["difficulty"]), q, rating, r))
    print("label → blind rating (rows = label 1..5, cols = rating 1..5)")
    for d in range(1, 6):
        print(f"  {d}: " + " ".join(f"{matrix[(d, x)]:3}" for x in range(1, 6)))
    exact = sum(v for (a, b), v in matrix.items() if a == b)
    total = sum(matrix.values())
    print(f"\nexact {exact}/{total}, off by 1: {sum(1 for o in off if o[0] == 1)}, off by ≥2: {sum(1 for o in off if o[0] >= 2)}\n")
    for gap, q, rating, r in sorted(off, key=lambda o: (-o[0], o[1]["id"])):
        why = r.get("why", "") if isinstance(r, dict) else ""
        print(f"{q['id']} {q['subtopic']}: label {q['difficulty']} → rated {rating}  {why}")


if __name__ == "__main__":
    if len(sys.argv) >= 3 and sys.argv[1] == "blind":
        blind(Path(sys.argv[2]))
    elif len(sys.argv) >= 4 and sys.argv[1] == "compare":
        compare(Path(sys.argv[2]), Path(sys.argv[3]))
    else:
        print(__doc__)
        sys.exit(2)
