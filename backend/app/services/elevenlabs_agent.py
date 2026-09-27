"""ElevenLabs Conversational AI (Agents) — REST helpers for real-time voice.

A real-time browser↔agent voice conversation is handled entirely by ElevenLabs
(VAD + streaming ASR + LLM + TTS). The browser connects with the
`@elevenlabs/react` SDK using a short-lived **signed URL** that we mint here (so
the `xi-api-key` never reaches the client). After a conversation ends, fetch
its transcript with `get_conversation` / `poll_conversation_until_done`.

Everything here is best-effort and **never raises**: each call returns a clean
sentinel (`None` / `""` / `[]`) and logs the cause, matching the rest of the
external-service layer (`speech.py`, `claude_client.py`). 

Endpoints used (base `https://api.elevenlabs.io`, auth header `xi-api-key`):
  GET  /v1/convai/conversation/get-signed-url?agent_id=...   → { signed_url }
  GET  /v1/convai/conversations/{conversation_id}            → transcript + status
  GET  /v1/convai/agents?...                                 → list (provisioning)
  POST /v1/convai/agents/create                              → { agent_id }
  GET  /v1/convai/agents/{agent_id}                          → agent
  PATCH/v1/convai/agents/{agent_id}                          → agent
"""
from __future__ import annotations

import logging
import time
from typing import Any

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)

# Conversation post-processing (final transcript + analysis) runs *after* the
# call disconnects, so the GET conversation endpoint returns status
# "processing" for a short while. We poll until it reaches a terminal state.
_TERMINAL_STATUSES = {"done", "failed"}
_DEFAULT_POLL_TIMEOUT_S = 90.0
_DEFAULT_POLL_INTERVAL_S = 3.0
_HTTP_TIMEOUT_S = 20.0


def is_configured() -> bool:
    """True when both the API key and a target agent id are set."""
    return get_settings().conversational_agent_available


def _headers() -> dict[str, str]:
    return {"xi-api-key": get_settings().elevenlabs_api_key}


def _base() -> str:
    return get_settings().elevenlabs_api_base.rstrip("/")


# ════════════════════════════════════════════════════════════════
# Runtime: signed URL + transcript
# ════════════════════════════════════════════════════════════════


