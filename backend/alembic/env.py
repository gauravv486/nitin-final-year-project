"""Alembic environment.

Two things worth knowing:

* The URL comes from ``app.core.config``, not ``alembic.ini``. One source of
  truth for the connection string.
* ``app.models`` is imported for its side effect of registering every table on
  ``Base.metadata``. A model not reachable from that package is invisible to
  autogenerate and its table silently never gets created.
"""

from __future__ import annotations

import sys
from logging.config import fileConfig
from pathlib import Path

from sqlalchemy import engine_from_config, pool, text

from alembic import context

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import settings

# Imported for its side effect: this registers every table on Base.metadata.
# A model not reachable from app.models is invisible to autogenerate, and its
# table silently never gets created.
from app.models import Base

config = context.config
config.set_main_option("sqlalchemy.url", settings.sqlalchemy_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


#: Tables that exist in the database but are not ours to manage.
_FOREIGN_TABLES = frozenset({"vector_test"})


def include_object(obj, name, type_, reflected, compare_to) -> bool:
    """Keep pgvector's own internal tables out of autogenerate.

    Without this, an extension's tables look like rows that the models do not
    declare, and autogenerate helpfully writes a migration to drop them.
    """
    return not (type_ == "table" and name in _FOREIGN_TABLES)


def run_migrations_offline() -> None:
    """Emit SQL to stdout instead of running it. ``alembic upgrade head --sql``."""
    context.configure(
        url=settings.sqlalchemy_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        include_object=include_object,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        connect_args={"connect_timeout": 5},
    )

    with connectable.connect() as connection:
        # pgvector has to exist before a migration that declares a vector
        # column. Creating it here means `alembic upgrade head` works on a bare
        # database in one command.
        #
        # Guarded, because with PGVECTOR_ENABLED off no migration declares one -
        # embeddings are a float array instead - and an unconditional CREATE
        # EXTENSION would abort every migration on a server without pgvector,
        # which on Windows is the normal case. See README.md step 4.
        if settings.PGVECTOR_ENABLED:
            connection.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            connection.commit()

        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            # Detect column type changes, not just added/dropped columns.
            compare_type=True,
            compare_server_default=True,
            include_object=include_object,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
