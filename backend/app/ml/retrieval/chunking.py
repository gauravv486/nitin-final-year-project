"""Splitting judgments into retrievable passages.

A judgment runs to tens of thousands of words; one vector or one BM25 document
for all of it retrieves nothing precisely. Passages of ~180 words, with a
40-word overlap so a holding that straddles a boundary is whole in at least
one passage. Paragraph breaks are respected where they fall inside the budget,
because a judgment's paragraphs are its units of reasoning.
"""

from __future__ import annotations

import re


def chunk_text(text: str, *, target_words: int = 180, overlap_words: int = 40) -> list[str]:
    paragraphs = [re.sub(r"\s+", " ", p).strip() for p in re.split(r"\n\s*\n", text)]
    paragraphs = [p for p in paragraphs if p]
    words_in = [p.split(" ") for p in paragraphs]

    chunks: list[str] = []
    current: list[str] = []
    for words in words_in:
        if current and len(current) + len(words) > target_words:
            chunks.append(" ".join(current))
            current = current[-overlap_words:] if overlap_words else []
        # A single paragraph longer than the budget is cut on word count.
        while len(words) > target_words:
            room = target_words - len(current)
            current.extend(words[:room])
            words = words[room:]
            chunks.append(" ".join(current))
            current = current[-overlap_words:] if overlap_words else []
        current.extend(words)
    if current and (not chunks or " ".join(current) != chunks[-1]):
        tail = " ".join(current)
        # Drop a tail that is nothing but the overlap of the previous chunk.
        if not chunks or len(current) > overlap_words:
            chunks.append(tail)
    return chunks
