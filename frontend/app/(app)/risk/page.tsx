'use client'

import { useState } from 'react'
import { Play } from 'lucide-react'
import { api, num } from '@/lib/api'
import { useApi, useAction } from '@/lib/use-api'
import { RISK_CHECKS, severity, type RiskSeverity, type RiskStatus } from '@/lib/enums'
import { cn, formatDate, inr } from '@/lib/utils'
import { PageHeader } from '@/components/app-shell/page-header'
import { RiskBadge, SeverityBadge } from '@/components/app-shell/status'
import {
  ClientPicker,
  PeriodPicker,
  recentPeriods,
  useClientPicker,
} from '@/components/app-shell/pickers'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader, CardTitle, Stat } from '@/components/ui/surface'
import { ActionError, Async, EmptyState, Select } from '@/components/ui/async'

interface Finding {
  id: string
  client_id: string
  client_name: string
  check: string
  severity: RiskSeverity
  status: RiskStatus
  title: string
  detail: string | null
  evidence: Record<string, unknown> | null
  entry_count: number
  amount: string | null
  score: number | null
  period: string | null
  triage_note: string | null
  created_at: string
}

interface Benford {
  n: number
  sufficient: boolean
  minimum: number
  digits: { digit: number; expected: number; observed: number }[]
  chi_square: number | null
  p_value: number | null
}

