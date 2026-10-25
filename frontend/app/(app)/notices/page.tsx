'use client'

import { useState } from 'react'
import { CheckCircle2, PenLine, Sparkles } from 'lucide-react'
import { api, num, qs } from '@/lib/api'
import { useApi, useAction } from '@/lib/use-api'
import { AUTHORITIES, type NoticeStatus } from '@/lib/enums'
import { cn, formatDate, inr } from '@/lib/utils'
import { PageHeader } from '@/components/app-shell/page-header'
import { NoticeBadge } from '@/components/app-shell/status'
import { ClientPicker, useClientPicker } from '@/components/app-shell/pickers'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader, CardTitle, Stat } from '@/components/ui/surface'
import { ActionError, Async, EmptyState, Select } from '@/components/ui/async'
import { Textarea } from '@/components/ui/field'

interface Notice {
  id: string
  client_id: string
  client_name: string
  notice_number: string
  authority: string
  section_code: string | null
  subject: string | null
  issued_on: string | null
  received_on: string | null
  due_date: string
  days_left: number
  demand_amount: string | null
  status: NoticeStatus
  has_draft: boolean
  draft_approved: boolean
}

interface NoticeDetail extends Notice {
  draft_response: string | null
  draft_model: string | null
  cited_cases: { citation?: string; title?: string }[]
}

export default function NoticesPage() {
  const picker = useClientPicker()
  const [status, setStatus] = useState('')
  const query = useApi<Notice[]>(
    `/notices${qs({ client_id: picker.selected, status })}`,
  )

  const list = query.data ?? []
  const live = list.filter((n) => n.status !== 'CLOSED' && n.status !== 'RESPONSE_FILED')
  const exposure = live.reduce((sum, n) => sum + num(n.demand_amount), 0)

  return (
    <>
      <PageHeader
        title="Notices & litigation"
        lede="Notices parsed on upload — authority, section, demand and reply deadline extracted, then drafted against only the facts on file."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ClientPicker
              clients={picker.clients}
              value={picker.selected}
              onChange={picker.setSelected}
            />
            <label className="flex items-center gap-2 text-sm">
              <span className="label shrink-0">Status</span>
              <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">All</option>
                <option value="RECEIVED">Received</option>
                <option value="UNDER_REVIEW">Under review</option>
                <option value="RESPONSE_DRAFTED">Reply drafted</option>
                <option value="RESPONSE_FILED">Reply filed</option>
                <option value="CLOSED">Closed</option>
              </Select>
            </label>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Open matters" value={String(live.length)} tone={live.length ? 'warn' : 'ok'} />
        <Stat label="Demand at stake" value={inr(exposure)} tone={exposure ? 'risk' : 'ok'} />
        <Stat
          label="Closed"
          value={String(list.filter((n) => n.status === 'CLOSED').length)}
          tone="ok"
        />
      </div>

      <Async
        query={query}
        isEmpty={(d) => d.length === 0}
        empty={
          <div className="mt-4">
            <EmptyState
              title="No notices on file"
              hint="Upload a notice PDF from the Documents page with kind “Notice” — the fields are extracted on upload and the matter can be recorded from it."
            />
          </div>
        }
      >
        {(rows) => (
          <ul className="mt-4 flex flex-col gap-3">
            {rows.map((n) => (
              <NoticeCard key={n.id} notice={n} onDone={query.reload} />
            ))}
          </ul>
        )}
      </Async>
    </>
  )
}

