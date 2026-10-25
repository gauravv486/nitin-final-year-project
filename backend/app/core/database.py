"""Database engine and session management.

Synchronous SQLAlchemy, deliberately. FastAPI runs ``def`` endpoints in a
threadpool, so sync handlers do not block the event loop, and the ML work in
this service is CPU-bound sync code anyway (scikit-learn has no async
interface). An async stack here would add colour-of-function complexity and
``greenlet`` failure modes to buy nothing - the bottleneck is never database
concurrency on a single practice's data.
"""

from __future__ import annotations

import logging
from collections.abc import Generator

from sqlalchemy import create_engine, event, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings

logger = logging.getLogger(__name__)

engine: Engine = create_engine(
    settings.sqlalchemy_url,
    echo=settings.DB_ECHO,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    # Recycle before the typical 300s idle timeout on managed Postgres, and
    # check liveness on checkout. Without pre_ping the first request after an
    # idle period fails with a stale connection.
    pool_recycle=280,
    pool_pre_ping=True,
    future=True,
    connect_args={
        # Without this, connecting to a host where nothing is listening waits
        # for the OS TCP timeout - tens of seconds on Windows - so startup and
        # /health appear to hang rather than reporting a clear failure. Three
        # seconds is far longer than a real local or regional connect needs.
        "connect_timeout": 3,
        "application_name": "ca_os_api",
    },
)

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
)


def get_session() -> Generator[Session, None, None]:
    """FastAPI dependency: one session per request.

    Commit is the caller's job. Rollback on exception is not - leaving a failed
    transaction open poisons the connection for whoever gets it next from the
    pool.
    """
    session = SessionLocal()
    try:
        yield session
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def check_connection() -> tuple[bool, str]:
    """Probe the database. Used by the health endpoint and at startup.

    Returns ``(ok, detail)`` rather than raising, so the caller decides whether
    an unreachable database is fatal.
    """
    try:
        with engine.connect() as connection:
            version = connection.execute(text("SHOW server_version")).scalar_one()
        return True, f"PostgreSQL {version}"
    except Exception as exc:
        return False, str(exc).strip().splitlines()[0]


def ensure_extensions() -> None:
    """Create the extensions the schema depends on.

    Only ``vector`` is involved, and only when ``PGVECTOR_ENABLED`` is set -
    with it off the schema stores embeddings as a float array and needs no
    extension at all, so attempting the ``CREATE`` would log a scary warning
    about something nothing depends on.

    When it is on, this must succeed before the migration that declares the
    vector column runs. The failure is logged rather than raised because the
    other twelve modules are perfectly usable without case-law search.
    """
    if not settings.PGVECTOR_ENABLED:
        logger.debug("pgvector disabled; embeddings stored as float arrays")
        return

    try:
        with engine.begin() as connection:
            connection.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        logger.info("extension ready: vector")
    except Exception as exc:
        logger.warning(
            "PGVECTOR_ENABLED is set but 'CREATE EXTENSION vector' failed (%s). "
            "Either install pgvector - see README.md -> 'Connecting PostgreSQL' - "
            "or set PGVECTOR_ENABLED=false and re-run the migration.",
            str(exc).strip().splitlines()[0],
        )


@event.listens_for(engine, "connect")
def _set_session_defaults(dbapi_connection, _record) -> None:
    """Pin every connection's timezone to UTC.

    The application stores timezone-aware timestamps and renders in
    Asia/Kolkata. Leaving the session timezone to the server's locale means the
    same query returns different values on a developer's laptop and the
    deployment host.

    Bound to this engine rather than the global ``Engine`` class, so a test or
    a script that builds its own engine is unaffected.
    """
    with dbapi_connection.cursor() as cursor:
        cursor.execute("SET TIME ZONE 'UTC'")
