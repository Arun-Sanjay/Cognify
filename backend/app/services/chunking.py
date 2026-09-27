"""Document chunking.

Splits raw document text into ~500-word chunks suitable for embedding. We use a simple word-boundary splitter with a small
overlap between chunks to avoid cutting sentences in half (improves RAG recall).
"""
from __future__ import annotations

import re
from dataclasses import dataclass


DEFAULT_CHUNK_WORDS = 500
DEFAULT_OVERLAP_WORDS = 50
MIN_CHUNK_CHARS = 20  # skip chunks that are just whitespace / page noise


@dataclass
class Chunk:
    index: int
    text: str


def split_into_chunks(
    text: str,
    *,
    words_per_chunk: int = DEFAULT_CHUNK_WORDS,
    overlap_words: int = DEFAULT_OVERLAP_WORDS,
) -> list[Chunk]:
    """Split `text` into overlapping word-based chunks.

    Implementation:
    1. Normalize whitespace
    2. Tokenize on whitespace into a list of words
    3. Slide a window of `words_per_chunk` over the list with `overlap_words` step-back
    4. Discard empty or trivially short chunks
    """
    if not text or not text.strip():
        return []

    # Normalize: collapse runs of whitespace but keep paragraph breaks readable
    normalized = re.sub(r"[ \t]+", " ", text)
    normalized = re.sub(r"\n{3,}", "\n\n", normalized)

    words = normalized.split()
    if not words:
        return []

    if overlap_words >= words_per_chunk:
        raise ValueError("overlap_words must be smaller than words_per_chunk")

    chunks: list[Chunk] = []
    stride = words_per_chunk - overlap_words
    index = 0
    start = 0

    while start < len(words):
        end = min(start + words_per_chunk, len(words))
        chunk_text = " ".join(words[start:end]).strip()
        if len(chunk_text) >= MIN_CHUNK_CHARS:
            chunks.append(Chunk(index=index, text=chunk_text))
            index += 1
        if end >= len(words):
            break
        start += stride

    return chunks
