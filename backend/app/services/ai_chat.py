"""AI assistant — RAG over the knowledge base.

Pipeline for each user message:
    1. Retrieve top-K most semantically similar chunks from pgvector
    2. Build a system prompt that grounds Claude in those chunks
    3. Stream Claude's response to the caller
    4. Persist user message + assistant message + source citations after the
       stream completes
"""
from __future__ import annotations

import logging
import uuid
from collections.abc import Iterator
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.models.chat import ChatMessage, ChatSession, MessageRole
from app.models.user import User
from app.services import chat as chat_service
from app.services import claude_client, vector_search
from app.services.vector_search import SearchHit

logger = logging.getLogger(__name__)


# ── RAG configuration ──
TOP_K = 5
MAX_CHUNK_CHARS = 1500          # truncate any single chunk to keep prompt sane
MAX_HISTORY_MESSAGES = 8         # last N turns of conversation to keep
MAX_TOKENS = 1024                # default cap on Claude's response length
QUESTIONS_MODE_MAX_TOKENS = 1500  # solved problems with steps need more headroom


# Shared header for all three assistant modes — keeps the grounding +
# behavior rules consistent and lets each mode-specific tail focus only on
# response shape.
ASSISTANT_HEADER = """You are Cognify — an AI tutor that helps students understand their study material.

You are given the most relevant excerpts from the knowledge base below as CONTEXT. Use them to answer the student's question.

CRITICAL OUTPUT FORMAT RULES:
- Ground every claim in the provided context. If the answer isn't in the context, say so honestly.
- Use clear, conversational language — like a friendly senior explaining a topic.
- DO NOT mention "context" or "excerpts" — answer naturally.
- DO NOT invent facts that aren't in the context."""


EXPLAIN_MODE_TAIL = """RESPONSE STYLE — EXPLANATION:
- Lead with a one-sentence direct answer.
- Then expand in 2-4 short paragraphs, building intuition before formalism.
- Use H3 (###) for subsections only when the topic genuinely has 2+ subtopics.
- Use a bulleted list when (and only when) you have 3+ parallel items.
- Use inline code (`like_this`) for identifiers; fenced code blocks only for runnable snippets.
- DO NOT use any of these special fenced blocks: ```solved, ```unsolved, ```answer, ```mermaid. Those are for other modes.
- Aim for 150-400 words. Resist longer; cut hedging."""


DIAGRAM_MODE_TAIL = """RESPONSE STYLE — DIAGRAM + EXPLANATION:

You MUST produce exactly one Mermaid diagram followed by a short explanation.

OUTPUT TEMPLATE (follow exactly):

  <one-sentence intro: what the diagram shows>

  ```mermaid
  <valid Mermaid syntax — see DIAGRAM TYPES below>
  ```

  ### How to read this
  <2-3 short paragraphs walking through the diagram>

DIAGRAM TYPES — pick the one that fits the question:
- Flowchart (default for processes/algorithms): `flowchart TD` with `A[Step]`, `B{Decision}`, `A --> B`.
- Sequence diagram (for protocols/interactions): `sequenceDiagram` with `Alice->>Bob: msg`.
- State machine (for state-driven systems): `stateDiagram-v2` with `[*] --> S1` and `S1 --> S2 : event`.
- Class/ER (for data models): `classDiagram` or `erDiagram`.
- Graph (for graph algorithms / trees): `graph LR` with edges.

MERMAID RULES (strict — diagrams that violate these will fail to render):
- Always start with the diagram-type keyword on its own line.
- Node IDs must be alphanumeric; labels go in `[]` or `{}` or `()`.
- No HTML inside labels; escape special chars (`#35;` for `#`).
- Keep diagrams under 25 nodes — split into multiple if larger.
- DO NOT include the word "mermaid" inside the diagram itself.

If the question doesn't naturally lend itself to a visual, produce a tiny conceptual flowchart of "Topic -> Key Idea 1 / Key Idea 2 / Key Idea 3"."""


