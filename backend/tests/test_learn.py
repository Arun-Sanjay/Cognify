"""Tests for the Learn endpoints (catalog, unit outline, lecture, tutor).

Content is written to a temp directory per test; Claude is mocked.
"""
from __future__ import annotations

import json
from collections.abc import Iterator
from pathlib import Path

import pytest

from app.services import claude_client
from app.services import learn as learn_service


def _write(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data), encoding="utf-8")


@pytest.fixture()
def learn_content(tmp_path, monkeypatch) -> Path:
    _write(
        tmp_path / "catalog.json",
        {
            "subjects": [
                {
                    "id": "cs",
                    "code": "CS",
                    "name": "Computer Science",
                    "units": [
                        {"id": "os", "number": 8, "name": "Operating System", "available": True},
                        {"id": "toc", "number": 6, "name": "Theory of Computation", "available": False},
                    ],
                }
            ]
        },
    )
    _write(
        tmp_path / "cs" / "os" / "unit.json",
        {
            "name": "Operating System",
            "topics": [
                {"id": "t06", "number": 6, "title": "Deadlock", "lectures": ["vidHI", "vidEN", "missing"]},
            ],
        },
    )
    base = {
        "channel": "Chan",
        "duration_sec": 600,
        "transcript": {"source": "manual-en", "language": "en", "segments": [{"start": 0, "dur": 3, "text": "Deadlock is…"}]},
    }
    _write(
        tmp_path / "cs" / "os" / "lectures" / "vidHI.json",
        {
            **base,
            "id": "vidHI",
            "youtube_id": "vidHI",
            "title": "Deadlock (Hinglish)",
            "language": "hinglish",
            "notes": {"headline": "Deadlock basics", "slides": [{"id": "s1", "title": "Conditions", "image": "f_0001.jpg", "blocks": []}]},
        },
    )
    _write(
        tmp_path / "cs" / "os" / "lectures" / "vidEN.json",
        {**base, "id": "vidEN", "youtube_id": "vidEN", "title": "Deadlock (English)", "language": "english"},
    )
    monkeypatch.setattr(learn_service, "content_dir", lambda: tmp_path)
    learn_service.clear_cache()
    return tmp_path


@pytest.fixture()
def headers(client, signup_payload) -> dict:
    r = client.post("/api/v1/auth/signup", json=signup_payload("student"))
    assert r.status_code in (200, 201), r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_learn_requires_auth(client, learn_content):
    assert client.get("/api/v1/learn/catalog").status_code == 401


def test_catalog_counts_only_available_units(client, headers, learn_content):
    r = client.get("/api/v1/learn/catalog", headers=headers)
    assert r.status_code == 200, r.text
    units = {u["id"]: u for u in r.json()["subjects"][0]["units"]}
    assert units["os"]["topic_count"] == 1
    assert units["os"]["lecture_count"] == 3  # counts listed ids, even ones without content yet
    assert units["toc"]["available"] is False and units["toc"]["lecture_count"] == 0


def test_unit_outline_skips_missing_lectures(client, headers, learn_content):
    r = client.get("/api/v1/learn/subjects/cs/units/os", headers=headers)
    assert r.status_code == 200, r.text
    lectures = r.json()["topics"][0]["lectures"]
    assert [l["id"] for l in lectures] == ["vidHI", "vidEN"]
    assert lectures[0]["has_notes"] is True and lectures[0]["headline"] == "Deadlock basics"
    assert lectures[1]["has_notes"] is False


def test_unknown_unit_and_bad_ids_404(client, headers, learn_content):
    assert client.get("/api/v1/learn/subjects/cs/units/nope", headers=headers).status_code == 404
    assert client.get("/api/v1/learn/subjects/cs/units/toc", headers=headers).status_code == 404  # no content
    assert client.get("/api/v1/learn/lectures/..%2Fcatalog", headers=headers).status_code == 404


def test_lecture_detail_rewrites_frame_urls(client, headers, learn_content):
    r = client.get("/api/v1/learn/lectures/vidHI", headers=headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["topic_id"] == "t06" and body["unit_id"] == "os"
    assert body["notes"]["slides"][0]["image"] == "/learn-media/vidHI/f_0001.jpg"
    assert body["transcript"]["segments"][0]["text"] == "Deadlock is…"


@pytest.fixture()
def fake_claude(monkeypatch):
    calls: list[dict] = []

    def _stub(system: str, messages: list[dict], *, max_tokens: int = 1024, temperature: float = 0.4) -> Iterator[str]:
        calls.append({"system": system, "messages": messages})
        yield "Tutor "
        yield "answer"

    monkeypatch.setattr(claude_client, "stream_completion", _stub)
    return calls


def test_tutor_streams_grounded_answer(client, headers, learn_content, fake_claude):
    r = client.post(
        "/api/v1/learn/lectures/vidHI/ask",
        json={"messages": [{"role": "user", "content": "What is deadlock?"}], "slide_id": "s1"},
        headers=headers,
    )
    assert r.status_code == 200, r.text
    assert r.text == "Tutor answer"
    system = fake_claude[0]["system"]
    assert "[00:00] Deadlock is…" in system  # transcript included
    assert '"Conditions"' in system and "Prioritise it" in system  # slide focus
    assert fake_claude[0]["messages"] == [{"role": "user", "content": "What is deadlock?"}]


def test_tutor_rejects_history_not_ending_with_question(client, headers, learn_content, fake_claude):
    r = client.post(
        "/api/v1/learn/lectures/vidHI/ask",
        json={"messages": [{"role": "user", "content": "hi"}, {"role": "assistant", "content": "hello"}]},
        headers=headers,
    )
    assert r.status_code == 400
    assert fake_claude == []


def test_tutor_unknown_lecture_404(client, headers, learn_content, fake_claude):
    r = client.post(
        "/api/v1/learn/lectures/nope/ask",
        json={"messages": [{"role": "user", "content": "hi"}]},
        headers=headers,
    )
    assert r.status_code == 404
