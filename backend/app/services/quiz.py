"""Learn quizzes — a pre-authored question bank per unit, three quiz modes, and
an adaptive learner model.

Questions are content, authored offline (docs/learn-authoring/cs-os/QUIZ.md) and
read from disk like the rest of Learn:

    content/learn/<subject>/<unit>/quiz/
    ├── taxonomy.json        # topics → subtopics (the ids questions are tagged with)
    └── <topic_id>.json      # {"topic_id", "questions": [...]}

Modes:
- practice — the student picks subtopics / difficulty levels / types / count;
  instant feedback with a worked solution after every answer.
- exam     — same picking, GATE marking (−1/3 or −2/3 for a wrong MCQ), a timer,
  and solutions only after submitting.
- adaptive — questions chosen one at a time by `adaptive.choose_next` from the
  student's current skill, with spaced re-asking of mistakes; instant feedback.

Every answer, in every mode, updates the student's Elo skills (per subtopic and
per topic) and — on a student's first answer to it — the question's learned
difficulty. See `adaptive.py` and docs/adaptive-learning-research.md.
"""
from __future__ import annotations

import math
import random
import uuid
from collections import Counter, defaultdict
from collections.abc import Iterator
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.quiz import TOPIC_SKILL_PREFIX, LearnerSkill, QuizAttempt, QuizItemStat, QuizResponse
from app.models.user import User
from app.services import adaptive, claude_client
from app.services import learn as learn_service

LETTERS = "ABCD"
# GATE pacing: 180 minutes for 100 marks.
SECONDS_PER_MARK = 108
_NAT_EPS = 1e-9
_MAX_HISTORY_MESSAGES = 12

_PUBLIC_FIELDS = (
    "id", "topic_id", "subtopic", "difficulty", "type", "marks", "est_seconds", "concepts", "stem", "options",
)
_REVEAL_FIELDS = ("answer", "explanation", "option_feedback", "trap")


