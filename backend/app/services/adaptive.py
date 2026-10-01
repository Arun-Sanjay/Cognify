"""Adaptive practice engine — hierarchical Elo learner model + learning-optimal item selection.

Pure functions, no database access (quiz.py owns persistence). Evidence, sources
and which numbers are heuristics: docs/adaptive-learning-research.md (§3 is the spec
this file implements).

Learner model (Pelánek 2016; hierarchical skills as in Pelánek et al. 2017):

    θ_eff = θ_topic + θ_sub                         (logit scale)
    P     = c + (1 − c) · σ(θ_eff − d_i)            c = guessing floor by question type
    err   = correct − P
    θ_sub   += K_sub · err        K_sub   = max(U(n_sub_eff), 0.15)
    θ_topic += K_topic · err      K_topic = 0.5 · max(U(n_topic_eff), 0.10)
    d_i     −= U(n_i + 10) · err  only on the student's FIRST answer to the item
    U(n)  = 1 / (1 + 0.05 n)      n_eff = n · 0.5^(days idle / 30)

Selection (Papoušek et al. 2014 scoring, extended): pick a subtopic weighted by
weakness + uncertainty (never more than 2 in a row from one subtopic), then the
item whose predicted success is closest to the target (0.70; 0.80 for a 3-item
warm-up), preferring items not seen recently / often. Missed items come back
later in the session and on an expanding schedule (+1, +3, +7 days, …).
"""
from __future__ import annotations

import math
import random
from collections.abc import Sequence
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone

# ── Tunables ───────────────────────────────────────────────────

# Author difficulty 1–5 → initial item difficulty d₀ (logit). θ=0 learner on a NAT
# item: P = 0.88 / 0.73 / 0.50 / 0.27 / 0.12.
INITIAL_DIFFICULTY = {1: -2.0, 2: -1.0, 3: 0.0, 4: 1.0, 5: 2.0}
ITEM_PSEUDO_COUNT = 10  # the author's rating is worth ~10 answers

U_ALPHA, U_BETA = 1.0, 0.05  # Pelánek 2016
K_SUB_FLOOR = 0.15
K_TOPIC_FLOOR = 0.10
K_TOPIC_SCALE = 0.5
REPEAT_SCALE = 0.5  # repeats measure memory as much as skill
IDLE_HALF_LIFE_DAYS = 30.0
THETA_CLAMP = 4.0
D_CLAMP = 3.5

# Guessing floor c: 1/4 for 4-option MCQ; 1/15 for MSQ (random non-empty subset of 4); 0 for NAT.
GUESS = {"mcq": 0.25, "msq": 0.07, "nat": 0.0}

# Target success rate by the student's chosen setting (research §1.3 / §3.5).
TARGETS = {"challenge": 0.60, "balanced": 0.70, "confidence": 0.80}
WARMUP_TARGET = 0.80
WARMUP_ITEMS = 3
TARGET_MIN, TARGET_MAX = 0.60, 0.85
P_WINDOW = (0.35, 0.95)  # items predicted outside this are skipped unless nothing else is left

# Item score weights (Papoušek-style, rescaled to an items-based clock — need tuning).
W_PROB, W_TIME, W_COUNT, W_TYPE, W_RAND = 10.0, 3.0, 2.0, 0.1, 0.05
MAX_SAME_SUBTOPIC_RUN = 2
D_REF = INITIAL_DIFFICULTY[4]  # "a GATE 2-mark question"

# Spaced retrieval.
RETRY_GAP = (5, 8)  # a missed item returns after 5–8 other items in the same session
REVIEW_SHARE = 0.3  # chance to serve a due review (and its cap as a share of the session)
REVIEW_DAYS = (1, 3, 7)  # then max(7, 15% of the days left until the exam)
CORRECT_COOLDOWN_DAYS = 7  # an item answered right isn't re-served for a week
GRADUATE_AFTER_REVIEWS = 4

# Mastery.
MASTERY_MIN_ATTEMPTS = 12
MASTERY_P = 0.80


def sigmoid(x: float) -> float:
    if x >= 0:
        return 1.0 / (1.0 + math.exp(-x))
    z = math.exp(x)
    return z / (1.0 + z)


def uncertainty(n: float) -> float:
    return U_ALPHA / (1.0 + U_BETA * max(0.0, n))


def guess_floor(qtype: str) -> float:
    return GUESS.get(qtype, 0.0)


def p_correct(theta: float, difficulty: float, qtype: str = "nat") -> float:
    c = guess_floor(qtype)
    return c + (1.0 - c) * sigmoid(theta - difficulty)


