"""Shared Claude (Anthropic) API wrapper.

Every Claude call in the app goes through here (document summaries, RAG chat,
and whatever features come next).

Cost management rule:
    - ALL dev/testing uses the dev model (`anthropic_model_dev`)
    - Only production/demo flips USE_PRODUCTION_MODEL=true to the prod model
"""
from __future__ import annotations

import base64
import logging
from collections.abc import Iterator
from functools import lru_cache
from pathlib import Path

import anthropic

from app.core.config import get_settings

logger = logging.getLogger(__name__)

# Anthropic limits: ~5 MB/image, up to ~100 images/request. Stay well under so
# answer-sheet grading never trips a 413.
MAX_IMAGES_PER_VISION_CALL = 8
MAX_IMAGE_BYTES = 4 * 1024 * 1024

_IMAGE_MAGIC: list[tuple[bytes, str]] = [
    (b"\x89PNG\r\n\x1a\n", "image/png"),
    (b"\xff\xd8\xff", "image/jpeg"),
    (b"GIF87a", "image/gif"),
    (b"GIF89a", "image/gif"),
]


def _sniff_media_type(data: bytes, default: str = "image/png") -> str:
    """Best-effort image MIME sniff from magic bytes (no Pillow)."""
    for magic, media_type in _IMAGE_MAGIC:
        if data.startswith(magic):
            return media_type
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return default


@lru_cache(maxsize=1)
def _get_client() -> anthropic.Anthropic | None:
    """Return a cached Anthropic client, or None if the key isn't set."""
    settings = get_settings()
    if not settings.anthropic_api_key:
        return None
    return anthropic.Anthropic(api_key=settings.anthropic_api_key)


def is_available() -> bool:
    """Whether Claude API calls can succeed (i.e. the key is configured)."""
    return _get_client() is not None


def generate_completion(
    system: str,
    user_message: str,
    *,
    max_tokens: int = 1024,
    temperature: float = 0.3,
) -> str:
    """Run a single-turn completion. Returns the text content, or "" on failure.

    Errors are logged but never raised — the caller decides whether missing
    output is fatal (e.g. summary generation is best-effort).
    """
    client = _get_client()
    if client is None:
        logger.info("Claude client not configured — skipping completion")
        return ""

    settings = get_settings()
    model = settings.active_anthropic_model  # haiku for dev, opus for demo

    try:
        response = client.messages.create(
            model=model,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system,
            messages=[{"role": "user", "content": user_message}],
        )
    except anthropic.APIError as e:
        logger.exception("Claude API error: %s", e)
        return ""
    except Exception as e:
        logger.exception("Unexpected Claude error: %s", e)
        return ""

    # Pull the first text block
    if not response.content:
        return ""
    parts: list[str] = []
    for block in response.content:
        if getattr(block, "type", None) == "text":
            parts.append(getattr(block, "text", ""))
    return "".join(parts).strip()


def generate_completion_multiturn(
    system: str,
    messages: list[dict],
    *,
    max_tokens: int = 1024,
    temperature: float = 0.3,
) -> str:
    """Multi-turn blocking completion. Takes a full conversation history in
    Claude's chat format (alternating user/assistant turns). Returns the
    assistant's next message text, or "" on failure.

    Use this when you need Claude to remember previous turns but don't care
    about streaming — e.g. the Resume Coach, which needs conversation memory
    to avoid asking the same questions twice.
    """
    client = _get_client()
    if client is None:
        logger.info("Claude client not configured — skipping multiturn completion")
        return ""

    if not messages:
        return ""

    settings = get_settings()
    model = settings.active_anthropic_model

    # Claude requires alternating user/assistant, starting with user
    cleaned: list[dict] = []
    for m in messages:
        role = m.get("role")
        content = m.get("content")
        if role not in ("user", "assistant") or not content:
            continue
        cleaned.append({"role": role, "content": content})
    if not cleaned or cleaned[0]["role"] != "user":
        return ""

    try:
        response = client.messages.create(
            model=model,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system,
            messages=cleaned,
        )
    except anthropic.APIError as e:
        logger.exception("Claude multiturn API error: %s", e)
        return ""
    except Exception as e:
        logger.exception("Unexpected Claude multiturn error: %s", e)
        return ""

    if not response.content:
        return ""
    parts: list[str] = []
    for block in response.content:
        if getattr(block, "type", None) == "text":
            parts.append(getattr(block, "text", ""))
    return "".join(parts).strip()


