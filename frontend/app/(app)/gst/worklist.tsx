'use client'

import { useMemo, useRef, useState } from 'react'
import { Check, Play, Upload } from 'lucide-react'
import { api, num } from '@/lib/api'
import { useApi, useAction } from '@/lib/use-api'
import { match, type MatchStatus } from '@/lib/enums'
import { cn, formatDate, inr } from '@/lib/utils'
import { PageHeader } from '@/components/app-shell/page-header'
import { MatchBadge } from '@/components/app-shell/status'
import {
  ClientPicker,
  PeriodPicker,
  periodLabel,
  recentPeriods,
  useClientPicker,
} from '@/components/app-shell/pickers'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader, CardTitle, Stat } from '@/components/ui/surface'
import { ActionError, Async, EmptyState, ErrorState, Select } from '@/components/ui/async'

interface Line {
  id: string
  supplier_name: string | null
  supplier_gstin: string | null
  invoice_no: string | null
  invoice_date: string | null
  books_taxable: string | null
  books_tax: string | null
  portal_taxable: string | null
  portal_tax: string | null
  tax_difference: string | null
  status: MatchStatus
  confidence: number | null
  match_pass: string | null
  match_note: string | null
  resolved: boolean
  resolution_note: string | null
}

interface Run {
  id: string
  client_id: string
  client_name: string
  period: string
  status: string
  total_lines: number
  matched_lines: number
  mismatched_lines: number
  match_rate: number | null
  itc_at_risk: string
  itc_unclaimed: string
  fuzzy_matches: number
  open_lines: number
  created_at: string
}

interface RunDetail extends Run {
  lines: Line[]
}

type Filter = 'all' | MatchStatus

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'MATCHED', label: match.label('MATCHED') },
  { key: 'AMOUNT_MISMATCH', label: match.label('AMOUNT_MISMATCH') },
  { key: 'MISSING_IN_2B', label: match.label('MISSING_IN_2B') },
  { key: 'MISSING_IN_BOOKS', label: match.label('MISSING_IN_BOOKS') },
]

