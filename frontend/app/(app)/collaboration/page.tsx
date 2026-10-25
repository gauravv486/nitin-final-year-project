'use client'

import { useState } from 'react'
import { MessageSquarePlus, Send } from 'lucide-react'
import { api } from '@/lib/api'
import { useApi, useAction } from '@/lib/use-api'
import { CHANNELS, type ThreadStatus } from '@/lib/enums'
import { PageHeader } from '@/components/app-shell/page-header'
import { ThreadBadge } from '@/components/app-shell/status'
import { ClientPicker, useClientPicker } from '@/components/app-shell/pickers'
import { Button } from '@/components/ui/button'
import { Badge, Card, CardBody, CardHeader, CardTitle, Stat } from '@/components/ui/surface'
import { ActionError, Async, EmptyState, Select } from '@/components/ui/async'
import { Field, Input, Textarea } from '@/components/ui/field'

interface Thread {
  id: string
  client_id: string
  client_name: string
  subject: string
  channel: string
  status: ThreadStatus
  last_message: string | null
  last_author: string | null
  last_message_at: string | null
  unread: number
  awaiting: string | null
}

interface Message {
  id: string
  author: string
  author_kind: string
  body: string
  created_at: string
}

interface ThreadDetail extends Thread {
  messages: Message[]
}