QUESTIONS_MODE_TAIL = """RESPONSE STYLE — PRACTICE PROBLEMS:

Parse the student's request to determine:
- How many problems they want (default: 3 if unspecified).
- Whether they want SOLVED, UNSOLVED, or BOTH (default: 2 solved + 1 unsolved).
- The topic/concept to test on.

OUTPUT FORMAT — produce one fenced block per problem, in order. The first line
inside each fence is a single-line JSON object with metadata; the rest is the
problem body.

For a SOLVED problem:
  ```solved
  {"index": 1, "problem": "<one-line problem statement>"}
  STEP 1 — <TITLE IN CAPS, e.g. "CHARACTERISTIC EQUATION">
  <body — math, derivation, plain prose>

  STEP 2 — <title>
  <body>

  STEP N — <title>
  <body>

  ANSWER
  <final boxed result, e.g. "x = 5">
  ```

For an UNSOLVED practice problem:
  ```unsolved
  {"index": 1, "problem": "<one-line problem statement>", "hint": "<one-line hint, hidden by default>"}
  <2-3 sentence intro: why this matters, what concept it tests>

  Steps to try:
  1. <hint at first step>
  2. <hint at second step>
  3. <hint at third step>
  ```

STRICT RULES:
- One fenced block per problem. Do not combine.
- The first line inside the fence MUST be a single-line valid JSON object with the
  fields shown above. No trailing comments. No multi-line JSON.
- Use STEP N — TITLE (uppercase, em-dash) headers inside solved problems — the
  renderer styles these specially.
- The ANSWER block must come last inside a solved problem.
- For unsolved problems, the `hint` field is hidden until the student clicks
  "Show hint" — keep it to one line.
- Between fenced blocks, put one blank line. No prose between blocks.
- Open with one short sentence (e.g. "Here are 3 problems on Dijkstra — 2 solved,
  1 for you to try.") then the fenced blocks.
- Do NOT nest fenced code blocks inside a solved/unsolved fence. If you need to
  show code, indent it 4 spaces instead.

If the student's request can't be parsed, ask one clarifying question instead of
producing problems."""


# Pre-composed full prompts so we don't re-concat on every request.
EXPLAIN_MODE_SYSTEM = f"{ASSISTANT_HEADER}\n\n{EXPLAIN_MODE_TAIL}"
DIAGRAM_MODE_SYSTEM = f"{ASSISTANT_HEADER}\n\n{DIAGRAM_MODE_TAIL}"
QUESTIONS_MODE_SYSTEM = f"{ASSISTANT_HEADER}\n\n{QUESTIONS_MODE_TAIL}"

def select_system_prompt(mode: str | None) -> tuple[str, int]:
    """Pick the system prompt + max-tokens budget for the requested mode.

    Unknown / missing modes fall back to Explain (the default behavior).
    """
    if mode == "diagram":
        return DIAGRAM_MODE_SYSTEM, MAX_TOKENS
    if mode == "questions":
        return QUESTIONS_MODE_SYSTEM, QUESTIONS_MODE_MAX_TOKENS
    return EXPLAIN_MODE_SYSTEM, MAX_TOKENS


@dataclass
class StreamedAnswer:
    """Final result captured after a streaming response completes."""

    text: str
    citations: list[dict]


def _format_chunks_as_context(hits: list[SearchHit]) -> str:
    """Render retrieved chunks as a numbered context block."""
    if not hits:
        return "(No relevant material was found in the knowledge base.)"

    parts: list[str] = []
    for i, hit in enumerate(hits, start=1):
        truncated = hit.chunk_text
        if len(truncated) > MAX_CHUNK_CHARS:
            truncated = truncated[:MAX_CHUNK_CHARS] + "…"
        parts.append(f"[{i}] {hit.document_title} (chunk {hit.chunk_index})\n{truncated}")
    return "\n\n---\n\n".join(parts)


