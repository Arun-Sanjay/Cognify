"""Tests for the per-message assistant `mode` field.

Covers:
- The request body accepts `mode` and persists it on the assistant row's
  `assistant_meta` JSON column.
- A garbage mode value is rejected (422).
- Omitting `mode` defaults to `explain`.
- The `select_system_prompt` helper picks the right prompt + token cap.

Claude is mocked so tests never hit the live API.
"""
from __future__ import annotations

from collections.abc import Iterator
from typing import Any

import pytest
from sqlalchemy import select

from app.models.chat import ChatMessage, MessageRole
from app.services import ai_chat
from app.services import claude_client


def _signup_student(client, signup_payload) -> dict:
    r = client.post("/api/v1/auth/signup", json=signup_payload("student"))
    assert r.status_code in (200, 201), r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def _create_session(client, headers) -> str:
    r = client.post("/api/v1/chat/sessions", json={"chat_type": "assistant"}, headers=headers)
    assert r.status_code in (200, 201), r.text
    return r.json()["id"]


@pytest.fixture()
def fake_claude(monkeypatch):
    """Replace `claude_client.stream_completion` with a deterministic stub."""

    def _stub(system: str, messages: list[dict], *, max_tokens: int = 1024, temperature: float = 0.4) -> Iterator[str]:
        # Echo the mode hint from the system prompt so tests can assert which
        # variant the helper picked. We just yield enough text that the route's
        # persistence path runs.
        if "RESPONSE STYLE — DIAGRAM" in system:
            yield "FAKE diagram answer"
        elif "RESPONSE STYLE — PRACTICE PROBLEMS" in system:
            yield "FAKE questions answer"
        else:
            yield "FAKE explain answer"

    monkeypatch.setattr(claude_client, "stream_completion", _stub)
    yield


# ──────────────────────────────────────────────────────────────────
# Pure helper — no DB / HTTP needed
# ──────────────────────────────────────────────────────────────────


def test_select_prompt_explain_default():
    prompt, max_tokens = ai_chat.select_system_prompt(None)
    assert "RESPONSE STYLE — EXPLANATION" in prompt
    assert max_tokens == ai_chat.MAX_TOKENS


def test_select_prompt_diagram_branch():
    prompt, max_tokens = ai_chat.select_system_prompt("diagram")
    assert "RESPONSE STYLE — DIAGRAM" in prompt
    assert max_tokens == ai_chat.MAX_TOKENS


def test_select_prompt_questions_uses_higher_token_cap():
    prompt, max_tokens = ai_chat.select_system_prompt("questions")
    assert "RESPONSE STYLE — PRACTICE PROBLEMS" in prompt
    assert max_tokens == ai_chat.QUESTIONS_MODE_MAX_TOKENS
    assert max_tokens > ai_chat.MAX_TOKENS


def test_select_prompt_unknown_mode_falls_back_to_explain():
    prompt, max_tokens = ai_chat.select_system_prompt("garbage")
    assert "RESPONSE STYLE — EXPLANATION" in prompt
    assert max_tokens == ai_chat.MAX_TOKENS


# ──────────────────────────────────────────────────────────────────
# HTTP integration — request validation + persistence
# ──────────────────────────────────────────────────────────────────


def test_blocking_message_accepts_explain_mode_and_persists_meta(
    client, signup_payload, fake_claude, db_session
):
    headers = _signup_student(client, signup_payload)
    session_id = _create_session(client, headers)

    r = client.post(
        f"/api/v1/chat/sessions/{session_id}/messages/blocking",
        json={"content": "What is Dijkstra?", "mode": "explain"},
        headers=headers,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["role"] == "assistant"
    assert body["mode"] == "explain"

    rows = db_session.scalars(
        select(ChatMessage)
        .where(ChatMessage.role == MessageRole.ASSISTANT)
        .order_by(ChatMessage.created_at.desc())
    ).all()
    assert rows, "expected at least one assistant message persisted"
    assert isinstance(rows[0].assistant_meta, dict)
    assert rows[0].assistant_meta.get("mode") == "explain"


def test_blocking_message_persists_questions_mode(
    client, signup_payload, fake_claude, db_session
):
    headers = _signup_student(client, signup_payload)
    session_id = _create_session(client, headers)

    r = client.post(
        f"/api/v1/chat/sessions/{session_id}/messages/blocking",
        json={"content": "Give me 2 problems on recurrence", "mode": "questions"},
        headers=headers,
    )
    assert r.status_code == 200, r.text
    assert r.json()["mode"] == "questions"

    last = db_session.scalars(
        select(ChatMessage)
        .where(ChatMessage.role == MessageRole.ASSISTANT)
        .order_by(ChatMessage.created_at.desc())
    ).first()
    assert last is not None
    assert last.assistant_meta == {"mode": "questions"}


def test_blocking_message_default_mode_is_explain(
    client, signup_payload, fake_claude, db_session
):
    headers = _signup_student(client, signup_payload)
    session_id = _create_session(client, headers)

    # Omit `mode` entirely — schema default kicks in.
    r = client.post(
        f"/api/v1/chat/sessions/{session_id}/messages/blocking",
        json={"content": "Hello"},
        headers=headers,
    )
    assert r.status_code == 200, r.text
    assert r.json()["mode"] == "explain"


def test_blocking_message_rejects_garbage_mode(client, signup_payload):
    headers = _signup_student(client, signup_payload)
    session_id = _create_session(client, headers)

    r = client.post(
        f"/api/v1/chat/sessions/{session_id}/messages/blocking",
        json={"content": "Hello", "mode": "freeform"},
        headers=headers,
    )
    assert r.status_code == 422


def test_get_session_returns_mode_on_history(
    client, signup_payload, fake_claude, db_session
):
    """Round-trip: send → GET /sessions/{id} → mode comes back on each message."""
    headers = _signup_student(client, signup_payload)
    session_id = _create_session(client, headers)

    client.post(
        f"/api/v1/chat/sessions/{session_id}/messages/blocking",
        json={"content": "Explain X", "mode": "explain"},
        headers=headers,
    )
    client.post(
        f"/api/v1/chat/sessions/{session_id}/messages/blocking",
        json={"content": "Diagram Y", "mode": "diagram"},
        headers=headers,
    )

    r = client.get(f"/api/v1/chat/sessions/{session_id}", headers=headers)
    assert r.status_code == 200
    body: dict[str, Any] = r.json()
    assistant_modes = [m["mode"] for m in body["messages"] if m["role"] == "assistant"]
    assert assistant_modes == ["explain", "diagram"]
