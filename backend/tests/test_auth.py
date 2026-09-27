"""Auth flow tests: signup, login, /me, role guards."""
from __future__ import annotations


def auth_headers(client, role: str, signup_payload) -> tuple[dict, dict]:
    """Sign up a user with the given role and return (auth_headers, user_obj)."""
    payload = signup_payload(role)
    r = client.post("/api/v1/auth/signup", json=payload)
    assert r.status_code in (200, 201), r.text
    data = r.json()
    return {"Authorization": f"Bearer {data['access_token']}"}, data["user"]


def test_signup_returns_token_and_user(client, signup_payload):
    payload = signup_payload("student")
    r = client.post("/api/v1/auth/signup", json=payload)
    assert r.status_code in (200, 201)
    body = r.json()
    assert body["access_token"]
    assert body["user"]["email"] == payload["email"]
    assert body["user"]["role"] == "student"


def test_login_after_signup(client, signup_payload):
    payload = signup_payload("teacher")
    client.post("/api/v1/auth/signup", json=payload)
    r = client.post(
        "/api/v1/auth/login",
        json={"email": payload["email"], "password": payload["password"]},
    )
    assert r.status_code == 200, r.text
    assert r.json()["access_token"]


def test_login_wrong_password_rejected(client, signup_payload):
    payload = signup_payload("student")
    client.post("/api/v1/auth/signup", json=payload)
    r = client.post(
        "/api/v1/auth/login",
        json={"email": payload["email"], "password": "WrongPass1"},
    )
    assert r.status_code == 401


def test_me_returns_current_user(client, signup_payload):
    headers, user = auth_headers(client, "student", signup_payload)
    r = client.get("/api/v1/auth/me", headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert body["email"] == user["email"]
    assert body["role"] == "student"


def test_me_requires_auth(client):
    r = client.get("/api/v1/auth/me")
    assert r.status_code == 401


def test_student_blocked_from_admin_users(client, signup_payload):
    headers, _ = auth_headers(client, "student", signup_payload)
    r = client.get("/api/v1/admin/users", headers=headers)
    assert r.status_code == 403


def test_login_with_username(client, signup_payload):
    payload = signup_payload("student")
    client.post("/api/v1/auth/signup", json=payload)
    r = client.post(
        "/api/v1/auth/login",
        json={"identifier": payload["username"], "password": payload["password"]},
    )
    assert r.status_code == 200, r.text


def test_admin_can_list_and_deactivate_users(client, signup_payload):
    admin_headers, _ = auth_headers(client, "admin", signup_payload)
    _, student = auth_headers(client, "student", signup_payload)

    r = client.get("/api/v1/admin/users?role=student", headers=admin_headers)
    assert r.status_code == 200
    assert any(u["id"] == student["id"] for u in r.json()["items"])

    r = client.patch(
        f"/api/v1/admin/users/{student['id']}", json={"is_active": False}, headers=admin_headers
    )
    assert r.status_code == 200
    assert r.json()["is_active"] is False

    r = client.get("/api/v1/admin/stats", headers=admin_headers)
    assert r.status_code == 200
    assert r.json()["students"] >= 1
