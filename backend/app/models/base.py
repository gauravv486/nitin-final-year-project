"""Declarative base, shared column conventions and mixins.

Conventions applied across every table:

* UUID primary keys. Ids travel in URLs and logs, and a serial would leak how
  many clients a firm has and let one row's id be guessed from another's.
* ``snake_case`` table and column names, pluralised table names.
* Money is ``Numeric(15, 2)`` - never ``Float``. A rupee figure that has been
  through an IEEE double cannot be trusted in a reconciliation, and a
  reconciliation that cannot be trusted is the whole product.
* ``created_at`` / ``updated_at`` on anything a user edits, filled by the
  database rather than the application so that a direct SQL fix still sets them.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Annotated

from sqlalchemy import DateTime, MetaData, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

# Explicit constraint naming. Without this, Alembic autogenerate produces
# migrations that cannot drop an unnamed constraint on PostgreSQL, and you find
# out six migrations later.
NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_N_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        identifier = getattr(self, "id", None)
        return f"<{type(self).__name__} id={identifier}>"


# ----------------------------------------------------------- column types ---

#: Rupee amounts. 15 digits total, 2 after the point: up to ~9,999 crore, which
#: is comfortably past anything a mid-size practice will file.
Money = Annotated[Decimal, mapped_column(Numeric(15, 2))]

#: A probability or confidence in [0, 1]. Four decimal places, because the
#: calibrated classifier genuinely distinguishes 0.9012 from 0.9087 and the
#: auto-apply threshold is compared against it.
Confidence = Annotated[Decimal, mapped_column(Numeric(5, 4))]

#: A 0-100 score.
Score = Annotated[Decimal, mapped_column(Numeric(5, 2))]

#: ``YYYY-MM``
Period = Annotated[str, mapped_column(String(7))]


def uuid_pk() -> Mapped[uuid.UUID]:
    return mapped_column(
        PgUUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )


def uuid_fk(target: str, *, nullable: bool = False, ondelete: str = "CASCADE"):
    from sqlalchemy import ForeignKey

    return mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey(target, ondelete=ondelete),
        nullable=nullable,
        index=True,
    )


# ---------------------------------------------------------------- mixins ----


class UuidMixin:
    id: Mapped[uuid.UUID] = uuid_pk()


class TimestampMixin:
    """``created_at`` and ``updated_at``, both maintained by PostgreSQL.

    ``server_default``/``onupdate`` rather than Python defaults so that a bulk
    insert or a manual ``UPDATE`` in psql keeps the columns honest.
    """

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class SoftDeleteMixin:
    """Used only where an audit trail needs the row to outlive its deletion.

    Firms, users, clients and documents. Everywhere else a delete is a delete -
    a soft-delete flag on every table means every query needs a filter, and the
    one that forgets it is the bug.
    """

    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )

    @property
    def is_deleted(self) -> bool:
        return self.deleted_at is not None
