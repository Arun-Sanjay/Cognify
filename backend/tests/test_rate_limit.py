"""Per-user Claude rate-limit tests (Phase 21 cost guardrail).

The `claude_rate_limit` dependency is wired on every Claude-touching
endpoint. We test the helper itself (since exercising it through the
real endpoints would require mocking out the underlying AI services)
plus one route-level smoke test against the quiz-generate endpoint to
confirm the dependency is actually attached.
"""
from __future__ import annotations

import time
import uuid

import pytest

from app.api import deps
from app.core.config import get_settings


@pytest.fixture(autouse=True)
def _reset_buckets():
    deps._reset_claude_buckets_for_tests()
    yield
    deps._reset_claude_buckets_for_tests()


def test_first_call_is_allowed():
    user_id = uuid.uuid4()
    assert deps._consume_claude_token(user_id) is True


def test_burst_up_to_rate_then_429():
    """Bucket starts at full capacity = rate. After `rate` calls in
    a single tick, the next call is rejected."""
    settings = get_settings()
    rate = settings.claude_requests_per_minute
    user_id = uuid.uuid4()
    for i in range(rate):
        assert deps._consume_claude_token(user_id) is True, f"call {i + 1} should pass"
    # Bucket should now be drained (or nearly so — the refill between
    # iterations is in microseconds at this rate).
    assert deps._consume_claude_token(user_id) is False


def test_bucket_refills_over_time():
    """After waiting > 60/rate seconds we get at least one token back."""
    settings = get_settings()
    rate = settings.claude_requests_per_minute
    user_id = uuid.uuid4()
    # Drain.
    for _ in range(rate):
        deps._consume_claude_token(user_id)
    assert deps._consume_claude_token(user_id) is False
    # Wait long enough for one token to drip back. At rate=20, that's 3s.
    # We only need a tiny fraction of a token, so 0.5s is plenty for a unit test.
    refill_time = 60.0 / rate + 0.1
    time.sleep(refill_time)
    assert deps._consume_claude_token(user_id) is True


def test_separate_users_have_separate_buckets():
    settings = get_settings()
    rate = settings.claude_requests_per_minute
    user_a = uuid.uuid4()
    user_b = uuid.uuid4()
    for _ in range(rate):
        deps._consume_claude_token(user_a)
    # A is drained — but B should still have full bucket.
    assert deps._consume_claude_token(user_a) is False
    assert deps._consume_claude_token(user_b) is True


def test_chat_message_route_is_rate_limited(client, signup_payload, monkeypatch):
    """Draining the bucket makes a Claude-touching route 429 before any AI call."""
    from app.services import ai_chat

    def _should_not_run(*args, **kwargs):  # noqa: ANN002, ANN003
        raise AssertionError("ai_chat reached past rate limit")

    monkeypatch.setattr(ai_chat, "answer_question_blocking", _should_not_run)

    r = client.post("/api/v1/auth/signup", json=signup_payload("student"))
    assert r.status_code in (200, 201)
    headers = {"Authorization": f"Bearer {r.json()['access_token']}"}
    user_id = uuid.UUID(r.json()["user"]["id"])

    session = client.post("/api/v1/chat/sessions", json={}, headers=headers)
    assert session.status_code == 201, session.text

    rate = get_settings().claude_requests_per_minute
    for _ in range(rate):
        deps._consume_claude_token(user_id)

    resp = client.post(
        f"/api/v1/chat/sessions/{session.json()['id']}/messages/blocking",
        json={"content": "hello"},
        headers=headers,
    )
    assert resp.status_code == 429, resp.text
    assert "Retry-After" in resp.headers