def readiness(theta: float) -> float:
    """0–100: predicted % of GATE 2-mark (rating-4) numerical questions answered right."""
    return 100.0 * sigmoid(theta - D_REF)


def _clamp(x: float, bound: float) -> float:
    return max(-bound, min(bound, x))


def _utc(dt: datetime | None) -> datetime | None:
    if dt is not None and dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


@dataclass
class SkillState:
    rating: float = 0.0
    attempts: int = 0
    last_at: datetime | None = None

    def n_eff(self, now: datetime) -> float:
        last = _utc(self.last_at)
        if last is None:
            return float(self.attempts)
        idle_days = max(0.0, (now - last).total_seconds() / 86400)
        return self.attempts * 0.5 ** (idle_days / IDLE_HALF_LIFE_DAYS)


@dataclass
class Update:
    p_expected: float
    skill_before: float  # θ_eff before
    skill_after: float
    topic: SkillState
    subtopic: SkillState
    item_difficulty: float
    item_updated: bool


def update(
    *,
    topic: SkillState,
    subtopic: SkillState,
    item_difficulty: float,
    item_attempts: int,
    qtype: str,
    correct: bool,
    first_attempt: bool,
    now: datetime | None = None,
) -> Update:
    """One Elo step for one answer. Returns new states; inputs are not modified."""
    now = now or datetime.now(timezone.utc)
    theta = topic.rating + subtopic.rating
    p = p_correct(theta, item_difficulty, qtype)
    err = (1.0 if correct else 0.0) - p
    scale = 1.0 if first_attempt else REPEAT_SCALE
    k_sub = max(uncertainty(subtopic.n_eff(now)), K_SUB_FLOOR) * scale
    k_topic = K_TOPIC_SCALE * max(uncertainty(topic.n_eff(now)), K_TOPIC_FLOOR) * scale
    new_sub = SkillState(_clamp(subtopic.rating + k_sub * err, THETA_CLAMP), subtopic.attempts + 1, now)
    new_topic = SkillState(_clamp(topic.rating + k_topic * err, THETA_CLAMP), topic.attempts + 1, now)
    new_d = item_difficulty
    if first_attempt:
        new_d = _clamp(item_difficulty - uncertainty(item_attempts + ITEM_PSEUDO_COUNT) * err, D_CLAMP)
    return Update(
        p_expected=p,
        skill_before=theta,
        skill_after=_clamp(new_topic.rating + new_sub.rating, THETA_CLAMP),
        topic=new_topic,
        subtopic=new_sub,
        item_difficulty=new_d,
        item_updated=first_attempt,
    )


# ── Spaced review schedule ─────────────────────────────────────


@dataclass
class Answer:
    """One past answer by this student (any session), oldest first."""
    question_id: str
    correct: bool
    at: datetime
    attempt_id: str


def review_due_at(history: Sequence[Answer], exam_date: date | None, now: datetime) -> datetime | None:
    """When a missed item is next due for review (None = not in review).

    After a miss the item is reviewed at +1, +3, +7 days, then every
    max(7, 15% of the days left until the exam); a miss resets the ladder and
    GRADUATE_AFTER_REVIEWS correct reviews take it off the schedule."""
    last_miss = max((i for i, a in enumerate(history) if not a.correct), default=None)
    if last_miss is None:
        return None
    step = sum(1 for a in history[last_miss + 1:] if a.correct)
    if step >= GRADUATE_AFTER_REVIEWS:
        return None
    if step < len(REVIEW_DAYS):
        gap = REVIEW_DAYS[step]
    else:
        days_left = (exam_date - now.date()).days if exam_date else 60
        gap = max(7, int(0.15 * max(days_left, 0)))
    return _utc(history[-1].at) + timedelta(days=gap)


# ── Selection ──────────────────────────────────────────────────


@dataclass
class Candidate:
    id: str
    subtopic: str
    qtype: str
    difficulty: float  # current learned d
    times_seen: int = 0
    items_since_seen: int | None = None  # this student's answers since it was last shown
    correct_recently: bool = False  # answered right within the cooldown
    review_due: bool = False  # cross-session spaced review is due
    retry_due: bool = False  # missed earlier in this session and the gap has passed


@dataclass
class SessionState:
    """What has happened in the current session (oldest first)."""
    subtopics: list[str] = field(default_factory=list)
    qtypes: list[str] = field(default_factory=list)
    correct: list[bool] = field(default_factory=list)
    reviews_served: int = 0
    length: int = 10