def get_signed_url(agent_id: str | None = None) -> str | None:
    """Mint a short-lived signed WebSocket URL for the agent.

    Returns the `wss://…&token=…` URL the browser passes to
    `conversation.startSession({ signedUrl })`, or None on any failure.
    """
    settings = get_settings()
    agent_id = agent_id or settings.elevenlabs_agent_id
    if not settings.elevenlabs_api_key or not agent_id:
        logger.info("ElevenLabs agent skipped: API key or agent id missing")
        return None
    try:
        resp = httpx.get(
            f"{_base()}/v1/convai/conversation/get-signed-url",
            params={"agent_id": agent_id},
            headers=_headers(),
            timeout=_HTTP_TIMEOUT_S,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:  # noqa: BLE001 - never raise to callers
        logger.exception("ElevenLabs get-signed-url failed: %s", e)
        return None
    url = data.get("signed_url")
    return url if isinstance(url, str) and url else None


def get_conversation(conversation_id: str) -> dict[str, Any] | None:
    """Fetch a conversation (transcript + status + analysis). None on failure."""
    if not conversation_id or not get_settings().elevenlabs_api_key:
        return None
    try:
        resp = httpx.get(
            f"{_base()}/v1/convai/conversations/{conversation_id}",
            headers=_headers(),
            timeout=_HTTP_TIMEOUT_S,
        )
        resp.raise_for_status()
        return resp.json()
    except Exception as e:  # noqa: BLE001
        logger.exception("ElevenLabs get-conversation failed: %s", e)
        return None


def poll_conversation_until_done(
    conversation_id: str,
    *,
    timeout_s: float = _DEFAULT_POLL_TIMEOUT_S,
    interval_s: float = _DEFAULT_POLL_INTERVAL_S,
) -> dict[str, Any] | None:
    """Poll the conversation until it reaches a terminal status.

    Returns the final conversation payload (status `done`/`failed`), the last
    payload seen if we time out (callers can still read a partial transcript),
    or None if we never got a payload at all. Runs in a BackgroundTask thread,
    so a blocking sleep is fine here.
    """
    deadline = time.monotonic() + timeout_s
    last: dict[str, Any] | None = None
    while True:
        convo = get_conversation(conversation_id)
        if convo is not None:
            last = convo
            if str(convo.get("status") or "").lower() in _TERMINAL_STATUSES:
                return convo
        if time.monotonic() >= deadline:
            if last is not None:
                logger.warning(
                    "ElevenLabs conversation %s not terminal after %.0fs (status=%s); "
                    "using partial transcript",
                    conversation_id,
                    timeout_s,
                    last.get("status"),
                )
            return last
        time.sleep(interval_s)


def extract_transcript_turns(convo: dict[str, Any] | None) -> list[dict[str, str]]:
    """Normalize an ElevenLabs conversation payload into ordered turns.

    ElevenLabs uses role `agent`/`user`; we map `agent`→`assistant` to match the
    transcript model. Empty/whitespace messages (e.g. tool-only turns)
    are dropped.
    """
    if not convo:
        return []
    turns: list[dict[str, str]] = []
    for entry in convo.get("transcript") or []:
        if not isinstance(entry, dict):
            continue
        message = (entry.get("message") or "").strip()
        if not message:
            continue
        role = "assistant" if entry.get("role") == "agent" else "user"
        turns.append({"role": role, "content": message})
    return turns


# ════════════════════════════════════════════════════════════════
# Provisioning (used by scripts/provision_elevenlabs_agent.py)
# ════════════════════════════════════════════════════════════════


def list_agents(page_size: int = 100) -> list[dict[str, Any]]:
    """List agents in the account (for idempotent provisioning)."""
    if not get_settings().elevenlabs_api_key:
        return []
    try:
        resp = httpx.get(
            f"{_base()}/v1/convai/agents",
            params={"page_size": page_size},
            headers=_headers(),
            timeout=_HTTP_TIMEOUT_S,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:  # noqa: BLE001
        logger.exception("ElevenLabs list-agents failed: %s", e)
        return []
    agents = data.get("agents")
    return agents if isinstance(agents, list) else []


def create_agent(name: str, conversation_config: dict, platform_settings: dict) -> str | None:
    """Create an agent. Returns its agent_id, or None on failure."""
    if not get_settings().elevenlabs_api_key:
        return None
    body = {
        "name": name,
        "conversation_config": conversation_config,
        "platform_settings": platform_settings,
    }
    try:
        resp = httpx.post(
            f"{_base()}/v1/convai/agents/create",
            json=body,
            headers=_headers(),
            timeout=_HTTP_TIMEOUT_S,
        )
    except Exception as e:  # noqa: BLE001
        logger.exception("ElevenLabs create-agent request failed: %s", e)
        return None
    if resp.status_code >= 400:
        logger.error("ElevenLabs create-agent %s: %s", resp.status_code, resp.text[:800])
        return None
    return resp.json().get("agent_id")


def update_agent(agent_id: str, conversation_config: dict, platform_settings: dict) -> bool:
    """PATCH an existing agent's config + override allow-list. True on success."""
    if not get_settings().elevenlabs_api_key or not agent_id:
        return False
    body = {
        "conversation_config": conversation_config,
        "platform_settings": platform_settings,
    }
    try:
        resp = httpx.patch(
            f"{_base()}/v1/convai/agents/{agent_id}",
            json=body,
            headers=_headers(),
            timeout=_HTTP_TIMEOUT_S,
        )
    except Exception as e:  # noqa: BLE001
        logger.exception("ElevenLabs update-agent request failed: %s", e)
        return False
    if resp.status_code >= 400:
        logger.error("ElevenLabs update-agent %s: %s", resp.status_code, resp.text[:800])
        return False
    return True
