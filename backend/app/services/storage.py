"""Local filesystem storage for uploaded documents and generated reports.

Keys are always *relative* to ``settings.STORAGE_DIR`` - the ``storage_key``
column is documented as opaque and portable, and an absolute path would not
survive restoring the database onto another machine.

Swapping this for object storage means reimplementing four functions; nothing
else in the codebase touches the filesystem for user files.
"""

from __future__ import annotations

import hashlib
import uuid
from pathlib import Path

from app.core.config import settings


class StorageError(RuntimeError):
    pass


def _root() -> Path:
    root = settings.STORAGE_DIR.resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root


def _resolve(key: str) -> Path:
    """Map a key to a path, refusing anything that escapes the root.

    Keys are generated here, never taken from a request, but the check stays:
    a key read back from a tampered database row must not become a read of
    ``C:\\Windows\\...``.
    """
    root = _root()
    path = (root / key).resolve()
    if root != path and root not in path.parents:
        raise StorageError("storage key escapes the storage root")
    return path


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def save(data: bytes, *, namespace: str, suffix: str) -> str:
    """Write ``data`` under ``namespace`` and return its key.

    The filename is a fresh UUID, never the uploader's name: user-supplied
    names collide, contain path separators, and on Windows can be reserved
    words like ``CON``.
    """
    safe_suffix = suffix.lower() if suffix.startswith(".") and len(suffix) <= 6 else ""
    key = f"{namespace}/{uuid.uuid4().hex}{safe_suffix}"
    path = _resolve(key)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return key


def read(key: str) -> bytes:
    path = _resolve(key)
    if not path.is_file():
        raise StorageError(f"no stored file for key {key!r}")
    return path.read_bytes()


def path_for(key: str) -> Path:
    path = _resolve(key)
    if not path.is_file():
        raise StorageError(f"no stored file for key {key!r}")
    return path


def delete(key: str) -> None:
    path = _resolve(key)
    path.unlink(missing_ok=True)