def _bad_request(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _utc(dt: datetime) -> datetime:
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt


# ── Question bank ──────────────────────────────────────────────


def load_bank(subject_id: str, unit_id: str) -> dict:
    """{taxonomy, questions: {id: question}, topic_of: {subtopic id: topic}} for a unit."""
    learn_service._check_id(subject_id, "Subject")
    learn_service._check_id(unit_id, "Unit")
    folder = learn_service.content_dir() / subject_id / unit_id / "quiz"
    taxonomy = learn_service._load_json(folder / "taxonomy.json")
    if taxonomy is None:
        raise learn_service._not_found("Quiz bank")
    questions: dict[str, dict] = {}
    topic_of: dict[str, dict] = {}
    for topic in taxonomy.get("topics", []):
        for sub in topic.get("subtopics", []):
            topic_of[sub["id"]] = topic
        data = learn_service._load_json(folder / f"{topic['id']}.json") or {}
        for q in data.get("questions", []):
            questions[q["id"]] = {**q, "topic_id": topic["id"]}
    return {"taxonomy": taxonomy, "questions": questions, "topic_of": topic_of}


def public_question(q: dict) -> dict:
    return {k: q[k] for k in _PUBLIC_FIELDS if k in q}


def revealed_question(q: dict) -> dict:
    return {**public_question(q), **{k: q[k] for k in _REVEAL_FIELDS if k in q}}


def grade(q: dict, response) -> tuple[bool, float]:
    """(is_correct, marks awarded) under GATE rules. `response` None = not answered."""
    marks = float(q.get("marks", 1))
    if response is None or response == "" or response == []:
        return False, 0.0
    qtype = q["type"]
    if qtype == "mcq":
        correct = isinstance(response, str) and response.upper() == q["answer"]
        return correct, marks if correct else -round(marks / 3, 4)
    if qtype == "msq":
        if not isinstance(response, list):
            return False, 0.0
        correct = sorted({str(r).upper() for r in response}) == q["answer"]
        return correct, marks if correct else 0.0
    try:
        value = float(response)
    except (TypeError, ValueError):
        return False, 0.0
    if math.isnan(value) or math.isinf(value):
        return False, 0.0
    lo, hi = q["answer"]["min"], q["answer"]["max"]
    correct = lo - _NAT_EPS <= value <= hi + _NAT_EPS
    return correct, marks if correct else 0.0


def _normalise_response(q: dict, response):
    """Validate the shape of a response for the question type (None = skipped)."""
    if response is None:
        return None
    qtype = q["type"]
    if qtype == "mcq":
        if not isinstance(response, str) or response.upper() not in LETTERS:
            raise _bad_request("MCQ answer must be one of A, B, C, D")
        return response.upper()
    if qtype == "msq":
        if not isinstance(response, list) or not response or any(
            not isinstance(r, str) or r.upper() not in LETTERS for r in response
        ):
            raise _bad_request("MSQ answer must be a non-empty list of letters")
        return sorted({r.upper() for r in response})
    if isinstance(response, bool) or not isinstance(response, (int, float, str)):
        raise _bad_request("Numerical answer must be a number")
    try:
        value = float(response)
    except ValueError as exc:
        raise _bad_request("Numerical answer must be a number") from exc
    if math.isnan(value) or math.isinf(value):
        raise _bad_request("Numerical answer must be a finite number")
    return value


# ── Student history ────────────────────────────────────────────


@dataclass
class _History:
    """Every answer this student has given in a unit, oldest first."""
    answers: list[QuizResponse]

    def by_question(self) -> dict[str, list[adaptive.Answer]]:
        out: dict[str, list[adaptive.Answer]] = defaultdict(list)
        for r in self.answers:
            out[r.question_id].append(
                adaptive.Answer(r.question_id, r.is_correct, _utc(r.created_at), str(r.attempt_id))
            )
        return out

    def by_subtopic(self) -> dict[str, list[adaptive.Answer]]:
        out: dict[str, list[adaptive.Answer]] = defaultdict(list)
        for r in self.answers:
            out[r.subtopic].append(
                adaptive.Answer(r.question_id, r.is_correct, _utc(r.created_at), str(r.attempt_id))
            )
        return out


def _history(db: Session, user: User, subject_id: str, unit_id: str) -> _History:
    rows = db.scalars(
        select(QuizResponse)
        .join(QuizAttempt, QuizResponse.attempt_id == QuizAttempt.id)
        .where(QuizResponse.user_id == user.id, QuizAttempt.subject_id == subject_id, QuizAttempt.unit_id == unit_id)
        .order_by(QuizResponse.created_at, QuizResponse.id)
    ).all()
    return _History(list(rows))


# ── Learner model persistence ──────────────────────────────────


def _item_key(subject_id: str, unit_id: str, question_id: str) -> str:
    return f"{subject_id}/{unit_id}/{question_id}"


def _topic_key(topic_id: str) -> str:
    return f"{TOPIC_SKILL_PREFIX}{topic_id}"


def _skills(db: Session, user: User, subject_id: str, unit_id: str) -> dict[str, LearnerSkill]:
    rows = db.scalars(
        select(LearnerSkill).where(
            LearnerSkill.user_id == user.id,
            LearnerSkill.subject_id == subject_id,
            LearnerSkill.unit_id == unit_id,
        )
    ).all()
    return {r.skill_id: r for r in rows}


def _state(row: LearnerSkill | None) -> adaptive.SkillState:
    if row is None:
        return adaptive.SkillState()
    return adaptive.SkillState(row.rating or 0.0, row.attempts or 0, row.updated_at)


def _skill_row(db: Session, skills: dict, user: User, subject_id: str, unit_id: str, skill_id: str) -> LearnerSkill:
    row = skills.get(skill_id)
    if row is None:
        row = LearnerSkill(
            user_id=user.id, subject_id=subject_id, unit_id=unit_id, skill_id=skill_id,
            rating=0.0, attempts=0, correct=0,
        )
        db.add(row)
        skills[skill_id] = row
    return row


def _item_difficulties(db: Session, subject_id: str, unit_id: str, questions: list[dict]) -> dict[str, float]:
    """Current learned difficulty per question id, falling back to the authored prior."""
    keys = {_item_key(subject_id, unit_id, q["id"]): q for q in questions}
    if not keys:
        return {}
    stats = {
        s.item_key: s.difficulty
        for s in db.scalars(select(QuizItemStat).where(QuizItemStat.item_key.in_(list(keys)))).all()
    }
    return {
        q["id"]: stats.get(key, adaptive.INITIAL_DIFFICULTY[q["difficulty"]]) for key, q in keys.items()
    }


def _record_learning(
    db: Session, user: User, attempt: QuizAttempt, q: dict, correct: bool, first_attempt: bool
) -> adaptive.Update:
    skills = _skills(db, user, attempt.subject_id, attempt.unit_id)
    topic_row = _skill_row(db, skills, user, attempt.subject_id, attempt.unit_id, _topic_key(q["topic_id"]))
    sub_row = _skill_row(db, skills, user, attempt.subject_id, attempt.unit_id, q["subtopic"])
    key = _item_key(attempt.subject_id, attempt.unit_id, q["id"])
    item = db.get(QuizItemStat, key)
    if item is None:
        item = QuizItemStat(
            item_key=key, difficulty=adaptive.INITIAL_DIFFICULTY[q["difficulty"]], attempts=0, correct=0
        )
        db.add(item)

    now = _now()
    result = adaptive.update(
        topic=_state(topic_row),
        subtopic=_state(sub_row),
        item_difficulty=item.difficulty,
        item_attempts=item.attempts or 0,
        qtype=q["type"],
        correct=correct,
        first_attempt=first_attempt,
        now=now,
    )
    for row, new in ((topic_row, result.topic), (sub_row, result.subtopic)):
        row.rating, row.attempts = new.rating, new.attempts
        row.correct = (row.correct or 0) + int(correct)
        row.updated_at = now
    if result.item_updated:
        item.difficulty = result.item_difficulty
        item.attempts = (item.attempts or 0) + 1
        item.correct = (item.correct or 0) + int(correct)
    return result


def _retention_evidence(answers: list[adaptive.Answer]) -> tuple[bool, bool]:
    """(had a correct review ≥1 day after a miss, correct answers span ≥2 days with no misses)."""
    delayed_review = False
    last_miss: dict[str, datetime] = {}
    for a in answers:
        if not a.correct:
            last_miss[a.question_id] = a.at
        elif a.question_id in last_miss and a.at - last_miss[a.question_id] >= timedelta(days=1):
            delayed_review = True
    no_misses = all(a.correct for a in answers)
    spans_days = no_misses and len({a.at.date() for a in answers}) >= 2
    return delayed_review, spans_days


def _skill_view(
    skills: dict[str, LearnerSkill], topic_id: str | None, subtopic: str, answers: list[adaptive.Answer]
) -> dict:
    topic = skills.get(_topic_key(topic_id)) if topic_id else None
    sub = skills.get(subtopic)
    theta = (topic.rating if topic else 0.0) + (sub.rating if sub else 0.0)
    attempts = sub.attempts if sub else 0
    delayed_review, spans_days = _retention_evidence(answers)
    return {
        "subtopic": subtopic,
        "rating": round(theta, 3),
        "attempts": attempts,
        "correct": sub.correct if sub else 0,
        **adaptive.mastery(theta, attempts, answers, delayed_review, spans_days),
    }


def _reviews_due(by_question: dict[str, list[adaptive.Answer]], now: datetime) -> set[str]:
    exam = get_settings().gate_exam_date
    due = set()
    for qid, answers in by_question.items():
        at = adaptive.review_due_at(answers, exam, now)
        if at is not None and at <= now:
            due.add(qid)
    return due


# ── Overview ───────────────────────────────────────────────────


def overview(db: Session, user: User, subject_id: str, unit_id: str) -> dict:
    bank = load_bank(subject_id, unit_id)
    skills = _skills(db, user, subject_id, unit_id)
    history = _history(db, user, subject_id, unit_id)
    by_sub_answers = history.by_subtopic()
    due = _reviews_due(history.by_question(), _now())
    seen: dict[str, set[str]] = defaultdict(set)
    for r in history.answers:
        seen[r.subtopic].add(r.question_id)

    by_sub: dict[str, list[dict]] = defaultdict(list)
    for q in bank["questions"].values():
        by_sub[q["subtopic"]].append(q)

    topics = []
    for topic in bank["taxonomy"].get("topics", []):
        subtopics = []
        for sub in topic.get("subtopics", []):
            qs = by_sub.get(sub["id"], [])
            subtopics.append({
                "id": sub["id"],
                "name": sub["name"],
                "question_count": len(qs),
                "by_difficulty": {str(d): sum(1 for q in qs if q["difficulty"] == d) for d in range(1, 6)},
                "by_type": {t: sum(1 for q in qs if q["type"] == t) for t in ("mcq", "msq", "nat")},
                # "3:nat" → count, so the client can size any difficulty × type filter exactly.
                "by_difficulty_type": dict(Counter(f"{q['difficulty']}:{q['type']}" for q in qs)),
                "seen": len(seen.get(sub["id"], ())),
                "reviews_due": sum(1 for q in qs if q["id"] in due),
                "skill": _skill_view(skills, topic["id"], sub["id"], by_sub_answers.get(sub["id"], [])),
            })
        practised = [s["skill"]["readiness"] for s in subtopics if s["skill"]["attempts"]]
        topics.append({
            "id": topic["id"],
            "title": topic["title"],
            "readiness": round(sum(practised) / len(practised), 1) if practised else None,
            "subtopics": subtopics,
        })

    recent = db.scalars(
        select(QuizAttempt)
        .where(QuizAttempt.user_id == user.id, QuizAttempt.subject_id == subject_id, QuizAttempt.unit_id == unit_id)
        .order_by(QuizAttempt.started_at.desc())
        .limit(10)
    ).all()
    return {
        "subject_id": subject_id,
        "unit_id": unit_id,
        "question_count": len(bank["questions"]),
        "answered_total": len(history.answers),
        "correct_total": sum(1 for r in history.answers if r.is_correct),
        "reviews_due": len(due),
        "topics": topics,
        "recent_attempts": [attempt_summary(a) for a in recent],
    }


# ── Attempts ───────────────────────────────────────────────────


def attempt_summary(a: QuizAttempt) -> dict:
    return {
        "id": str(a.id),
        "mode": a.mode,
        "status": a.status,
        "subject_id": a.subject_id,
        "unit_id": a.unit_id,
        "config": a.config or {},
        "question_count": int((a.config or {}).get("count", len(a.question_ids or []))),
        "answered": a.answered,
        "correct": a.correct,
        "score": round(a.score, 2),
        "max_score": round(a.max_score, 2),
        # SQLite hands back naive datetimes; always send UTC with an explicit zone.
        "started_at": _utc(a.started_at) if a.started_at else None,
        "completed_at": _utc(a.completed_at) if a.completed_at else None,
    }


def _filtered_pool(bank: dict, subtopics: list[str], difficulties: list[int] | None, types: list[str] | None) -> list[dict]:
    pool = [q for q in bank["questions"].values() if q["subtopic"] in subtopics]
    if difficulties:
        pool = [q for q in pool if q["difficulty"] in difficulties]
    if types:
        pool = [q for q in pool if q["type"] in types]
    return pool


def _pick_fixed(pool: list[dict], count: int, by_question: dict[str, list[adaptive.Answer]], rng: random.Random) -> list[dict]:
    """Practice/exam selection: balanced across subtopics; fresh questions first,
    then ones last answered wrong, then the longest-ago; final order interleaved."""

    def priority(q: dict) -> tuple:
        answers = by_question.get(q["id"])
        if not answers:
            return (0, 0.0, rng.random())
        last = answers[-1]
        return (1 if not last.correct else 2, last.at.timestamp(), rng.random())

    by_sub: dict[str, list[dict]] = defaultdict(list)
    for q in pool:
        by_sub[q["subtopic"]].append(q)
    queues = [sorted(qs, key=priority) for qs in by_sub.values()]
    rng.shuffle(queues)
    picked: list[dict] = []
    while len(picked) < count and any(queues):
        for queue in queues:
            if queue and len(picked) < count:
                picked.append(queue.pop(0))
    rng.shuffle(picked)
    return picked


def _retry_gap(question_id: str) -> int:
    lo, hi = adaptive.RETRY_GAP
    return lo + sum(map(ord, question_id)) % (hi - lo + 1)


def _next_adaptive(db: Session, user: User, attempt: QuizAttempt, bank: dict, rng: random.Random | None = None) -> tuple[dict, float, bool] | None:
    cfg = attempt.config or {}
    now = _now()
    pool = _filtered_pool(bank, cfg["subtopics"], None, cfg.get("types"))
    if not pool:
        return None
    history = _history(db, user, attempt.subject_id, attempt.unit_id)
    by_question = history.by_question()
    last_index = {r.question_id: i for i, r in enumerate(history.answers)}
    total = len(history.answers)
    due = _reviews_due(by_question, now)

    session_responses = list(attempt.responses)
    served = defaultdict(int)
    for qid in attempt.question_ids or []:
        served[qid] += 1
    missed_at: dict[str, int] = {}  # qid → position in this session where it was missed
    for i, r in enumerate(session_responses):
        if not r.is_correct:
            missed_at[r.question_id] = i

    difficulties = _item_difficulties(db, attempt.subject_id, attempt.unit_id, pool)
    candidates = []
    for q in pool:
        qid = q["id"]
        answers = by_question.get(qid, [])
        retry_due = (
            qid in missed_at
            and served[qid] == 1
            and len(session_responses) - 1 - missed_at[qid] >= _retry_gap(qid)
        )
        if served[qid] and not retry_due:
            continue
        last = answers[-1] if answers else None
        candidates.append(adaptive.Candidate(
            id=qid,
            subtopic=q["subtopic"],
            qtype=q["type"],
            difficulty=difficulties[qid],
            times_seen=len(answers),
            items_since_seen=(total - 1 - last_index[qid]) if qid in last_index else None,
            correct_recently=bool(
                last and last.correct and now - last.at < timedelta(days=adaptive.CORRECT_COOLDOWN_DAYS)
            ),
            review_due=qid in due and not served[qid],
            retry_due=retry_due,
        ))
    if not candidates:
        return None

    skills = _skills(db, user, attempt.subject_id, attempt.unit_id)
    topic_of = {sub: t["id"] for sub, t in bank["topic_of"].items()}
    session = adaptive.SessionState(
        subtopics=[r.subtopic for r in session_responses],
        qtypes=[bank["questions"][r.question_id]["type"] for r in session_responses if r.question_id in bank["questions"]],
        correct=[r.is_correct for r in session_responses],
        reviews_served=sum(1 for r in session_responses if r.is_review),
        length=int(cfg.get("count", 10)),
    )
    choice = adaptive.choose_next(
        candidates,
        topic_theta={k[len(TOPIC_SKILL_PREFIX):]: v.rating for k, v in skills.items() if k.startswith(TOPIC_SKILL_PREFIX)},
        sub_skill={k: _state(v) for k, v in skills.items() if not k.startswith(TOPIC_SKILL_PREFIX)},
        topic_of=topic_of,
        session=session,
        setting=cfg.get("target", "balanced"),
        now=now,
        rng=rng,
    )
    if choice is None:
        return None
    candidate, p, is_review = choice
    return bank["questions"][candidate.id], p, is_review


def start_attempt(db: Session, user: User, subject_id: str, unit_id: str, req: dict) -> dict:
    bank = load_bank(subject_id, unit_id)
    known = set(bank["topic_of"])
    subtopics = [s for s in dict.fromkeys(req.get("subtopics") or []) if s in known]
    if not subtopics:
        raise _bad_request("Pick at least one subtopic")
    mode = req["mode"]
    count = int(req["count"])
    types = req.get("types") or None
    difficulties = None if mode == "adaptive" else (req.get("difficulties") or None)
    config: dict = {"subtopics": subtopics, "types": types, "difficulties": difficulties, "count": count}
    if mode == "adaptive":
        config["target"] = req.get("target") or "balanced"
    attempt = QuizAttempt(
        user_id=user.id, subject_id=subject_id, unit_id=unit_id, mode=mode, status="active",
        config=config, question_ids=[], answered=0, correct=0, score=0.0, max_score=0.0,
    )

    if mode == "adaptive":
        db.add(attempt)
        db.flush()
        nxt = _next_adaptive(db, user, attempt, bank)
        if nxt is None:
            db.rollback()
            raise _bad_request("No questions match those choices")
        attempt.question_ids = [nxt[0]["id"]]
    else:
        pool = _filtered_pool(bank, subtopics, difficulties, types)
        if not pool:
            raise _bad_request("No questions match those choices")
        by_question = _history(db, user, subject_id, unit_id).by_question()
        picked = _pick_fixed(pool, count, by_question, random.Random())
        attempt.question_ids = [q["id"] for q in picked]
        attempt.max_score = float(sum(q.get("marks", 1) for q in picked))
        config["count"] = len(picked)
        if mode == "exam":
            config["time_limit_sec"] = int(attempt.max_score * SECONDS_PER_MARK)
        attempt.config = config
        db.add(attempt)
    db.commit()
    return attempt_detail(db, user, attempt.id)


def _get_attempt(db: Session, user: User, attempt_id: uuid.UUID) -> QuizAttempt:
    attempt = db.get(QuizAttempt, attempt_id)
    if attempt is None or attempt.user_id != user.id:
        raise learn_service._not_found("Quiz attempt")
    return attempt


def _can_reveal(attempt: QuizAttempt, answered: bool) -> bool:
    if attempt.mode == "exam":
        return attempt.status == "completed"
    return answered or attempt.status == "completed"


def _response_view(r: QuizResponse, full: bool) -> dict:
    view = {"question_id": r.question_id, "response": r.response}
    if full:
        view.update({
            "is_correct": r.is_correct,
            "marks_awarded": r.marks_awarded,
            "time_ms": r.time_ms,
            "is_review": r.is_review,
            "p_expected": r.p_expected,
            "skill_before": r.skill_before,
            "skill_after": r.skill_after,
        })
    return view


def attempt_detail(db: Session, user: User, attempt_id: uuid.UUID) -> dict:
    attempt = _get_attempt(db, user, attempt_id)
    db.refresh(attempt)
    bank = load_bank(attempt.subject_id, attempt.unit_id)
    answered = {r.question_id for r in attempt.responses}
    questions = []
    for qid in dict.fromkeys(attempt.question_ids or []):  # a re-asked question is listed once
        q = bank["questions"].get(qid)
        if q is None:  # removed from the bank since
            continue
        questions.append(revealed_question(q) if _can_reveal(attempt, qid in answered) else public_question(q))
    full = attempt.mode != "exam" or attempt.status == "completed"
    current = None
    if attempt.mode == "adaptive" and attempt.status == "active" and attempt.question_ids:
        last = attempt.question_ids[-1]
        if sum(1 for r in attempt.responses if r.question_id == last) < attempt.question_ids.count(last):
            current = last
    return {
        **attempt_summary(attempt),
        "questions": questions,
        "responses": [_response_view(r, full) for r in attempt.responses],
        "current_question_id": current,
        "summary": _results(db, user, attempt, bank) if attempt.status == "completed" else None,
    }


def submit_answer(
    db: Session, user: User, attempt_id: uuid.UUID, question_id: str, response, time_ms: int | None
) -> dict:
    attempt = _get_attempt(db, user, attempt_id)
    if attempt.status != "active":
        raise _bad_request("This quiz is already finished")
    served = attempt.question_ids or []
    if question_id not in served:
        raise _bad_request("That question isn't part of this quiz")
    if attempt.mode == "adaptive" and question_id != served[-1]:
        raise _bad_request("Answer the current question first")
    bank = load_bank(attempt.subject_id, attempt.unit_id)
    q = bank["questions"].get(question_id)
    if q is None:
        raise learn_service._not_found("Question")
    response = _normalise_response(q, response)

    in_attempt = [r for r in attempt.responses if r.question_id == question_id]
    if len(in_attempt) >= served.count(question_id):
        if attempt.mode != "exam":
            raise _bad_request("Already answered")
        # Exam mode: answers can be changed until submitting. Only the score is
        # updated; the learner model keeps the first answer.
        existing = in_attempt[-1]
        attempt.score -= existing.marks_awarded
        attempt.correct -= int(existing.is_correct)
        correct, marks = grade(q, response)
        existing.response, existing.is_correct, existing.marks_awarded = response, correct, marks
        existing.time_ms = time_ms
        attempt.score += marks
        attempt.correct += int(correct)
        db.commit()
        return {"question_id": question_id, "recorded": True, "done": False}

    previous = _history(db, user, attempt.subject_id, attempt.unit_id).by_question().get(question_id, [])
    first_attempt = not previous
    is_review = any(not a.correct for a in previous)
    correct, marks = grade(q, response)
    learned = _record_learning(db, user, attempt, q, correct, first_attempt)
    db.add(QuizResponse(
        attempt_id=attempt.id, user_id=user.id, question_id=question_id, subtopic=q["subtopic"],
        difficulty=q["difficulty"], response=response, is_correct=correct, marks_awarded=marks,
        time_ms=time_ms, is_review=is_review, p_expected=learned.p_expected,
        skill_before=learned.skill_before, skill_after=learned.skill_after, created_at=_now(),
    ))
    attempt.answered += 1
    attempt.correct += int(correct)
    attempt.score += marks
    if attempt.mode == "adaptive":
        attempt.max_score += float(q.get("marks", 1))
    db.flush()
    db.refresh(attempt)

    result: dict = {"question_id": question_id, "recorded": True}
    if attempt.mode == "exam":
        result["done"] = attempt.answered >= len(served)
        db.commit()
        return result

    sub_answers = _history(db, user, attempt.subject_id, attempt.unit_id).by_subtopic().get(q["subtopic"], [])
    result.update({
        "is_correct": correct,
        "marks_awarded": marks,
        "is_review": is_review,
        "question": revealed_question(q),
        "p_expected": round(learned.p_expected, 3),
        "skill": {
            **_skill_view(_skills(db, user, attempt.subject_id, attempt.unit_id), q["topic_id"], q["subtopic"], sub_answers),
            "before": round(learned.skill_before, 3),
            "readiness_before": round(adaptive.readiness(learned.skill_before), 1),
        },
    })
    next_question = None
    next_is_review = False
    if attempt.mode == "adaptive" and attempt.answered < int(attempt.config.get("count", 0)):
        nxt = _next_adaptive(db, user, attempt, bank)
        if nxt is not None:
            attempt.question_ids = [*attempt.question_ids, nxt[0]["id"]]
            next_question = public_question(nxt[0])
            next_is_review = nxt[2]
    result["next_question"] = next_question
    result["next_is_review"] = next_is_review
    result["done"] = (
        next_question is None if attempt.mode == "adaptive" else attempt.answered >= len(served)
    )
    db.commit()
    return result


def _results(db: Session, user: User, attempt: QuizAttempt, bank: dict) -> dict:
    skills = _skills(db, user, attempt.subject_id, attempt.unit_id)
    sub_answers = _history(db, user, attempt.subject_id, attempt.unit_id).by_subtopic()
    per_sub: dict[str, dict] = {}
    for r in attempt.responses:
        s = per_sub.setdefault(r.subtopic, {"answered": 0, "correct": 0, "skill_start": r.skill_before})
        s["answered"] += 1
        s["correct"] += int(r.is_correct)
    asked = {bank["questions"][qid]["subtopic"] for qid in attempt.question_ids or [] if qid in bank["questions"]}
    subtopics = []
    for sub_id in sorted(asked | set(per_sub)):
        topic = bank["topic_of"].get(sub_id, {})
        name = next((s["name"] for s in topic.get("subtopics", []) if s["id"] == sub_id), sub_id)
        stats = per_sub.get(sub_id, {"answered": 0, "correct": 0, "skill_start": None})
        start = stats["skill_start"]
        subtopics.append({
            "id": sub_id, "name": name, "topic_id": topic.get("id"), "topic_title": topic.get("title"),
            "answered": stats["answered"], "correct": stats["correct"],
            "readiness_start": None if start is None else round(adaptive.readiness(start), 1),
            "skill": _skill_view(skills, topic.get("id"), sub_id, sub_answers.get(sub_id, [])),
        })
    by_difficulty = {str(d): {"answered": 0, "correct": 0} for d in range(1, 6)}
    total_ms = 0
    for r in attempt.responses:
        by_difficulty[str(r.difficulty)]["answered"] += 1
        by_difficulty[str(r.difficulty)]["correct"] += int(r.is_correct)
        total_ms += r.time_ms or 0
    weakest = sorted(
        (s for s in subtopics if s["answered"]),
        key=lambda s: (s["skill"]["readiness"], s["correct"] / s["answered"]),
    )[:3]
    answered_ids = {r.question_id for r in attempt.responses}
    return {
        "subtopics": subtopics,
        "by_difficulty": by_difficulty,
        "unanswered": sum(1 for qid in dict.fromkeys(attempt.question_ids or []) if qid not in answered_ids),
        "reviews": sum(1 for r in attempt.responses if r.is_review),
        "total_time_ms": total_ms,
        "focus_next": [s["id"] for s in weakest if s["skill"]["level"] != "mastered"],
    }


def finish_attempt(db: Session, user: User, attempt_id: uuid.UUID) -> dict:
    attempt = _get_attempt(db, user, attempt_id)
    if attempt.status != "completed":
        if attempt.mode == "adaptive" and attempt.question_ids:
            # Drop the served-but-unanswered current question.
            served = list(attempt.question_ids)
            if sum(1 for r in attempt.responses if r.question_id == served[-1]) < served.count(served[-1]):
                attempt.question_ids = served[:-1]
            attempt.config = {**(attempt.config or {}), "count": attempt.answered}
        attempt.status = "completed"
        attempt.completed_at = _now()
        db.commit()
    return attempt_detail(db, user, attempt.id)


def list_attempts(db: Session, user: User, subject_id: str, unit_id: str, limit: int = 20) -> list[dict]:
    rows = db.scalars(
        select(QuizAttempt)
        .where(QuizAttempt.user_id == user.id, QuizAttempt.subject_id == subject_id, QuizAttempt.unit_id == unit_id)
        .order_by(QuizAttempt.started_at.desc())
        .limit(limit)
    ).all()
    return [attempt_summary(a) for a in rows]


# ── AI help on a question ──────────────────────────────────────

_HELP_SYSTEM = """You are Cognify's GATE CS tutor. The student just attempted this
practice question and wants help understanding it.

Question ({qtype}, difficulty {difficulty}/5, {marks} mark(s), subtopic: {subtopic}):
{stem}
{options}
Correct answer: {answer}
Official worked solution:
{explanation}
{feedback}
The student's answer: {response} ({verdict}).

Help them learn, don't just repeat the solution:
- If they got it wrong, find the most likely misconception behind their specific
  answer and address it directly.
- Explain step by step, with small tables or Gantt charts where helpful (GFM
  tables or code blocks). Use plain Unicode maths (×, −, ≤), not LaTeX.
- Keep the official answer as ground truth. If you believe it is wrong, say so
  clearly and explain why, rather than silently disagreeing.
- Concise and friendly. For a follow-up practice question use a ```unsolved fence.
"""


def _fmt_answer(q: dict, value) -> str:
    if value is None:
        return "(not answered)"
    if q["type"] == "nat" and isinstance(value, dict):
        lo, hi = value["min"], value["max"]
        return f"{lo:g}" if lo == hi else f"between {lo:g} and {hi:g}"
    if isinstance(value, list):
        return ", ".join(value)
    if isinstance(value, float):
        return f"{value:g}"
    return str(value)


def stream_question_help(
    db: Session, user: User, attempt_id: uuid.UUID, question_id: str, messages: list[dict]
) -> Iterator[str]:
    attempt = _get_attempt(db, user, attempt_id)
    answers = [r for r in attempt.responses if r.question_id == question_id]
    if not answers or not _can_reveal(attempt, True):
        raise _bad_request("Answer the question (and submit the exam) before asking for help")
    r = answers[-1]
    q = load_bank(attempt.subject_id, attempt.unit_id)["questions"].get(question_id)
    if q is None:
        raise learn_service._not_found("Question")
    options = "\n".join(f"{LETTERS[i]}. {o}" for i, o in enumerate(q.get("options") or []))
    feedback = ""
    if q.get("option_feedback"):
        feedback = "Why each option is right/wrong:\n" + "\n".join(
            f"{LETTERS[i]}. {f}" for i, f in enumerate(q["option_feedback"])
        )
    system = _HELP_SYSTEM.format(
        qtype=q["type"].upper(), difficulty=q["difficulty"], marks=q.get("marks", 1), subtopic=q["subtopic"],
        stem=q["stem"], options=options, answer=_fmt_answer(q, q["answer"]), explanation=q["explanation"],
        feedback=feedback, response=_fmt_answer(q, r.response), verdict="correct" if r.is_correct else "incorrect",
    )
    history = [
        {"role": m["role"], "content": m["content"]}
        for m in messages[-_MAX_HISTORY_MESSAGES:]
        if m.get("role") in ("user", "assistant") and m.get("content")
    ]
    while history and history[0]["role"] != "user":
        history.pop(0)
    if not history or history[-1]["role"] != "user":
        raise _bad_request("The last message must be the student's question")
    yield from claude_client.stream_completion(system, history, max_tokens=1500)