function relative(iso: string | null) {
  if (!iso) return ''
  const hours = Math.round((Date.now() - new Date(iso).getTime()) / 3_600_000)
  if (hours < 1) return 'just now'
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

export default function CollaborationPage() {
  const picker = useClientPicker()
  const [composing, setComposing] = useState(false)
  const query = useApi<Thread[]>('/threads')

  const threads = query.data ?? []
  const awaitingFirm = threads.filter((t) => t.status === 'AWAITING_FIRM').length
  const awaitingClient = threads.filter((t) => t.status === 'AWAITING_CLIENT').length

  return (
    <>
      <PageHeader
        title="Collaboration"
        lede="Threads scoped to one client. Each records who is waiting on whom, so nothing stalls silently."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ClientPicker
              clients={picker.clients}
              value={picker.selected}
              onChange={picker.setSelected}
            />
            <Button size="sm" onClick={() => setComposing((v) => !v)}>
              <MessageSquarePlus aria-hidden className="size-4" />
              {composing ? 'Cancel' : 'New thread'}
            </Button>
          </div>
        }
      />

      {composing && picker.selected && (
        <NewThread
          clientId={picker.selected}
          onDone={() => {
            setComposing(false)
            query.reload()
          }}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Waiting on us" value={String(awaitingFirm)} tone={awaitingFirm ? 'warn' : 'ok'} />
        <Stat label="Waiting on client" value={String(awaitingClient)} tone="info" />
        <Stat label="Unread messages" value={String(threads.reduce((s, t) => s + t.unread, 0))} />
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Threads</CardTitle>
          <span className="text-sm text-ink-muted">{threads.length}</span>
        </CardHeader>

        <Async
          query={query}
          isEmpty={(d) => d.length === 0}
          empty={
            <CardBody>
              <EmptyState
                title="No threads yet"
                hint="Start one above. A thread belongs to a single client, so the whole history of a query stays in one place."
              />
            </CardBody>
          }
        >
          {(list) => (
            <ul className="divide-y divide-hairline">
              {list.map((t) => (
                <ThreadRow key={t.id} thread={t} onDone={query.reload} />
              ))}
            </ul>
          )}
        </Async>
      </Card>
    </>
  )
}

function ThreadRow({ thread, onDone }: { thread: Thread; onDone: () => void }) {
  const [open, setOpen] = useState(false)
  const detail = useApi<ThreadDetail>(open ? `/threads/${thread.id}` : null)
  const reply = useAction()
  const status = useAction()
  const [body, setBody] = useState('')

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="press flex w-full flex-wrap items-start gap-x-4 gap-y-2 px-5 py-4 text-left hover:bg-paper-sunken/60"
      >
        <span
          aria-hidden
          className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-pill bg-tint-lilac text-xs font-medium text-ink"
        >
          {initials(thread.client_name)}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-sm font-medium text-ink">{thread.subject}</span>
            <span className="text-xs text-ink-muted">{thread.client_name}</span>
          </span>
          <span className="mt-1 block truncate text-sm text-ink-secondary">
            {thread.last_author && <span className="text-ink-muted">{thread.last_author}: </span>}
            {thread.last_message ?? 'No messages yet'}
          </span>
        </span>

        <span className="flex shrink-0 flex-wrap items-center gap-2">
          {thread.unread > 0 && <Badge tone="accent">{thread.unread} new</Badge>}
          <ThreadBadge status={thread.status} />
          <span className="nowrap-action text-xs text-ink-muted">
            {relative(thread.last_message_at)}
          </span>
        </span>
      </button>

      {open && (
        <div className="border-t border-hairline bg-paper-soft px-5 py-4">
          <Async query={detail}>
            {(d) => (
              <div className="flex flex-col gap-3">
                <ul className="flex flex-col gap-3">
                  {d.messages.map((m) => (
                    <li
                      key={m.id}
                      className={
                        m.author_kind === 'FIRM_USER'
                          ? 'self-end rounded-card rounded-br-sm bg-accent px-4 py-2.5 text-sm text-accent-ink sm:max-w-[80%]'
                          : 'self-start rounded-card rounded-bl-sm bg-paper-raised px-4 py-2.5 text-sm text-ink-secondary ring-1 ring-hairline sm:max-w-[80%]'
                      }
                    >
                      <span className="mb-1 block text-xs opacity-75">
                        {m.author} · {relative(m.created_at)}
                      </span>
                      <span className="whitespace-pre-wrap">{m.body}</span>
                    </li>
                  ))}
                </ul>

                <form
                  className="flex items-end gap-2"
                  onSubmit={async (e) => {
                    e.preventDefault()
                    if (!body.trim()) return
                    if (
                      await reply.run(() =>
                        api.post(`/threads/${thread.id}/messages`, { body: body.trim() }),
                      )
                    ) {
                      setBody('')
                      detail.reload()
                      onDone()
                    }
                  }}
                >
                  <label htmlFor={`reply-${thread.id}`} className="sr-only">
                    Reply to {thread.subject}
                  </label>
                  <Textarea
                    id={`reply-${thread.id}`}
                    rows={1}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Reply"
                    className="max-h-32 min-h-11"
                  />
                  <Button
                    type="submit"
                    size="md"
                    disabled={!body.trim()}
                    state={reply.busy ? 'loading' : 'idle'}
                    aria-label="Send reply"
                  >
                    <Send aria-hidden className="size-4" />
                  </Button>
                </form>
                <ActionError message={reply.error} />

                <label className="flex items-center gap-2 text-sm">
                  <span className="label shrink-0">Status</span>
                  <Select
                    value={d.status}
                    disabled={status.busy}
                    onChange={async (e) => {
                      if (
                        await status.run(() =>
                          api.patch(`/threads/${thread.id}`, { status: e.target.value }),
                        )
                      ) {
                        detail.reload()
                        onDone()
                      }
                    }}
                  >
                    <option value="OPEN">Open</option>
                    <option value="AWAITING_CLIENT">Awaiting client</option>
                    <option value="AWAITING_FIRM">Awaiting us</option>
                    <option value="CLOSED">Closed</option>
                  </Select>
                </label>
                <ActionError message={status.error} />
              </div>
            )}
          </Async>
        </div>
      )}
    </li>
  )
}

function NewThread({ clientId, onDone }: { clientId: string; onDone: () => void }) {
  const action = useAction()

  return (
    <Card className="mb-5">
      <CardHeader>
        <CardTitle>Start a thread</CardTitle>
      </CardHeader>
      <CardBody>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault()
            const data = new FormData(e.currentTarget)
            if (
              await action.run(() =>
                api.post(`/clients/${clientId}/threads`, {
                  subject: String(data.get('subject')).trim(),
                  body: String(data.get('body')).trim(),
                  channel: String(data.get('channel')),
                }),
              )
            )
              onDone()
          }}
        >
          <Field label="Subject">
            {(a) => <Input {...a} name="subject" required placeholder="September GSTR-2B queries" />}
          </Field>
          <Field label="Channel">
            {(a) => (
              <Select {...a} name="channel" defaultValue="CLIENT_PORTAL" className="h-11 w-full">
                {Object.entries(CHANNELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <div className="sm:col-span-2">
            <Field label="First message">
              {(a) => (
                <Textarea
                  {...a}
                  name="body"
                  rows={3}
                  required
                  placeholder="Three purchase invoices are not appearing in your 2B for September…"
                />
              )}
            </Field>
          </div>

          <div className="flex flex-col gap-2 sm:col-span-2">
            <ActionError message={action.error} />
            <div>
              <Button type="submit" size="sm" state={action.busy ? 'loading' : 'idle'}>
                Start thread
              </Button>
            </div>
          </div>
        </form>
      </CardBody>
    </Card>
  )
}