export function ReconciliationWorklist() {
  const picker = useClientPicker()
  const [filter, setFilter] = useState<Filter>('all')
  const [runId, setRunId] = useState<string | null>(null)

  // Returns a bare list, not a paged envelope — unlike /clients and /entries.
  const runs = useApi<Run[]>(
    picker.selected ? `/gst/reconciliations?client_id=${picker.selected}` : null,
  )

  // The newest run is the one a reviewer wants on arrival; an explicit choice
  // from the dropdown wins over it.
  const activeId = runId ?? runs.data?.[0]?.id ?? null
  const detail = useApi<RunDetail>(activeId ? `/gst/reconciliations/${activeId}` : null)

  const rows = useMemo(() => {
    const lines = detail.data?.lines ?? []
    return filter === 'all' ? lines : lines.filter((l) => l.status === filter)
  }, [detail.data, filter])

  return (
    <>
      <PageHeader
        title="GST reconciliation"
        lede="GSTR-2B against the books, matched on GSTIN, invoice number, date and value."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ClientPicker
              clients={picker.clients}
              value={picker.selected}
              onChange={(id) => {
                picker.setSelected(id)
                setRunId(null)
              }}
            />
            {runs.data && runs.data.length > 0 && (
              <label className="flex items-center gap-2 text-sm">
                <span className="label shrink-0">Run</span>
                <Select
                  value={activeId ?? ''}
                  onChange={(e) => setRunId(e.target.value)}
                >
                  {runs.data.map((r) => (
                    <option key={r.id} value={r.id}>
                      {periodLabel(r.period)} · {r.total_lines} lines
                    </option>
                  ))}
                </Select>
              </label>
            )}
          </div>
        }
      />

      {picker.error && <ErrorState message={picker.error} />}

      {picker.selected && (
        <NewRun clientId={picker.selected} onDone={() => { setRunId(null); runs.reload() }} />
      )}

      {runs.data && runs.data.length === 0 && !runs.loading && (
        <EmptyState
          title="No reconciliations for this client"
          hint="Upload a GSTR-2B JSON above and the matcher will compare it against the purchase invoices already in the books."
        />
      )}

      {activeId && (
        <Async query={detail}>
          {(run) => (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Stat
                  label="Matched"
                  value={`${run.matched_lines} / ${run.total_lines}`}
                  tone={run.mismatched_lines === 0 ? 'ok' : 'neutral'}
                  note={
                    run.match_rate === null
                      ? 'Nothing to match'
                      : `${(run.match_rate * 100).toFixed(0)}% match rate`
                  }
                />
                <Stat
                  label="Exceptions"
                  value={String(run.mismatched_lines)}
                  tone={run.mismatched_lines > 0 ? 'warn' : 'ok'}
                  note={`${run.open_lines} still open`}
                />
                <Stat
                  label="ITC at risk"
                  value={inr(num(run.itc_at_risk))}
                  tone={num(run.itc_at_risk) > 0 ? 'risk' : 'ok'}
                  note="Claimed in books, absent from 2B"
                />
                <Stat
                  label="ITC unclaimed"
                  value={inr(num(run.itc_unclaimed))}
                  note="In 2B, not yet in books"
                />
              </div>

              {run.fuzzy_matches > 0 && (
                <p className="mt-3 text-xs text-ink-muted">
                  {run.fuzzy_matches} row{run.fuzzy_matches === 1 ? ' was' : 's were'} paired by
                  near-match rather than an exact invoice number — check the confidence column.
                </p>
              )}

              <div
                role="group"
                aria-label="Filter by match status"
                className="scroll-slim mt-6 flex gap-1.5 overflow-x-auto pb-1"
              >
                {FILTERS.map((f) => {
                  const active = filter === f.key
                  const count =
                    f.key === 'all'
                      ? run.lines.length
                      : run.lines.filter((l) => l.status === f.key).length
                  return (
                    <button
                      key={f.key}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setFilter(f.key)}
                      className={cn(
                        'press nowrap-action rounded-pill border px-3.5 py-1.5 text-sm',
                        active
                          ? 'border-accent-strong bg-accent text-accent-ink'
                          : 'border-hairline-strong bg-paper-raised text-ink-secondary hover:bg-paper-sunken',
                      )}
                    >
                      {f.label}
                      <span className="ml-1.5 text-xs opacity-70">{count}</span>
                    </button>
                  )
                })}
              </div>

              {rows.length === 0 ? (
                <Card className="mt-4 p-8 text-center">
                  <p className="text-sm text-ink-secondary">
                    No rows with that status in this period.
                  </p>
                </Card>
              ) : (
                <>
                  {/* Desktop: comparison table */}
                  <Card className="mt-4 hidden overflow-hidden md:block">
                    <div className="scroll-slim overflow-x-auto">
                      <table className="w-full min-w-[62rem] border-collapse text-left text-sm">
                        <thead>
                          <tr className="border-b border-hairline bg-paper-sunken">
                            {[
                              'Supplier',
                              'Invoice',
                              'Books tax',
                              'GSTR-2B tax',
                              'Difference',
                              'Status',
                              '',
                            ].map((h, i) => (
                              <th
                                key={h || i}
                                scope="col"
                                className={cn(
                                  'px-4 py-3 font-medium text-ink-secondary',
                                  i >= 2 && i <= 4 && 'text-right',
                                )}
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-hairline">
                          {rows.map((l) => (
                            <tr key={l.id} className="hover:bg-paper-sunken/60">
                              <td className="px-4 py-3">
                                <span className="block font-medium text-ink">
                                  {l.supplier_name ?? 'Unknown supplier'}
                                </span>
                                <span className="block font-mono text-xs text-ink-muted">
                                  {l.supplier_gstin ?? '—'}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="block font-mono text-xs text-ink">
                                  {l.invoice_no ?? '—'}
                                </span>
                                <span className="block text-xs text-ink-muted">
                                  {l.invoice_date ? formatDate(l.invoice_date) : '—'}
                                  {l.confidence !== null && l.confidence < 1
                                    ? ` · ${(l.confidence * 100).toFixed(0)}%`
                                    : ''}
                                </span>
                              </td>
                              <td className="tnum px-4 py-3 text-right">
                                {l.books_tax === null ? (
                                  <span className="text-ink-faint">&mdash;</span>
                                ) : (
                                  inr(num(l.books_tax))
                                )}
                              </td>
                              <td className="tnum px-4 py-3 text-right">
                                {l.portal_tax === null ? (
                                  <span className="text-ink-faint">&mdash;</span>
                                ) : (
                                  inr(num(l.portal_tax))
                                )}
                              </td>
                              <td
                                className={cn(
                                  'tnum px-4 py-3 text-right font-medium',
                                  num(l.tax_difference) === 0 ? 'text-ink-muted' : 'text-warn',
                                )}
                              >
                                {num(l.tax_difference) === 0 ? '—' : inr(num(l.tax_difference))}
                              </td>
                              <td className="px-4 py-3">
                                <MatchBadge status={l.status} />
                                {l.match_note && (
                                  <span className="mt-1 block text-xs text-ink-muted">
                                    {l.match_note}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <ResolveLine line={l} onDone={detail.reload} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>

                  {/* Mobile: the same rows as cards. A 7-column table at 375px is unusable. */}
                  <ul className="mt-4 flex flex-col gap-3 md:hidden">
                    {rows.map((l) => (
                      <Card as="li" key={l.id} className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-medium text-ink">
                              {l.supplier_name ?? 'Unknown supplier'}
                            </p>
                            <p className="truncate font-mono text-xs text-ink-muted">
                              {l.invoice_no ?? '—'}
                            </p>
                          </div>
                          <MatchBadge status={l.status} />
                        </div>

                        <dl className="tnum mt-3 grid grid-cols-3 gap-2 border-t border-hairline pt-3 text-sm">
                          <div>
                            <dt className="label">Books</dt>
                            <dd className="mt-0.5 text-ink">
                              {l.books_tax === null ? '—' : inr(num(l.books_tax))}
                            </dd>
                          </div>
                          <div>
                            <dt className="label">2B</dt>
                            <dd className="mt-0.5 text-ink">
                              {l.portal_tax === null ? '—' : inr(num(l.portal_tax))}
                            </dd>
                          </div>
                          <div>
                            <dt className="label">Diff</dt>
                            <dd
                              className={cn(
                                'mt-0.5',
                                num(l.tax_difference) ? 'font-medium text-warn' : 'text-ink-muted',
                              )}
                            >
                              {num(l.tax_difference) ? inr(num(l.tax_difference)) : '—'}
                            </dd>
                          </div>
                        </dl>

                        <div className="mt-3">
                          <ResolveLine line={l} onDone={detail.reload} />
                        </div>
                      </Card>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </Async>
      )}
    </>
  )
}

/**
 * Marks an exception as dealt with. The note is required by the API, and
 * rightly so: "resolved" with no reason is not an audit trail.
 */
function ResolveLine({ line, onDone }: { line: Line; onDone: () => void }) {
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const action = useAction()

  if (line.status === 'MATCHED') return null
  if (line.resolved) {
    return (
      <span className="flex items-center gap-1 text-xs text-ok">
        <Check aria-hidden className="size-3.5" />
        Resolved
      </span>
    )
  }

  if (!open) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Resolve
      </Button>
    )
  }

  return (
    <form
      className="flex flex-col gap-1.5"
      onSubmit={async (e) => {
        e.preventDefault()
        const ok = await action.run(() =>
          api.patch(`/gst/reconciliation-lines/${line.id}`, { resolution_note: note }),
        )
        if (ok) {
          setOpen(false)
          onDone()
        }
      }}
    >
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        required
        placeholder="Why is this acceptable?"
        aria-label="Resolution note"
        className="h-9 w-48 rounded-control border border-hairline-strong bg-paper-raised px-2.5 text-sm text-ink"
      />
      <div className="flex gap-1.5">
        <Button type="submit" size="sm" state={action.busy ? 'loading' : 'idle'}>
          Save
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      <ActionError message={action.error} />
    </form>
  )
}

/** Uploads a GSTR-2B export and runs the matcher against the books. */
function NewRun({ clientId, onDone }: { clientId: string; onDone: () => void }) {
  const [period, setPeriod] = useState(recentPeriods()[1])
  const [open, setOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const action = useAction()

  return (
    <Card className="mb-5">
      <CardHeader>
        <CardTitle>Run a reconciliation</CardTitle>
        <Button variant="ghost" size="sm" onClick={() => setOpen((v) => !v)}>
          {open ? 'Hide' : 'Show'}
        </Button>
      </CardHeader>
      {open && (
        <CardBody>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={async (e) => {
              e.preventDefault()
              const file = fileRef.current?.files?.[0]
              if (!file) return
              const body = new FormData()
              body.set('period', period)
              body.set('portal_file', file)
              body.set('replace', 'true')
              const ok = await action.run(() =>
                api.form(`/clients/${clientId}/gst/reconciliations`, body),
              )
              if (ok) {
                if (fileRef.current) fileRef.current.value = ''
                onDone()
              }
            }}
          >
            <PeriodPicker value={period} onChange={setPeriod} />

            <label className="flex flex-col gap-1 text-sm">
              <span className="label">GSTR-2B export</span>
              <input
                ref={fileRef}
                type="file"
                accept=".json,.csv,.xlsx,application/json"
                required
                className="text-sm text-ink-secondary file:mr-3 file:rounded-pill file:border file:border-hairline-strong file:bg-paper-raised file:px-3 file:py-1.5 file:text-sm file:text-ink"
              />
            </label>

            <Button type="submit" size="sm" state={action.busy ? 'loading' : 'idle'}>
              {action.busy ? (
                'Matching'
              ) : (
                <>
                  <Play aria-hidden className="size-4" />
                  Reconcile
                </>
              )}
            </Button>

            <p className="w-full text-xs text-ink-muted">
              <Upload aria-hidden className="mr-1 inline size-3" />
              The portal JSON is matched against purchase invoices already extracted into the
              books for this period. Nothing is posted — exceptions come back for review.
            </p>
            <ActionError message={action.error} />
          </form>
        </CardBody>
      )}
    </Card>
  )
}