function NoticeCard({ notice, onDone }: { notice: Notice; onDone: () => void }) {
  const [open, setOpen] = useState(false)
  const detail = useApi<NoticeDetail>(open ? `/notices/${notice.id}` : null)
  const live = notice.status !== 'CLOSED' && notice.status !== 'RESPONSE_FILED'

  return (
    <Card as="li">
      <CardBody className="flex flex-wrap items-start gap-x-6 gap-y-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="font-mono text-sm font-medium text-ink">{notice.notice_number}</p>
            <NoticeBadge status={notice.status} />
          </div>
          <p className="mt-1.5 text-sm text-ink-secondary">
            {notice.section_code ? `s.${notice.section_code} · ` : ''}
            {AUTHORITIES[notice.authority] ?? notice.authority}
          </p>
          <p className="mt-0.5 text-sm text-ink">{notice.client_name}</p>
          {notice.subject && (
            <p className="mt-1 max-w-[60ch] text-sm text-ink-secondary">{notice.subject}</p>
          )}
        </div>

        <dl className="tnum flex flex-wrap gap-x-8 gap-y-3">
          <div>
            <dt className="label">Received</dt>
            <dd className="mt-0.5 text-sm text-ink">
              {notice.received_on ? formatDate(notice.received_on) : '—'}
            </dd>
          </div>
          <div>
            <dt className="label">Reply by</dt>
            <dd className="mt-0.5 text-sm text-ink">{formatDate(notice.due_date)}</dd>
            {live && (
              <dd
                className={cn(
                  'text-xs',
                  notice.days_left < 0
                    ? 'text-risk'
                    : notice.days_left <= 14
                      ? 'text-warn'
                      : 'text-ink-muted',
                )}
              >
                {notice.days_left < 0
                  ? `${Math.abs(notice.days_left)} days overdue`
                  : `in ${notice.days_left} days`}
              </dd>
            )}
          </div>
          <div>
            <dt className="label">Demand</dt>
            <dd className="mt-0.5 text-sm font-medium text-ink">
              {num(notice.demand_amount) === 0 ? (
                <span className="text-ink-faint">Nil</span>
              ) : (
                inr(num(notice.demand_amount))
              )}
            </dd>
          </div>
        </dl>

        <div className="flex shrink-0 gap-2">
          <Button variant="secondary" size="sm" onClick={() => setOpen((v) => !v)}>
            {open ? 'Close' : 'Open'}
          </Button>
        </div>
      </CardBody>

      {open && (
        <div className="border-t border-hairline px-5 py-4">
          <Async query={detail}>
            {(d) => <DraftPanel notice={d} onDone={() => { detail.reload(); onDone() }} />}
          </Async>
        </div>
      )}
    </Card>
  )
}

/**
 * Drafting and approval.
 *
 * The draft is generated from the notice's own extracted facts and nothing
 * else. Where a fact is missing the model is instructed to leave a
 * `[TO CONFIRM: ...]` marker rather than invent one, and the provider is
 * labelled — a template fallback says `template`, so nobody mistakes a
 * boilerplate reply for a reasoned one.
 */
function DraftPanel({ notice, onDone }: { notice: NoticeDetail; onDone: () => void }) {
  const [instructions, setInstructions] = useState('')
  const [draft, setDraft] = useState<string | null>(null)
  const [provider, setProvider] = useState<string | null>(null)
  const [reason, setReason] = useState<string | null>(null)
  const action = useAction()
  const approve = useAction()

  const body = draft ?? notice.draft_response

  return (
    <div className="flex flex-col gap-3">
      {!body && (
        <>
          <label className="flex flex-col gap-1.5">
            <span className="label">Instructions for the draft (optional)</span>
            <Textarea
              rows={2}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="e.g. the difference arises from a credit note issued in the following month"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              state={action.busy ? 'loading' : 'idle'}
              onClick={async () => {
                await action.run(async () => {
                  const result = await api.post<{
                    notice: NoticeDetail
                    provider: string
                    fallback_reason: string | null
                  }>(`/notices/${notice.id}/draft`, {
                    instructions: instructions.trim() || null,
                  })
                  setDraft(result.notice.draft_response)
                  setProvider(result.provider)
                  setReason(result.fallback_reason)
                  onDone()
                })
              }}
            >
              <PenLine aria-hidden className="size-4" />
              {action.busy ? 'Drafting' : 'Draft reply'}
            </Button>
            <ActionError message={action.error} />
          </div>
        </>
      )}

      {body && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="label">Draft reply</span>
            {(provider ?? notice.draft_model) && (
              <span className="flex items-center gap-1 text-xs text-ink-muted">
                <Sparkles aria-hidden className="size-3" />
                {provider ?? notice.draft_model}
              </span>
            )}
            {notice.draft_approved && (
              <span className="flex items-center gap-1 text-xs text-ok">
                <CheckCircle2 aria-hidden className="size-3.5" />
                Approved
              </span>
            )}
          </div>

          {reason && (
            <p className="text-xs text-warn">
              Generated from a template rather than a model: {reason}
            </p>
          )}

          <pre className="scroll-slim max-h-80 overflow-auto whitespace-pre-wrap rounded-control bg-paper-sunken p-4 text-sm text-ink-secondary">
            {body}
          </pre>

          {notice.cited_cases.length > 0 && (
            <div>
              <p className="label">Authorities cited</p>
              <ul className="mt-1 flex flex-col gap-0.5">
                {notice.cited_cases.map((c, i) => (
                  <li key={i} className="text-xs text-ink-secondary">
                    {c.citation ?? ''} {c.title ?? ''}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!notice.draft_approved && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                state={approve.busy ? 'loading' : 'idle'}
                onClick={async () => {
                  if (await approve.run(() => api.post(`/notices/${notice.id}/approve`))) onDone()
                }}
              >
                <CheckCircle2 aria-hidden className="size-4" />
                Approve reply
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDraft(null)
                  setProvider(null)
                  setReason(null)
                }}
              >
                Redraft
              </Button>
              <ActionError message={approve.error} />
            </div>
          )}
        </>
      )}
    </div>
  )
}
