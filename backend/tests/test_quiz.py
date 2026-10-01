"""Tests for Learn quizzes: bank overview, practice/exam/adaptive attempts, grading,
the Elo learner model, and AI help. Content is a small temp bank; Claude is mocked.
"""
from __future__ import annotations

import json
import random
from collections.abc import Iterator
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

from app.services import adaptive, claude_client
from app.services import learn as learn_service
from app.services import quiz as quiz_service

BASE = "/api/v1/learn/quiz"


def _q(qid: str, subtopic: str, difficulty: int, qtype: str = "mcq", answer=None, marks: int = 1) -> dict:
    q = {
        "id": qid,
        "subtopic": subtopic,
        "difficulty": difficulty,
        "type": qtype,
        "marks": marks,
        "est_seconds": 60,
        "concepts": ["c"],
        "stem": f"Question {qid}?",
        "explanation": f"Because {qid}.",
    }
    if qtype in ("mcq", "msq"):
        q["options"] = ["w", "x", "y", "z"]
        q["option_feedback"] = ["a", "b", "c", "d"]
        q["answer"] = answer or ("B" if qtype == "mcq" else ["A", "C"])
    else:
        q["answer"] = answer or {"min": 13.33, "max": 13.34}
    return q


@pytest.fixture()
def bank(tmp_path, monkeypatch) -> Path:
    folder = tmp_path / "cs" / "os" / "quiz"
    folder.mkdir(parents=True)
    (folder / "taxonomy.json").write_text(json.dumps({
        "subject": "cs", "unit": "os",
        "topics": [{"id": "t06-deadlock", "title": "Deadlock", "subtopics": [
            {"id": "bankers-algorithm", "name": "Banker's algorithm"},
            {"id": "prevention", "name": "Prevention"},
        ]}],
    }))
    questions = []
    n = 0
    for sub in ("bankers-algorithm", "prevention"):
        for d in range(1, 6):
            for qtype in ("mcq", "msq", "nat"):
                n += 1
                questions.append(_q(f"t06-{n:03d}", sub, d, qtype, marks=2 if d >= 4 else 1))
    (folder / "t06-deadlock.json").write_text(json.dumps({"topic_id": "t06-deadlock", "questions": questions}))
    monkeypatch.setattr(learn_service, "content_dir", lambda: tmp_path)
    learn_service.clear_cache()
    return tmp_path