export default function RiskPage() {
  const picker = useClientPicker()
  const [status, setStatus] = useState<string>('OPEN')
  const [note, setNote] = useState<string | null>(null)

  const findings = useApi<Finding[]>(
    `/risk/findings?limit=200${picker.selected ? `&client_id=${picker.selected}` : ''}${status ? `&status=${status}` : ''}`,
  )
  const benford = useApi<Benford>(
    picker.selected ? `/risk/benford?client_id=${picker.selected}` : '/risk/benford',
  )

  const open = findings.data?.filter((f) => f.status === 'OPEN') ?? []
  const serious = open.filter((f) => f.severity === 'HIGH' || f.severity === 'CRITICAL')
  const exposure = (findings.data ?? []).reduce((sum, f) => sum + num(f.amount), 0)

  return (
    <>
      <PageHeader
        title="Risk & audit"
        lede="Every transaction screened, rather than a sample tested. Seven unsupervised checks, each with its evidence attached."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ClientPicker
              clients={picker.clients}
              value={picker.selected}
              onChange={picker.setSelected}
            />
            {picker.selected && (
              <RunChecks
                clientId={picker.selected}
                onDone={(message) => {
                  setNote(message)
                  findings.reload()
                  benford.reload()
                }}
              />
            )}
          </div>
        }
      />

      {note && <p className="mb-4 text-sm text-ok">{note}</p>}

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Open findings" value={String(open.length)} tone={open.length ? 'warn' : 'ok'} />
        <Stat
          label="High or critical"
          value={String(serious.length)}
          tone={serious.length ? 'risk' : 'ok'}
        />
        <Stat label="Amount implicated" value={inr(exposure)} note="Across every listed finding" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Findings</CardTitle>
            <label className="flex items-center gap-2 text-sm">
              <span className="label shrink-0">Status</span>
              <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="OPEN">Open</option>
                <option value="ACKNOWLEDGED">Acknowledged</option>
                <option value="RESOLVED">Resolved</option>
                <option value="FALSE_POSITIVE">False positive</option>
                <option value="">All</option>
              </Select>
            </label>
          </CardHeader>

          <Async
            query={findings}
            isEmpty={(d) => d.length === 0}
            empty={
              <CardBody>
                <EmptyState
                  title="No findings"
                  hint="Run the checks for a period above. Nothing flagged is a result too — it means the screens found nothing to question."
                />
              </CardBody>
            }
          >
            {(list) => (
              <ul className="divide-y divide-hairline">
                {[...list]
                  .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
                  .map((f) => (
                    <FindingRow key={f.id} finding={f} onDone={findings.reload} />
                  ))}
              </ul>
            )}
          </Async>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>First-digit distribution</CardTitle>
          </CardHeader>
          <CardBody>
            <Async query={benford}>
              {(b) => (
                <>
                  <p className="text-sm text-ink-secondary">
                    Genuine accounting populations follow Benford&rsquo;s distribution. A digit
                    materially above its expected frequency is worth a look.
                  </p>

                  {/* The test is withheld below the minimum sample, because on a
                      small population chi-square produces confident nonsense. */}
                  <p className="mt-2 text-xs text-ink-muted">
                    {b.sufficient
                      ? `n = ${b.n} · χ² ${b.chi_square} · p = ${b.p_value}`
                      : `n = ${b.n}. Below ${b.minimum} samples no p-value is reported — the bars are counts only.`}
                  </p>

                  {b.n === 0 ? (
                    <p className="mt-4 text-sm text-ink-muted">
                      No entries to analyse for this client yet.
                    </p>
                  ) : (
                    <table className="mt-5 w-full border-collapse text-left text-sm">
                      <caption className="sr-only">
                        Observed against expected first-digit frequency, as a percentage
                      </caption>
                      <thead>
                        <tr>
                          <th scope="col" className="label pb-2 font-normal">
                            Digit
                          </th>
                          <th scope="col" className="label pb-2 font-normal">
                            Distribution
                          </th>
                          <th scope="col" className="label pb-2 text-right font-normal">
                            Obs.
                          </th>
                          <th scope="col" className="label pb-2 text-right font-normal">
                            Exp.
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {b.digits.map((d) => {
                          const max = Math.max(
                            ...b.digits.flatMap((x) => [x.expected, x.observed]),
                            1,
                          )
                          const over = d.observed - d.expected > 3
                          return (
                            <tr key={d.digit}>
                              <td className="py-1.5 pr-3 font-mono text-xs text-ink">{d.digit}</td>
                              <td className="w-full py-1.5 pr-3">
                                {/* Observed bar over an expected tick */}
                                <span className="relative block h-3 w-full rounded-pill bg-paper-sunken">
                                  <span
                                    className={cn(
                                      'absolute inset-y-0 left-0 rounded-pill',
                                      over ? 'bg-risk' : 'bg-accent-strong',
                                    )}
                                    style={{ width: `${(d.observed / max) * 100}%` }}
                                  />
                                  <span
                                    aria-hidden
                                    className="absolute inset-y-[-2px] w-0.5 rounded-pill bg-ink"
                                    style={{ left: `${(d.expected / max) * 100}%` }}
                                  />
                                </span>
                              </td>
                              <td
                                className={cn(
                                  'tnum py-1.5 text-right text-xs',
                                  over ? 'font-medium text-risk' : 'text-ink-secondary',
                                )}
                              >
                                {d.observed.toFixed(1)}%
                              </td>
                              <td className="tnum py-1.5 text-right text-xs text-ink-muted">
                                {d.expected.toFixed(1)}%
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}

                  <p className="mt-4 flex items-center gap-2 text-xs text-ink-muted">
                    <span aria-hidden className="inline-block h-3 w-0.5 rounded-pill bg-ink" />
                    expected frequency
                  </p>
                </>
              )}
            </Async>
          </CardBody>
        </Card>
      </div>
    </>
  )
}

function FindingRow({ finding, onDone }: { finding: Finding; onDone: () => void }) {
  const action = useAction()
  const [open, setOpen] = useState(false)

  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-ink">{finding.title}</span>
          <span className="block truncate text-xs text-ink-muted">
            {RISK_CHECKS[finding.check] ?? finding.check} · {finding.client_name}
            {finding.period ? ` · ${finding.period}` : ''} · {formatDate(finding.created_at)}
          </span>
        </span>

        {finding.amount && (
          <span className="tnum shrink-0 text-sm font-medium text-ink">
            {inr(num(finding.amount))}
          </span>
        )}

        <span className="flex shrink-0 items-center gap-2">
          {finding.score !== null && (
            <span className="tnum font-mono text-sm text-ink-secondary">
              {Math.round(finding.score)}
            </span>
          )}
          <SeverityBadge level={finding.severity} />
          <RiskBadge status={finding.status} />
        </span>
      </div>

      {finding.detail && <p className="mt-2 text-sm text-ink-secondary">{finding.detail}</p>}

      {finding.triage_note && (
        <p className="mt-1.5 text-xs text-ink-muted">Triage note: {finding.triage_note}</p>
      )}

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {finding.entry_count > 0 && (
          <span className="text-xs text-ink-muted">
            {finding.entry_count} entr{finding.entry_count === 1 ? 'y' : 'ies'} implicated
          </span>
        )}
        {finding.evidence && Object.keys(finding.evidence).length > 0 && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="press nowrap-action rounded-chip text-xs text-accent-strong"
          >
            {open ? 'Hide evidence' : 'Show evidence'}
          </button>
        )}
      </div>

      {/* The evidence is what makes a finding reviewable rather than an
          accusation — it is the numbers the check actually fired on. */}
      {open && finding.evidence && (
        <pre className="scroll-slim mt-2 overflow-x-auto rounded-control bg-paper-sunken p-3 font-mono text-xs text-ink-secondary">
          {JSON.stringify(finding.evidence, null, 2)}
        </pre>
      )}

      {finding.status === 'OPEN' && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {(
            [
              ['ACKNOWLEDGED', 'Acknowledge'],
              ['RESOLVED', 'Resolve'],
              ['FALSE_POSITIVE', 'False positive'],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              variant="secondary"
              size="sm"
              state={action.busy ? 'loading' : 'idle'}
              onClick={async () => {
                if (
                  await action.run(() =>
                    api.patch(`/risk/findings/${finding.id}`, { status: value }),
                  )
                )
                  onDone()
              }}
            >
              {label}
            </Button>
          ))}
          <ActionError message={action.error} />
        </div>
      )}
    </li>
  )
}

function RunChecks({
  clientId,
  onDone,
}: {
  clientId: string
  onDone: (message: string) => void
}) {
  const [period, setPeriod] = useState(recentPeriods()[1])
  const action = useAction()

  return (
    <span className="flex flex-col items-end gap-1">
      <span className="flex items-center gap-2">
        <PeriodPicker value={period} onChange={setPeriod} />
        <Button
          size="sm"
          state={action.busy ? 'loading' : 'idle'}
          onClick={async () => {
            await action.run(async () => {
              const run = await api.post<{
                headline: string
                transactions_examined: number
                skipped: Record<string, string>
              }>(`/clients/${clientId}/risk/runs`, { period })
              const skipped = Object.keys(run.skipped ?? {}).length
              onDone(
                `${run.headline} (${run.transactions_examined} examined${skipped ? `, ${skipped} check${skipped === 1 ? '' : 's'} skipped` : ''}).`,
              )
            })
          }}
        >
          <Play aria-hidden className="size-4" />
          {action.busy ? 'Running' : 'Run checks'}
        </Button>
      </span>
      <ActionError message={action.error} />
    </span>
  )
}
