"""Sentence Transformers embeddings.

Uses `all-MiniLM-L6-v2` (384-dim) for both indexing (chunks) and querying.
This model is small (~80 MB), runs on CPU, and gives good semantic similarity
for English course material.

The model is lazy-loaded once and cached for the lifetime of the process.
That means the first call after a server restart pays the load cost (~5-15s);
all subsequent calls are fast (~10-50ms per chunk).

Embeddings live in a 384-dim vector space and
similarity is computed via the cosine distance operator (`<=>`) in pgvector.
"""
from __future__ import annotations

import logging
import threading
from functools import lru_cache
from typing import Iterable

logger = logging.getLogger(__name__)

# Public constant — what dimension the column was created with
EMBEDDING_DIM = 384
MODEL_NAME = "all-MiniLM-L6-v2"

# Loading the model is expensive — guard with a lock so concurrent requests
# don't trigger duplicate downloads.
_load_lock = threading.Lock()


@lru_cache(maxsize=1)
def _get_model():  # type: ignore[no-untyped-def]
    """Lazy-load the SentenceTransformer model. Cached after first call.

    Returns None if the import fails (e.g. torch not installed in some env).
    """
    try:
        from sentence_transformers import SentenceTransformer
    except ImportError as e:
        logger.error("sentence-transformers not installed: %s", e)
        return None

    with _load_lock:
        logger.info("Loading SentenceTransformer model: %s", MODEL_NAME)
        try:
            model = SentenceTransformer(MODEL_NAME)
        except Exception as e:
            logger.exception("Failed to load embedding model: %s", e)
            return None
        logger.info("Embedding model loaded (dim=%d)", model.get_sentence_embedding_dimension())
        return model


def is_available() -> bool:
    """True if the model can be loaded — used by callers to gracefully skip
    embedding when the dependency isn't installed."""
    return _get_model() is not None


def embed_text(text: str) -> list[float]:
    """Embed a single string. Returns a 384-dim list of floats.

    Returns an empty list if the model is unavailable or `text` is empty.
    """
    if not text or not text.strip():
        return []
    model = _get_model()
    if model is None:
        return []
    try:
        # encode returns a numpy array; convert to list[float] for JSON / pgvector
        vector = model.encode(text, convert_to_numpy=True, show_progress_bar=False)
        return [float(x) for x in vector.tolist()]
    except Exception as e:
        logger.exception("embed_text failed: %s", e)
        return []


def embed_batch(texts: Iterable[str]) -> list[list[float]]:
    """Embed many strings in a single forward pass. Much faster than calling
    `embed_text` in a loop because of GPU/CPU batching.

    Empty strings produce empty embeddings (length 0). The result list is
    guaranteed to have the same length as the input.
    """
    text_list = [t if (t and t.strip()) else "" for t in texts]
    if not text_list:
        return []

    model = _get_model()
    if model is None:
        return [[] for _ in text_list]

    # Filter out empty strings before sending to the model — some versions of
    # sentence-transformers raise on empty inputs. Then re-insert empties.
    nonempty_indices: list[int] = [i for i, t in enumerate(text_list) if t]
    nonempty_texts = [text_list[i] for i in nonempty_indices]

    if not nonempty_texts:
        return [[] for _ in text_list]

    try:
        vectors = model.encode(
            nonempty_texts,
            convert_to_numpy=True,
            show_progress_bar=False,
            batch_size=32,
        )
    except Exception as e:
        logger.exception("embed_batch failed: %s", e)
        return [[] for _ in text_list]

    # Build the output, slotting computed vectors into their original positions
    output: list[list[float]] = [[] for _ in text_list]
    for batch_idx, original_idx in enumerate(nonempty_indices):
        output[original_idx] = [float(x) for x in vectors[batch_idx].tolist()]
    return output
