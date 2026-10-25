'use client'

import Link from 'next/link'
import { ArrowUpRight, CircleAlert, FileText, Scale, Users } from 'lucide-react'
import { num } from '@/lib/api'
import { useApi } from '@/lib/use-api'
import { formatDate, inrCompact } from '@/lib/utils'
import type { FilingStatus } from '@/lib/enums'
import { PageHeader } from '@/components/app-shell/page-header'
import { DueIn, FilingBadge } from '@/components/app-shell/status'
import { Async, EmptyState } from '@/components/ui/async'
import { Card, CardBody, CardHeader, CardTitle, Stat } from '@/components/ui/surface'

/** The `/dashboard` payload. Decimals arrive as strings — see `num`. */
interface Dashboard {
  clients: number
  tasks: { overdue: number; due_this_week: number; open: number; filed: number }
  gst: {
    runs: number
    itc_at_risk: string
    invoices: number
    matched: number
    mismatched: number
  }
  risk: Record<string, number>
  bookkeeping: {
    total: number
    awaiting_review: number
    unclassified: number
    auto_applied: number
    auto_apply_rate: number | null
  }
  documents_to_review: number
  notices: {
    open: number
    due_14_days: number
    next: {
      id: string
      client: string
      notice_number: string
      section: string | null
      due_date: string
      days_left: number
    }[]
  }
  upcoming: {
    id: string
    client: string
    form: string
    period: string
    due_date: string
    days_left: number
    status: FilingStatus
  }[]
  activity: { at: string; actor: string; action: string; detail: string | null }[]
}

