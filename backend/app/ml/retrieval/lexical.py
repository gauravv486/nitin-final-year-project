"""BM25 with a tokeniser that respects statutory references."""

from __future__ import annotations

import math
import re

import numpy as np
from scipy import sparse
from sklearn.feature_extraction.text import CountVectorizer

#: Section references survive as single tokens: "16(4)", "143(1)(a)", "73",
#: "148A". Splitting "16(4)" into "16" and "4" would make it match every
#: passage containing the number four.
_SECTION_TOKEN = re.compile(r"\b\d{1,3}[a-z]{0,2}(?:\(\d{1,3}[a-z]?\))+(?:\([a-z]{1,4}\))?|\b\d{1,3}[a-z]{1,2}\b")
_WORD = re.compile(r"[a-z][a-z]+|\d{1,4}")

STOPWORDS = frozenset(
    {
        "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has", "have", "in", "is",
        "it", "its", "of", "on", "or", "that", "the", "this", "to", "was", "were", "which", "with",
        "shall", "may", "any", "such", "under", "said", "been", "not", "no", "if", "than", "then",
        "there", "these", "those", "into",
    }
)


def tokenize(text: str) -> list[str]:
    lower = text.lower()
    tokens = [m.group(0) for m in _SECTION_TOKEN.finditer(lower)]
    for ref in list(tokens):
        # "16(4)" also counts as "16", so a query naming only the section
        # still finds the subsection.
        tokens.append(ref.split("(")[0])
    tokens += [w for w in _WORD.findall(lower) if w not in STOPWORDS]
    return tokens


class Bm25Index:
    def __init__(self, k1: float = 1.5, b: float = 0.75) -> None:
        self.k1 = k1
        self.b = b
        self._vectorizer = CountVectorizer(tokenizer=tokenize, lowercase=False, token_pattern=None)
        self._matrix: sparse.csc_matrix | None = None
        self._idf: np.ndarray | None = None
        self._lengths: np.ndarray | None = None
        self._avg = 1.0

    def fit(self, documents: list[str]) -> Bm25Index:
        if not documents:
            return self
        counts = self._vectorizer.fit_transform(documents).tocsc().astype(np.float64)
        n = counts.shape[0]
        df = np.diff(counts.indptr)
        self._idf = np.log((n - df + 0.5) / (df + 0.5) + 1.0)
        self._lengths = np.asarray(counts.sum(axis=1)).ravel()
        self._avg = float(self._lengths.mean()) or 1.0
        self._matrix = counts
        return self

    @property
    def size(self) -> int:
        return 0 if self._matrix is None else self._matrix.shape[0]

    def scores(self, query: str) -> np.ndarray:
        if self._matrix is None:
            return np.zeros(0)
        vocabulary = self._vectorizer.vocabulary_
        terms = [vocabulary[t] for t in dict.fromkeys(tokenize(query)) if t in vocabulary]
        result = np.zeros(self._matrix.shape[0])
        norm = self.k1 * (1 - self.b + self.b * self._lengths / self._avg)
        for column in terms:
            start, end = self._matrix.indptr[column], self._matrix.indptr[column + 1]
            rows = self._matrix.indices[start:end]
            tf = self._matrix.data[start:end]
            result[rows] += self._idf[column] * tf * (self.k1 + 1) / (tf + norm[rows])
        return result


def bm25_idf_floor(n: int) -> float:
    """Smallest idf a term can have in a corpus of ``n`` - used in tests."""
    return math.log(0.5 / (n + 0.5) + 1.0)
