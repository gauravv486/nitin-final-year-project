"""Sentence embeddings, optional.

sentence-transformers lives in requirements-ml.txt. Without it, retrieval is
lexical only and says so; nothing pretends an embedding exists.
"""

from __future__ import annotations

import logging
from functools import lru_cache

import numpy as np

from app.core.config import settings

logger = logging.getLogger(__name__)

#: bge models are trained with this instruction on the *query* side only.
#: Passages are embedded bare. Omitting it measurably hurts short queries.
BGE_QUERY_INSTRUCTION = "Represent this sentence for searching relevant passages: "


def installed() -> bool:
    try:
        import sentence_transformers  # noqa: F401
    except ImportError:
        return False
    return True


@lru_cache(maxsize=1)
def _model():
    if not installed():
        return None
    from sentence_transformers import SentenceTransformer

    try:
        model = SentenceTransformer(settings.EMBEDDING_MODEL, device="cpu")
    except Exception:
        logger.exception("Could not load embedding model %s", settings.EMBEDDING_MODEL)
        return None
    dimension = model.get_sentence_embedding_dimension()
    if dimension != settings.EMBEDDING_DIM:
        logger.error(
            "Embedding model %s produces %d dimensions but EMBEDDING_DIM is %d - dense search disabled",
            settings.EMBEDDING_MODEL, dimension, settings.EMBEDDING_DIM,
        )
        return None
    return model


def model_name() -> str | None:
    return settings.EMBEDDING_MODEL if _model() is not None else None


def embed_passages(texts: list[str]) -> np.ndarray | None:
    model = _model()
    if model is None or not texts:
        return None
    return np.asarray(model.encode(texts, batch_size=32, normalize_embeddings=True, show_progress_bar=False))


def embed_query(text: str) -> np.ndarray | None:
    model = _model()
    if model is None:
        return None
    prefix = BGE_QUERY_INSTRUCTION if "bge" in settings.EMBEDDING_MODEL.lower() else ""
    return np.asarray(model.encode([prefix + text], normalize_embeddings=True, show_progress_bar=False))[0]