export default function DashboardPage() {
  const query = useApi<Dashboard>('/dashboard')

  return (
    <>
      <PageHeader
        title="Dashboard"
        lede="Where the firm stands today across clients, reconciliations and statutory deadlines."
      />

      <Async query={query}>
        {(d) => (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Stat
                label="Active clients"
                value={String(d.clients)}
                note={`${d.documents_to_review} document${d.documents_to_review === 1 ? '' : 's'} to review`}
                icon={<Users aria-hidden className="size-4" strokeWidth={1.75} />}
              />
              <Stat
                label="Overdue filings"
                value={String(d.tasks.overdue)}
                note={`${d.tasks.due_this_week} due in the next 7 days`}
                tone={d.tasks.overdue > 0 ? 'risk' : 'ok'}
                icon={<CircleAlert aria-hidden className="size-4" strokeWidth={1.75} />}
              />
              <Stat
                label="Unresolved mismatches"
                value={String(d.gst.mismatched)}
                note={`of ${d.gst.invoices} invoice${d.gst.invoices === 1 ? '' : 's'} reconciled`}
                tone={d.gst.mismatched > 0 ? 'warn' : 'ok'}
                icon={<Scale aria-hidden className="size-4" strokeWidth={1.75} />}
              />
              <Stat
                label="ITC at risk"
                value={inrCompact(num(d.gst.itc_at_risk))}
                note={`across ${d.gst.runs} reconciliation${d.gst.runs === 1 ? '' : 's'}`}
                tone={num(d.gst.itc_at_risk) > 0 ? 'warn' : 'ok'}
                icon={<FileText aria-hidden className="size-4" strokeWidth={1.75} />}
              />
            </div>

            {/* The classifier's own report card. auto_apply_rate is null until
                something has actually been classified — never render 0%. */}
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Stat
                label="Entries classified"
                value={String(d.bookkeeping.total)}
                note={
                  d.bookkeeping.auto_apply_rate === null
                    ? 'Nothing classified yet'
                    : `${(d.bookkeeping.auto_apply_rate * 100).toFixed(1)}% posted automatically`
                }
                tone="accent"
              />
              <Stat
                label="Awaiting review"
                value={String(d.bookkeeping.awaiting_review)}
                note="Below the auto-apply floor"
                tone={d.bookkeeping.awaiting_review > 0 ? 'warn' : 'ok'}
              />
              <Stat
                label="Open risk findings"
                value={String(Object.values(d.risk).reduce((a, b) => a + b, 0))}
                note={`${d.risk.CRITICAL ?? 0} critical · ${d.risk.HIGH ?? 0} high`}
                tone={(d.risk.CRITICAL ?? 0) + (d.risk.HIGH ?? 0) > 0 ? 'risk' : 'ok'}
              />
              <Stat
                label="Open notices"
                value={String(d.notices.open)}
                note={`${d.notices.due_14_days} due within 14 days`}
                tone={d.notices.due_14_days > 0 ? 'warn' : 'neutral'}
              />
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
              <Card>
                <CardHeader>
                  <CardTitle>Next deadlines</CardTitle>
                  <Link
                    href="/compliance"
                    className="press nowrap-action flex items-center gap-1 rounded-chip text-sm text-accent-strong"
                  >
                    Calendar
                    <ArrowUpRight aria-hidden className="size-3.5" />
                  </Link>
                </CardHeader>

                {d.upcoming.length === 0 ? (
                  <CardBody>
                    <p className="text-sm text-ink-muted">
                      Nothing outstanding. Generate a period from the compliance calendar to
                      populate this.
                    </p>
                  </CardBody>
                ) : (
                  <ul className="divide-y divide-hairline">
                    {d.upcoming.slice(0, 6).map((t) => (
                      <li
                        key={t.id}
                        className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline gap-2">
                            <span className="font-mono text-sm font-medium text-ink">{t.form}</span>
                            <span className="truncate text-xs text-ink-muted">{t.period}</span>
                          </span>
                          <span className="mt-0.5 block truncate text-sm text-ink-secondary">
                            {t.client}
                          </span>
                        </span>

                        <span className="tnum shrink-0 text-right">
                          <span className="block text-sm text-ink">{formatDate(t.due_date)}</span>
                          <DueIn days={t.days_left} />
                        </span>

                        <FilingBadge status={t.status} />
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recent activity</CardTitle>
                  <Link
                    href="/security"
                    className="press nowrap-action flex items-center gap-1 rounded-chip text-sm text-accent-strong"
                  >
                    Audit log
                    <ArrowUpRight aria-hidden className="size-3.5" />
                  </Link>
                </CardHeader>

                {d.activity.length === 0 ? (
                  <CardBody>
                    <EmptyState
                      title="No activity recorded"
                      hint="Every upload, review and run is written to the audit log as it happens."
                    />
                  </CardBody>
                ) : (
                  <ul className="divide-y divide-hairline">
                    {d.activity.map((a, i) => (
                      <li key={`${a.at}-${i}`} className="flex items-start gap-3 px-5 py-3">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-ink">{a.action}</span>
                          <span className="block truncate text-xs text-ink-muted">
                            {a.actor}
                            {a.detail ? ` · ${a.detail}` : ''}
                          </span>
                        </span>
                        <span className="tnum shrink-0 text-xs text-ink-muted">
                          {formatDate(a.at)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>

            {d.notices.next.length > 0 && (
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle>Notices needing a reply</CardTitle>
                  <Link
                    href="/notices"
                    className="press nowrap-action flex items-center gap-1 rounded-chip text-sm text-accent-strong"
                  >
                    All notices
                    <ArrowUpRight aria-hidden className="size-3.5" />
                  </Link>
                </CardHeader>
                <ul className="divide-y divide-hairline">
                  {d.notices.next.map((n) => (
                    <li key={n.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">
                          {n.client}
                        </span>
                        <span className="block truncate font-mono text-xs text-ink-muted">
                          {n.notice_number}
                          {n.section ? ` · s.${n.section}` : ''}
                        </span>
                      </span>
                      <span className="tnum shrink-0 text-right">
                        <span className="block text-sm text-ink">{formatDate(n.due_date)}</span>
                        <DueIn days={n.days_left} />
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </>
        )}
      </Async>
    </>
  )
}
