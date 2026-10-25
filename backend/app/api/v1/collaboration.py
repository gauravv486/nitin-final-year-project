"""Client collaboration threads - Module 13.

Portal users take part in their own client's threads; that is the point of
the portal. The thread status follows the last message: a client posting
means the firm owes a reply, and the reverse.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select

from app.api.deps import CurrentUserDep, SessionDep, authorise_client, visible_client_ids
from app.models.enums import MessageAuthorKind, ThreadChannel, ThreadStatus
from app.models.practice import Client, Document
from app.models.tenancy import User
from app.models.workflow import CollaborationThread, ThreadMessage
from app.services import audit

router = APIRouter(tags=["collaboration"])


class ThreadIn(BaseModel):
    subject: str = Field(min_length=2, max_length=255)
    body: str = Field(min_length=1, max_length=10_000)
    channel: ThreadChannel = ThreadChannel.CLIENT_PORTAL


class MessageIn(BaseModel):
    body: str = Field(min_length=1, max_length=10_000)
    document_ids: list[uuid.UUID] = Field(default_factory=list, max_length=10)


class StatusIn(BaseModel):
    status: ThreadStatus


class MessageOut(BaseModel):
    id: uuid.UUID
    author: str
    author_kind: MessageAuthorKind
    body: str
    attachments: list[dict]
    created_at: datetime
    read_at: datetime | None


class ThreadOut(BaseModel):
    id: uuid.UUID
    client_id: uuid.UUID
    client_name: str
    subject: str
    channel: ThreadChannel
    status: ThreadStatus
    last_message: str | None
    last_author: str | None
    last_message_at: datetime | None
    #: Messages from the other side that this viewer has not read.
    unread: int
    awaiting: str | None


class ThreadDetailOut(ThreadOut):
    messages: list[MessageOut]


def _awaiting(status_: ThreadStatus) -> str | None:
    return {ThreadStatus.AWAITING_CLIENT: "client", ThreadStatus.AWAITING_FIRM: "firm"}.get(status_)


def _other_side(user) -> MessageAuthorKind:
    return MessageAuthorKind.FIRM_USER if user.is_portal_user else MessageAuthorKind.CLIENT_USER


def _author_name(message: ThreadMessage, users: dict, client_name: str) -> str:
    if message.author_kind is MessageAuthorKind.SYSTEM:
        return "System"
    person = users.get(message.author_id)
    if person is None:
        return client_name if message.author_kind is MessageAuthorKind.CLIENT_USER else "Firm"
    return person.full_name


def _thread_out(session, user, thread: CollaborationThread, client_name: str) -> dict:
    last = session.execute(
        select(ThreadMessage).where(ThreadMessage.thread_id == thread.id).order_by(ThreadMessage.created_at.desc()).limit(1)
    ).scalar_one_or_none()
    unread = session.execute(
        select(func.count()).select_from(ThreadMessage).where(
            ThreadMessage.thread_id == thread.id,
            ThreadMessage.author_kind == _other_side(user),
            ThreadMessage.read_at.is_(None),
        )
    ).scalar_one()
    users = {last.author_id: session.get(User, last.author_id)} if last and last.author_id else {}
    return {
        "id": thread.id,
        "client_id": thread.client_id,
        "client_name": client_name,
        "subject": thread.subject,
        "channel": thread.channel,
        "status": thread.status,
        "last_message": last.body[:200] if last else None,
        "last_author": _author_name(last, users, client_name) if last else None,
        "last_message_at": thread.last_message_at,
        "unread": unread,
        "awaiting": _awaiting(thread.status),
    }


def _post(session, user, thread: CollaborationThread, body: str, document_ids: list[uuid.UUID]) -> ThreadMessage:
    attachments = []
    for document_id in document_ids:
        document = session.get(Document, document_id)
        if document is None or document.client_id != thread.client_id:
            raise HTTPException(status_code=422, detail="An attachment does not belong to this client")
        attachments.append({"document_id": str(document.id), "file_name": document.file_name})
    kind = MessageAuthorKind.CLIENT_USER if user.is_portal_user else MessageAuthorKind.FIRM_USER
    message = ThreadMessage(thread_id=thread.id, author_id=user.id, author_kind=kind, body=body, attachments=attachments)
    session.add(message)
    thread.last_message_at = datetime.now(UTC)
    if thread.status is not ThreadStatus.CLOSED:
        thread.status = ThreadStatus.AWAITING_FIRM if user.is_portal_user else ThreadStatus.AWAITING_CLIENT
    return message


def _load(session, user, thread_id) -> tuple[CollaborationThread, Client]:
    thread = session.get(CollaborationThread, thread_id)
    if thread is None or thread.firm_id != user.firm_id:
        raise HTTPException(status_code=404, detail="No such thread")
    return thread, authorise_client(session, user, thread.client_id)


@router.get("/threads", response_model=list[ThreadOut], summary="Threads")
def list_threads(session: SessionDep, user: CurrentUserDep, client_id: uuid.UUID | None = None) -> list[ThreadOut]:
    conditions = [CollaborationThread.firm_id == user.firm_id, CollaborationThread.client_id.in_(visible_client_ids(user))]
    if client_id:
        conditions.append(CollaborationThread.client_id == client_id)
    rows = session.execute(
        select(CollaborationThread, Client.name)
        .join(Client, Client.id == CollaborationThread.client_id)
        .where(*conditions)
        .order_by(CollaborationThread.last_message_at.desc().nulls_last())
    ).all()
    return [ThreadOut(**_thread_out(session, user, t, name)) for t, name in rows]


@router.post(
    "/clients/{client_id}/threads",
    response_model=ThreadDetailOut,
    status_code=status.HTTP_201_CREATED,
    summary="Start a thread",
)
def create_thread(client_id: uuid.UUID, payload: ThreadIn, request: Request, session: SessionDep, user: CurrentUserDep):
    authorise_client(session, user, client_id)
    thread = CollaborationThread(firm_id=user.firm_id, client_id=client_id, subject=payload.subject, channel=payload.channel)
    session.add(thread)
    session.flush()
    _post(session, user, thread, payload.body, [])
    audit.record(session, user, "THREAD_CREATE", resource_type="thread", resource_id=thread.id, request=request)
    session.commit()
    return get_thread(thread.id, session, user)


@router.get("/threads/{thread_id}", response_model=ThreadDetailOut, summary="One thread")
def get_thread(thread_id: uuid.UUID, session: SessionDep, user: CurrentUserDep) -> ThreadDetailOut:
    thread, client = _load(session, user, thread_id)
    messages = session.execute(
        select(ThreadMessage).where(ThreadMessage.thread_id == thread.id).order_by(ThreadMessage.created_at)
    ).scalars().all()
    users = {u.id: u for u in session.execute(select(User).where(User.id.in_({m.author_id for m in messages if m.author_id}))).scalars()}
    out = ThreadDetailOut(
        **_thread_out(session, user, thread, client.name),
        messages=[
            MessageOut(
                id=m.id,
                author=_author_name(m, users, client.name),
                author_kind=m.author_kind,
                body=m.body,
                attachments=m.attachments or [],
                created_at=m.created_at,
                read_at=m.read_at,
            )
            for m in messages
        ],
    )
    # Opening the thread reads the other side's messages.
    now = datetime.now(UTC)
    for m in messages:
        if m.author_kind is _other_side(user) and m.read_at is None:
            m.read_at = now
    session.commit()
    return out


@router.post("/threads/{thread_id}/messages", response_model=ThreadDetailOut, summary="Reply")
def reply(thread_id: uuid.UUID, payload: MessageIn, request: Request, session: SessionDep, user: CurrentUserDep):
    thread, _ = _load(session, user, thread_id)
    if thread.status is ThreadStatus.CLOSED:
        raise HTTPException(status_code=409, detail="This thread is closed")
    _post(session, user, thread, payload.body, payload.document_ids)
    audit.record(session, user, "THREAD_REPLY", resource_type="thread", resource_id=thread.id, request=request)
    session.commit()
    return get_thread(thread.id, session, user)


@router.patch("/threads/{thread_id}", response_model=ThreadOut, summary="Change thread status")
def set_status(thread_id: uuid.UUID, payload: StatusIn, request: Request, session: SessionDep, user: CurrentUserDep):
    thread, client = _load(session, user, thread_id)
    if user.is_portal_user and payload.status is not ThreadStatus.CLOSED:
        raise HTTPException(status_code=403, detail="Portal users can only close a thread")
    thread.status = payload.status
    audit.record(session, user, "THREAD_STATUS", resource_type="thread", resource_id=thread.id,
                 meta={"status": payload.status}, request=request)
    session.commit()
    return ThreadOut(**_thread_out(session, user, thread, client.name))