def _citations_from_hits(hits: list[SearchHit]) -> list[dict]:
    """Compact citation records persisted alongside the assistant message."""
    return [
        {
            "document_id": str(hit.document_id),
            "document_title": hit.document_title,
            "chunk_index": hit.chunk_index,
            "similarity": round(hit.similarity, 4),
        }
        for hit in hits
    ]


def stream_rag_response(
    db: Session,
    *,
    user: User,
    session: ChatSession,
    user_message_text: str,
    mode: str | None = None,
) -> Iterator[str]:
    """Generator that:
    1. Retrieves the most relevant knowledge-base chunks
    2. Persists the user message
    3. Yields the assistant's response as text deltas
    4. Persists the assistant message + citations once the stream is exhausted

    The caller (route handler) wraps this in a StreamingResponse.
    """
    # ── 1. Retrieve ──
    hits = vector_search.search_chunks(
        db,
        query=user_message_text,
        user=user,
        document_id=session.document_id,
        top_k=TOP_K,
    )
    citations = _citations_from_hits(hits)
    context_block = _format_chunks_as_context(hits)

    # ── 2. Save the user message right away (before streaming) ──
    chat_service.add_message(db, session, MessageRole.USER, user_message_text)

    # ── 3. Build the prompt: system + recent history + new user turn ──
    base_prompt, max_tokens = select_system_prompt(mode)
    system_prompt = (
        f"{base_prompt}\n\n"
        f"=== RELEVANT MATERIAL FROM THE KNOWLEDGE BASE ===\n\n"
        f"{context_block}\n\n"
        f"=== END OF MATERIAL ==="
    )

    history_msgs = chat_service.list_messages(db, session)
    # Drop the just-added user message from history (it's re-added as the final turn)
    history_msgs = [m for m in history_msgs if m.id != _last_user_message_id(history_msgs)]
    history_msgs = history_msgs[-MAX_HISTORY_MESSAGES:]

    messages_for_claude: list[dict] = [
        {"role": m.role.value, "content": m.content}
        for m in history_msgs
        if m.role != MessageRole.SYSTEM
    ]
    messages_for_claude.append({"role": "user", "content": user_message_text})

    # ── 4. Stream, capturing the full text as we go ──
    full_text_parts: list[str] = []
    try:
        for delta in claude_client.stream_completion(
            system=system_prompt,
            messages=messages_for_claude,
            max_tokens=max_tokens,
            temperature=0.4,
        ):
            full_text_parts.append(delta)
            yield delta
    finally:
        # ── 5. Persist the assistant message even if the client disconnects ──
        full_text = "".join(full_text_parts).strip()
        if full_text:
            chat_service.add_message(
                db,
                session,
                MessageRole.ASSISTANT,
                full_text,
                source_citations=citations,
                assistant_meta={"mode": mode or "explain"},
            )


def _last_user_message_id(messages: list[ChatMessage]) -> uuid.UUID | None:
    """Return the id of the most recent user message in `messages`."""
    for m in reversed(messages):
        if m.role == MessageRole.USER:
            return m.id
    return None


def answer_question_blocking(
    db: Session,
    *,
    user: User,
    session: ChatSession,
    user_message_text: str,
    mode: str | None = None,
) -> StreamedAnswer:
    """Non-streaming convenience wrapper. Used by tests + frontends that don't
    want to bother with chunked transfer encoding."""
    text_parts: list[str] = []
    for delta in stream_rag_response(
        db,
        user=user,
        session=session,
        user_message_text=user_message_text,
        mode=mode,
    ):
        text_parts.append(delta)

    # The streaming generator already persisted the assistant message; pull its
    # citations off the freshly-saved row.
    last = chat_service.list_messages(db, session)[-1]
    return StreamedAnswer(
        text="".join(text_parts).strip(),
        citations=last.source_citations or [],
    )