def stream_completion(
    system: str,
    messages: list[dict],
    *,
    max_tokens: int = 1024,
    temperature: float = 0.4,
) -> Iterator[str]:
    """Stream Claude's response as text deltas.

    `messages` is a list of {role, content} dicts in Claude's chat format.
    Yields plain string chunks suitable for SSE / chunked HTTP.

    If the API key is missing or an error occurs, yields a single fallback
    string explaining the situation — never raises.
    """
    client = _get_client()
    if client is None:
        yield "[AI is not configured. Set ANTHROPIC_API_KEY in backend/.env to enable streaming responses.]"
        return

    settings = get_settings()
    model = settings.active_anthropic_model

    try:
        with client.messages.stream(
            model=model,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system,
            messages=messages,
        ) as stream:
            for text in stream.text_stream:
                if text:
                    yield text
    except anthropic.APIError as e:
        logger.exception("Claude streaming error: %s", e)
        yield f"\n\n[An error occurred while talking to the AI: {e}]"
    except Exception as e:
        logger.exception("Unexpected Claude streaming error: %s", e)
        yield f"\n\n[Unexpected error: {e}]"


def generate_completion_vision(
    system: str,
    text: str,
    images: list[bytes | str | Path],
    *,
    max_tokens: int = 2048,
    temperature: float = 0.2,
    media_type_default: str = "image/png",
) -> str:
    """Single-turn vision completion: a text prompt plus N images.

    Each image may be raw bytes or a filesystem path. Oversized images
    (> MAX_IMAGE_BYTES) are skipped and logged; at most
    MAX_IMAGES_PER_VISION_CALL images are sent. Mirrors generate_completion's
    model selection (active_anthropic_model) and graceful degradation — returns
    "" on missing key / error, never raises. Used by the answer-sheet OCR+grader.
    """
    client = _get_client()
    if client is None:
        logger.info("Claude client not configured — skipping vision completion")
        return ""

    content: list[dict] = [{"type": "text", "text": text}]
    used = 0
    for img in images:
        if used >= MAX_IMAGES_PER_VISION_CALL:
            logger.warning("vision: capping at %d images (got more)", MAX_IMAGES_PER_VISION_CALL)
            break
        try:
            data = Path(img).read_bytes() if isinstance(img, (str, Path)) else bytes(img)
        except Exception as e:  # noqa: BLE001
            logger.warning("vision: could not read image: %s", e)
            continue
        if not data:
            continue
        if len(data) > MAX_IMAGE_BYTES:
            logger.warning("vision: skipping oversize image (%d bytes)", len(data))
            continue
        content.append(
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": _sniff_media_type(data, media_type_default),
                    "data": base64.standard_b64encode(data).decode("ascii"),
                },
            }
        )
        used += 1

    settings = get_settings()
    model = settings.active_anthropic_model

    try:
        response = client.messages.create(
            model=model,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system,
            messages=[{"role": "user", "content": content}],
        )
    except anthropic.APIError as e:
        logger.exception("Claude vision API error: %s", e)
        return ""
    except Exception as e:  # noqa: BLE001
        logger.exception("Unexpected Claude vision error: %s", e)
        return ""

    if not response.content:
        return ""
    parts: list[str] = []
    for block in response.content:
        if getattr(block, "type", None) == "text":
            parts.append(getattr(block, "text", ""))
    return "".join(parts).strip()


# ═══════════════════════════════════════════════════════════════
# Document summary helper
# ═══════════════════════════════════════════════════════════════

SUMMARY_SYSTEM_PROMPT = """You are a helpful teaching assistant for engineering students.
When given the text of a course document, produce a concise summary suitable for
students reviewing before an exam. Follow these rules:
- 3-5 short paragraphs
- Plain prose, no markdown headers or lists
- Focus on the key concepts, definitions, and anything a student should remember
- Use simple language, avoid jargon when possible
- Do NOT start with phrases like "This document discusses..." — dive straight in"""


def summarize_document(text: str, max_input_chars: int = 12_000) -> str:
    """Generate a short summary of a document's text content.

    Truncates to `max_input_chars` to keep cost bounded. Returns empty string
    if the API key is not set or if the call fails.
    """
    if not text.strip():
        return ""

    truncated = text if len(text) <= max_input_chars else text[:max_input_chars]
    user_message = (
        f"Here is the content of a course document. Write a summary for students.\n\n"
        f"---\n{truncated}\n---"
    )
    return generate_completion(
        system=SUMMARY_SYSTEM_PROMPT,
        user_message=user_message,
        max_tokens=800,
        temperature=0.4,
    )