def current_target(setting: str, session: SessionState) -> float:
    if len(session.correct) < WARMUP_ITEMS:
        return WARMUP_TARGET
    target = TARGETS.get(setting, TARGETS["balanced"])
    recent = session.correct[-10:]
    if len(recent) >= 5:
        realised = sum(recent) / len(recent)
        # Closed loop: if the student is doing much better/worse than intended, nudge.
        if realised > target + 0.10:
            target -= 0.05
        elif realised < target - 0.10:
            target += 0.05
    return min(TARGET_MAX, max(TARGET_MIN, target))


def _prob_score(p: float, target: float) -> float:
    return p / target if p <= target else (1 - p) / (1 - target)


def choose_next(
    candidates: Sequence[Candidate],
    *,
    topic_theta: dict[str, float],
    sub_skill: dict[str, SkillState],
    topic_of: dict[str, str],
    session: SessionState,
    setting: str = "balanced",
    now: datetime | None = None,
    rng: random.Random | None = None,
) -> tuple[Candidate, float, bool] | None:
    """Pick the next question → (candidate, predicted P(correct), is_review) or None."""
    if not candidates:
        return None
    rng = rng or random.Random()
    now = now or datetime.now(timezone.utc)

    def theta(sub: str) -> float:
        return topic_theta.get(topic_of.get(sub, ""), 0.0) + sub_skill.get(sub, SkillState()).rating

    def p_of(c: Candidate) -> float:
        return p_correct(theta(c.subtopic), c.difficulty, c.qtype)

    # Interleaving: block a third consecutive item from the same subtopic.
    blocked = None
    run = session.subtopics[-MAX_SAME_SUBTOPIC_RUN:]
    if len(run) == MAX_SAME_SUBTOPIC_RUN and len(set(run)) == 1:
        blocked = run[0]
    pool = [c for c in candidates if c.subtopic != blocked] or list(candidates)

    # Step 0: spaced retrieval — a missed item due again.
    reviews = [c for c in pool if c.retry_due or c.review_due]
    if reviews and session.reviews_served < max(1, int(REVIEW_SHARE * session.length)) and rng.random() < REVIEW_SHARE:
        pick = sorted(reviews, key=lambda c: (not c.retry_due, rng.random()))[0]
        return pick, p_of(pick), True

    fresh = [c for c in pool if not c.correct_recently and not c.retry_due] or pool
    target = current_target(setting, session)

    # Step 1: subtopic, weighted by weakness + uncertainty.
    subs = sorted({c.subtopic for c in fresh})
    weights = []
    for s in subs:
        state = sub_skill.get(s, SkillState())
        weights.append((1 - sigmoid(theta(s) - D_REF)) + 0.5 * uncertainty(state.n_eff(now)))
    chosen_sub = rng.choices(subs, weights=weights, k=1)[0] if len(subs) > 1 else subs[0]
    in_sub = [c for c in fresh if c.subtopic == chosen_sub]
    lo, hi = P_WINDOW
    windowed = [c for c in in_sub if lo <= p_of(c) <= hi] or in_sub

    # Step 2: item score.
    last_type = session.qtypes[-1] if session.qtypes else None
    best: tuple[float, Candidate, float] | None = None
    for c in windowed:
        p = p_of(c)
        s_time = -1.0 / max(c.items_since_seen, 1) if c.items_since_seen is not None else 0.0
        s_count = 1.0 / math.sqrt(1 + c.times_seen)
        s_type = 0.1 if last_type and c.qtype != last_type else 0.0
        score = W_PROB * _prob_score(p, target) + W_TIME * s_time + W_COUNT * s_count + W_TYPE * s_type
        score += W_RAND * rng.random()
        if best is None or score > best[0]:
            best = (score, c, p)
    assert best is not None
    return best[1], best[2], False


# ── Mastery ────────────────────────────────────────────────────


def mastery(
    theta: float,
    attempts: int,
    recent: Sequence[Answer] = (),
    had_delayed_review: bool = False,
    spans_days: bool = False,
) -> dict:
    """Mastery level for one subtopic.

    mastered = ≥12 answers, readiness ≥ 80, ≥4 of the last 5 right, and proof of
    retention: a correct review ≥1 day after a miss (or, with no misses to review,
    correct answers on at least two different days)."""
    ready = readiness(theta)
    last5 = list(recent)[-5:]
    if attempts == 0:
        level = "new"
    elif (
        attempts >= MASTERY_MIN_ATTEMPTS
        and ready >= 100 * MASTERY_P
        and sum(a.correct for a in last5) >= 4
        and (had_delayed_review or spans_days)
    ):
        level = "mastered"
    elif attempts >= 5 and ready >= 50:
        level = "proficient"
    else:
        level = "learning"
    return {
        "level": level,
        "readiness": round(ready, 1),
        "uncertainty": round(uncertainty(attempts), 3),
    }
