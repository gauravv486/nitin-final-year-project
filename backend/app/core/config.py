"""Application settings, loaded once from the environment.

Nothing in the codebase reads ``os.environ`` directly. Everything goes through
``settings``, so a renamed variable is a startup failure with a clear message
rather than a ``None`` that surfaces three screens later as a 500.
"""

from __future__ import annotations

import secrets
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, PostgresDsn, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/app/core/config.py -> backend/
BASE_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        # Unknown keys in .env are ignored rather than fatal: a developer's
        # personal scratch variables should not stop the server booting.
        extra="ignore",
    )

    # ------------------------------------------------------------- runtime --
    ENV: Literal["development", "test", "production"] = "development"
    DEBUG: bool = True
    PROJECT_NAME: str = "CA-OS API"
    API_V1_PREFIX: str = "/api/v1"

    HOST: str = "127.0.0.1"
    PORT: int = Field(default=8000, ge=1, le=65535)

    # The Next.js dev server. Comma-separated in .env.
    CORS_ORIGINS: str = "http://localhost:3000"

    # ------------------------------------------------------------ database --
    # The one value you must supply. See README.md "Connecting PostgreSQL".
    DATABASE_URL: PostgresDsn = Field(
        default="postgresql+psycopg://postgres:postgres@localhost:5432/ca_os",  # type: ignore[assignment]
    )
    # Echo every SQL statement. Useful once, exhausting always.
    DB_ECHO: bool = False
    DB_POOL_SIZE: int = Field(default=5, ge=1)
    DB_MAX_OVERFLOW: int = Field(default=10, ge=0)

    # ------------------------------------------------------------- security --
    # Empty in development means "generate a throwaway at boot" (see the
    # validator below). Production refuses to start without a real one.
    JWT_SECRET: str = ""
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_TTL_MINUTES: int = Field(default=30, ge=1)
    REFRESH_TOKEN_TTL_DAYS: int = Field(default=7, ge=1)
    # bcrypt work factor. 12 is ~250 ms, the right order for a login.
    BCRYPT_ROUNDS: int = Field(default=12, ge=10, le=15)

    # -------------------------------------------------------------- storage --
    STORAGE_DIR: Path = BASE_DIR / "storage"
    MAX_UPLOAD_MB: int = Field(default=25, ge=1)

    # --------------------------------------------------------- ml artifacts --
    # Where train_ledger_classifier.py writes its model, and where the API
    # loads it from at startup.
    MODEL_DIR: Path = BASE_DIR / "artifacts"
    DATA_DIR: Path = BASE_DIR / "data"

    # A prediction below this is never auto-applied; it goes to a human. The
    # classifier's probabilities are calibrated, so this threshold means what
    # it says - see app/ml/ledger/README.md.
    LEDGER_AUTO_APPLY_FLOOR: float = Field(default=0.90, ge=0.0, le=1.0)

    # ------------------------------------------------------------------ llm --
    # `ollama`  - local, free, offline, no key. The default.
    # `anthropic` - hosted; better drafts, costs money, data leaves the machine.
    # `stub`    - returns a "not configured" notice instead of inventing text.
    LLM_PROVIDER: Literal["ollama", "anthropic", "stub"] = "ollama"
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "qwen3:4b"
    ANTHROPIC_API_KEY: str = ""
    ANTHROPIC_MODEL: str = "claude-sonnet-5-5"
    LLM_TIMEOUT_SECONDS: int = Field(default=120, ge=5)

    # ------------------------------------------------------------ embeddings --
    EMBEDDING_MODEL: str = "BAAI/bge-small-en-v1.5"
    # Must match the model's output dimension, and must match the pgvector
    # column width in the migration. bge-small-en-v1.5 is 384.
    EMBEDDING_DIM: int = 384

    # pgvector is not part of the Windows PostgreSQL installer and the project
    # publishes no Windows binaries, so building it needs the MSVC toolchain.
    # It therefore cannot be assumed present.
    #
    # Off:  ``case_law_chunks.embedding`` is a plain ``double precision[]``.
    # On:   the column is ``vector(EMBEDDING_DIM)``, which makes an ANN index
    #       possible.
    #
    # Either way, app/services/caselaw.py ranks in the application with NumPy:
    # over a few thousand passages that is single-digit milliseconds, so moving
    # it into the database is a scale decision for later, not a feature. The
    # flag changes the column type, so flipping it after the first migration
    # needs a migration of its own.
    PGVECTOR_ENABLED: bool = False

    # ----------------------------------------------------------- validators --

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def _force_psycopg_driver(cls, value: object) -> object:
        """Normalise the URL to the psycopg 3 driver.

        People paste ``postgresql://...`` from hosting dashboards, which
        SQLAlchemy resolves to psycopg2 - a package we do not install. Rewriting
        it here means a pasted connection string works unmodified.
        """
        if isinstance(value, str) and value.startswith("postgresql://"):
            return value.replace("postgresql://", "postgresql+psycopg://", 1)
        if isinstance(value, str) and value.startswith("postgres://"):
            return value.replace("postgres://", "postgresql+psycopg://", 1)
        return value

    @model_validator(mode="after")
    def _check_secrets(self) -> Settings:
        if not self.JWT_SECRET:
            if self.ENV == "production":
                raise ValueError(
                    "JWT_SECRET must be set in production. Generate one with:\n"
                    '    python -c "import secrets; print(secrets.token_urlsafe(48))"'
                )
            # Development convenience, with a real cost made explicit: tokens
            # issued before a restart stop validating after it. That is the
            # correct trade - it is never a silently weak fixed key.
            object.__setattr__(self, "JWT_SECRET", secrets.token_urlsafe(48))

        if self.LLM_PROVIDER == "anthropic" and not self.ANTHROPIC_API_KEY:
            raise ValueError(
                "LLM_PROVIDER=anthropic needs ANTHROPIC_API_KEY. "
                "Use LLM_PROVIDER=ollama for the local model instead."
            )
        return self

    # ------------------------------------------------------------ derived ---

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def max_upload_bytes(self) -> int:
        return self.MAX_UPLOAD_MB * 1024 * 1024

    @property
    def sqlalchemy_url(self) -> str:
        return str(self.DATABASE_URL)


@lru_cache
def get_settings() -> Settings:
    """Cached so the .env file is parsed once per process."""
    return Settings()


settings = get_settings()
