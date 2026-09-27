"""Knowledge-base tests: upload → ingest → search, plus visibility rules.

Embeddings and Claude are stubbed so tests are fast and never hit a model/API.
"""
from __future__ import annotations

import pytest

from app.services import claude_client, embeddings


def _headers(client, signup_payload, role: str) -> dict:
    r = client.post("/api/v1/auth/signup", json=signup_payload(role))
    assert r.status_code == 201, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def _fake_vector(text: str) -> list[float]:
    """Deterministic 384-dim bag-of-letters vector — similar texts score higher."""
    vec = [0.0] * 384
    for ch in text.lower():
        if ch.isalpha():
            vec[ord(ch) % 384] += 1.0
    return vec


@pytest.fixture(autouse=True)
def fake_models(monkeypatch):
    monkeypatch.setattr(embeddings, "is_available", lambda: True)
    monkeypatch.setattr(embeddings, "embed_text", _fake_vector)
    monkeypatch.setattr(embeddings, "embed_batch", lambda texts: [_fake_vector(t) for t in texts])
    monkeypatch.setattr(claude_client, "is_available", lambda: False)


def _upload(client, headers, name: str, body: str) -> dict:
    r = client.post(
        "/api/v1/documents/upload",
        files={"file": (name, body.encode(), "text/plain")},
        data={"title": name},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    return r.json()


def test_upload_ingests_and_is_searchable(client, signup_payload):
    teacher = _headers(client, signup_payload, "teacher")
    doc = _upload(client, teacher, "thermo.txt", "Entropy always increases in an isolated system. " * 20)

    # BackgroundTasks run before TestClient returns, so the doc is already processed.
    r = client.get(f"/api/v1/documents/{doc['id']}", headers=teacher)
    assert r.json()["processing_status"] == "ready"
    assert r.json()["chunk_count"] >= 1

    student = _headers(client, signup_payload, "student")
    r = client.post("/api/v1/documents/search", json={"query": "entropy"}, headers=student)
    assert r.status_code == 200
    assert r.json()["hits"][0]["document_id"] == doc["id"]


def test_student_uploads_are_private(client, signup_payload):
    alice = _headers(client, signup_payload, "student")
    bob = _headers(client, signup_payload, "student")
    doc = _upload(client, alice, "notes.txt", "my private notes on graphs " * 10)
    assert doc["owner_id"] is not None

    assert client.get(f"/api/v1/documents/{doc['id']}", headers=bob).status_code == 404
    assert all(d["id"] != doc["id"] for d in client.get("/api/v1/documents/", headers=bob).json())
    assert client.delete(f"/api/v1/documents/{doc['id']}", headers=bob).status_code == 404
    assert client.delete(f"/api/v1/documents/{doc['id']}", headers=alice).status_code == 204


def test_student_cannot_delete_shared_document(client, signup_payload):
    teacher = _headers(client, signup_payload, "teacher")
    student = _headers(client, signup_payload, "student")
    doc = _upload(client, teacher, "shared.txt", "shared material " * 10)
    assert client.delete(f"/api/v1/documents/{doc['id']}", headers=student).status_code == 403


def test_rejects_unsupported_extension(client, signup_payload):
    teacher = _headers(client, signup_payload, "teacher")
    r = client.post(
        "/api/v1/documents/upload",
        files={"file": ("virus.exe", b"MZ", "application/octet-stream")},
        headers=teacher,
    )
    assert r.status_code == 415