@pytest.fixture()
def headers(client, signup_payload) -> dict:
    r = client.post("/api/v1/auth/signup", json=signup_payload("student"))
    assert r.status_code in (200, 201), r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def _start(client, headers, **body) -> dict:
    payload = {"mode": "practice", "subtopics": ["bankers-algorithm", "prevention"], "count": 10, **body}
    r = client.post(f"{BASE}/units/cs/os/attempts", json=payload, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


def _correct_response(q: dict):
    full = quiz_service.load_bank("cs", "os")["questions"][q["id"]]
    return full["answer"] if full["type"] != "nat" else full["answer"]["min"]


# ── Grading ────────────────────────────────────────────────────


def test_grade_gate_rules():
    mcq1, mcq2 = _q("a", "s", 3), _q("b", "s", 4, marks=2)
    assert quiz_service.grade(mcq1, "B") == (True, 1.0)
    assert quiz_service.grade(mcq1, "A") == (False, pytest.approx(-0.3333, abs=1e-4))
    assert quiz_service.grade(mcq2, "C") == (False, pytest.approx(-0.6667, abs=1e-4))
    assert quiz_service.grade(mcq1, None) == (False, 0.0)
    msq = _q("c", "s", 3, "msq")
    assert quiz_service.grade(msq, ["C", "A"]) == (True, 1.0)
    assert quiz_service.grade(msq, ["A"]) == (False, 0.0)  # no partial credit, no negative
    nat = _q("d", "s", 3, "nat")
    assert quiz_service.grade(nat, 13.335)[0] is True
    assert quiz_service.grade(nat, "13.33")[0] is True
    assert quiz_service.grade(nat, 13.4) == (False, 0.0)


# ── Adaptive model ─────────────────────────────────────────────


def _upd(correct: bool, first: bool = True, **kw):
    return adaptive.update(
        topic=adaptive.SkillState(), subtopic=adaptive.SkillState(), item_difficulty=0.0, item_attempts=0,
        qtype="nat", correct=correct, first_attempt=first, **kw,
    )


def test_elo_update_moves_skill_and_item_in_opposite_directions():
    u = _upd(True)
    assert u.p_expected == pytest.approx(0.5)
    assert u.skill_after > u.skill_before
    assert u.item_difficulty < 0.0
    # Topic moves at half the subtopic's rate.
    assert u.topic.rating == pytest.approx(u.subtopic.rating * adaptive.K_TOPIC_SCALE)
    wrong = _upd(False)
    assert wrong.skill_after < wrong.skill_before


def test_repeat_answers_do_not_move_item_difficulty_and_move_skill_less():
    first, repeat = _upd(True), _upd(True, first=False)
    assert repeat.item_difficulty == 0.0 and not repeat.item_updated
    assert repeat.subtopic.rating == pytest.approx(first.subtopic.rating * adaptive.REPEAT_SCALE)


def test_guessing_floor_by_type():
    assert adaptive.p_correct(-10, 10, "mcq") == pytest.approx(0.25, abs=1e-6)
    assert adaptive.p_correct(-10, 10, "msq") == pytest.approx(0.07, abs=1e-6)
    assert adaptive.p_correct(-10, 10, "nat") == pytest.approx(0.0, abs=1e-6)


def test_uncertainty_shrinks_with_attempts_and_regrows_when_idle():
    assert adaptive.uncertainty(0) > adaptive.uncertainty(10) > adaptive.uncertainty(100)
    now = datetime.now(timezone.utc)
    s = adaptive.SkillState(0.0, 40, now - timedelta(days=30))
    assert s.n_eff(now) == pytest.approx(20, rel=1e-3)


def test_choose_next_targets_success_rate_and_harder_for_stronger_students():
    cands = [
        adaptive.Candidate(id=str(d), subtopic="s", qtype="nat", difficulty=adaptive.INITIAL_DIFFICULTY[d])
        for d in range(1, 6)
    ]
    warm = adaptive.SessionState(correct=[True, True, True], length=10)  # past the warm-up
    pick, p, review = adaptive.choose_next(
        cands, topic_theta={}, sub_skill={}, topic_of={"s": "t"}, session=warm, rng=random.Random(0)
    )
    assert not review
    assert abs(p - adaptive.TARGETS["balanced"]) < 0.1
    strong, _, _ = adaptive.choose_next(
        cands, topic_theta={"t": 2.0}, sub_skill={"s": adaptive.SkillState(1.0, 30)}, topic_of={"s": "t"},
        session=warm, rng=random.Random(0),
    )
    assert int(strong.id) > int(pick.id)


def test_choose_next_interleaves_subtopics():
    cands = [adaptive.Candidate(id=f"{s}{d}", subtopic=s, qtype="nat", difficulty=0.0) for s in "ab" for d in range(3)]
    session = adaptive.SessionState(subtopics=["a", "a"], qtypes=["nat", "nat"], correct=[True, True])
    for seed in range(20):
        pick, _, _ = adaptive.choose_next(
            cands, topic_theta={}, sub_skill={}, topic_of={}, session=session, rng=random.Random(seed)
        )
        assert pick.subtopic == "b"


def test_review_schedule_expands_then_graduates():
    t0 = datetime(2026, 10, 1, tzinfo=timezone.utc)
    miss = adaptive.Answer("q", False, t0, "a1")
    assert adaptive.review_due_at([miss], None, t0) == t0 + timedelta(days=1)
    ok1 = adaptive.Answer("q", True, t0 + timedelta(days=1), "a2")
    assert adaptive.review_due_at([miss, ok1], None, t0) == ok1.at + timedelta(days=3)
    oks = [adaptive.Answer("q", True, t0 + timedelta(days=i), f"a{i}") for i in range(1, 5)]
    assert adaptive.review_due_at([miss, *oks], None, t0) is None
    assert adaptive.review_due_at([ok1], None, t0) is None  # never missed


def test_mastery_needs_evidence_of_retention():
    t0 = datetime(2026, 10, 1, tzinfo=timezone.utc)
    same_day = [adaptive.Answer(f"q{i}", True, t0, "a") for i in range(12)]
    assert adaptive.mastery(4.0, 12, same_day)["level"] == "proficient"
    assert adaptive.mastery(4.0, 12, same_day, spans_days=True)["level"] == "mastered"
    assert adaptive.mastery(0.0, 0)["level"] == "new"


# ── API ────────────────────────────────────────────────────────


def test_overview_lists_subtopics_with_counts(client, headers, bank):
    r = client.get(f"{BASE}/units/cs/os", headers=headers)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["question_count"] == 30
    sub = data["topics"][0]["subtopics"][0]
    assert sub["question_count"] == 15
    assert sub["by_difficulty"] == {str(d): 3 for d in range(1, 6)}
    assert sub["skill"]["level"] == "new"


def test_practice_hides_answers_until_answered_then_gives_feedback(client, headers, bank):
    attempt = _start(client, headers, difficulties=[3, 4], types=["mcq", "nat"], count=6)
    assert attempt["question_count"] == 6
    assert all(q["difficulty"] in (3, 4) and q["type"] in ("mcq", "nat") for q in attempt["questions"])
    assert all(q["answer"] is None and q["explanation"] is None for q in attempt["questions"])
    # Balanced across both chosen subtopics.
    assert {q["subtopic"] for q in attempt["questions"]} == {"bankers-algorithm", "prevention"}

    q = attempt["questions"][0]
    r = client.post(
        f"{BASE}/attempts/{attempt['id']}/answer",
        json={"question_id": q["id"], "response": _correct_response(q), "time_ms": 5000},
        headers=headers,
    )
    assert r.status_code == 200, r.text
    res = r.json()
    assert res["is_correct"] is True
    assert res["question"]["explanation"]
    assert res["skill"]["attempts"] == 1
    assert res["skill"]["rating"] > res["skill"]["before"]

    again = client.post(
        f"{BASE}/attempts/{attempt['id']}/answer", json={"question_id": q["id"], "response": None}, headers=headers
    )
    assert again.status_code == 400


def test_exam_mode_withholds_feedback_and_applies_negative_marking(client, headers, bank):
    attempt = _start(client, headers, mode="exam", types=["mcq"], difficulties=[1, 2], count=4)
    assert attempt["config"]["time_limit_sec"] == 4 * quiz_service.SECONDS_PER_MARK
    q1, q2 = attempt["questions"][:2]
    r = client.post(
        f"{BASE}/attempts/{attempt['id']}/answer", json={"question_id": q1["id"], "response": "A"}, headers=headers
    )
    assert r.json().get("is_correct") is None and r.json().get("question") is None
    # Changing an answer before submitting is allowed in exam mode.
    client.post(f"{BASE}/attempts/{attempt['id']}/answer", json={"question_id": q1["id"], "response": "C"}, headers=headers)
    client.post(f"{BASE}/attempts/{attempt['id']}/answer", json={"question_id": q2["id"], "response": "B"}, headers=headers)

    mid = client.get(f"{BASE}/attempts/{attempt['id']}", headers=headers).json()
    assert all(q["answer"] is None for q in mid["questions"])

    done = client.post(f"{BASE}/attempts/{attempt['id']}/finish", headers=headers).json()
    assert done["status"] == "completed"
    assert done["score"] == pytest.approx(1 - 1 / 3, abs=0.01)
    assert done["summary"]["unanswered"] == 2
    assert all(q["answer"] for q in done["questions"])


def test_adaptive_serves_one_question_at_a_time_and_adapts(client, headers, bank):
    attempt = _start(client, headers, mode="adaptive", count=8)
    assert len(attempt["questions"]) == 1
    first_difficulty = attempt["questions"][0]["difficulty"]
    current = attempt["questions"][0]
    difficulties = [first_difficulty]
    for _ in range(7):
        r = client.post(
            f"{BASE}/attempts/{attempt['id']}/answer",
            json={"question_id": current["id"], "response": _correct_response(current)},
            headers=headers,
        )
        assert r.status_code == 200, r.text
        current = r.json()["next_question"]
        difficulties.append(current["difficulty"])
    # Answering everything right should push difficulty up.
    assert max(difficulties[-3:]) > first_difficulty
    last = client.post(
        f"{BASE}/attempts/{attempt['id']}/answer",
        json={"question_id": current["id"], "response": _correct_response(current)},
        headers=headers,
    ).json()
    assert last["done"] is True and last["next_question"] is None
    done = client.post(f"{BASE}/attempts/{attempt['id']}/finish", headers=headers).json()
    assert done["answered"] == 8
    assert {s["id"] for s in done["summary"]["subtopics"]} <= {"bankers-algorithm", "prevention"}

    overview = client.get(f"{BASE}/units/cs/os", headers=headers).json()
    skills = [s["skill"] for s in overview["topics"][0]["subtopics"]]
    assert sum(s["attempts"] for s in skills) == 8
    assert overview["answered_total"] == 8 and overview["correct_total"] == 8
    assert overview["topics"][0]["readiness"] > adaptive.readiness(0.0)


def test_adaptive_rejects_answering_a_non_current_question(client, headers, bank):
    attempt = _start(client, headers, mode="adaptive", count=5)
    r = client.post(
        f"{BASE}/attempts/{attempt['id']}/answer", json={"question_id": "t06-001", "response": "B"}, headers=headers
    )
    if attempt["questions"][0]["id"] != "t06-001":
        assert r.status_code == 400


def test_bad_inputs(client, headers, bank):
    r = client.post(f"{BASE}/units/cs/os/attempts", json={"mode": "practice", "subtopics": ["nope"]}, headers=headers)
    assert r.status_code == 400
    attempt = _start(client, headers, types=["mcq"], count=3)
    q = attempt["questions"][0]
    r = client.post(f"{BASE}/attempts/{attempt['id']}/answer", json={"question_id": q["id"], "response": "E"}, headers=headers)
    assert r.status_code == 400
    assert client.get(f"{BASE}/units/cs/nope", headers=headers).status_code == 404


def test_attempts_are_private(client, headers, bank, signup_payload):
    attempt = _start(client, headers, count=3)
    other = client.post("/api/v1/auth/signup", json=signup_payload("student", "other")).json()
    r = client.get(f"{BASE}/attempts/{attempt['id']}", headers={"Authorization": f"Bearer {other['access_token']}"})
    assert r.status_code == 404


def test_ai_help_requires_an_answer_and_streams(client, headers, bank, monkeypatch):
    captured = {}

    def fake_stream(system, messages, **_) -> Iterator[str]:
        captured["system"] = system
        yield "Here is "
        yield "why."

    monkeypatch.setattr(claude_client, "stream_completion", fake_stream)
    attempt = _start(client, headers, types=["mcq"], count=3)
    q = attempt["questions"][0]
    url = f"{BASE}/attempts/{attempt['id']}/questions/{q['id']}/ask"
    body = {"messages": [{"role": "user", "content": "Why is B right?"}]}
    assert client.post(url, json=body, headers=headers).status_code == 400

    client.post(f"{BASE}/attempts/{attempt['id']}/answer", json={"question_id": q["id"], "response": "A"}, headers=headers)
    r = client.post(url, json=body, headers=headers)
    assert r.status_code == 200
    assert r.text == "Here is why."
    assert "Correct answer: B" in captured["system"] and "The student's answer: A (incorrect)" in captured["system"]
