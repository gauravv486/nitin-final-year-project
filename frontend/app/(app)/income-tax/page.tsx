'use client'

import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { api, num } from '@/lib/api'
import { useApi, useAction } from '@/lib/use-api'
import { AIS_HEADS, type FilingStatus } from '@/lib/enums'
import { cn, inr } from '@/lib/utils'
import { PageHeader } from '@/components/app-shell/page-header'
import { FilingBadge } from '@/components/app-shell/status'
import { ClientPicker, useClientPicker } from '@/components/app-shell/pickers'
import { Button } from '@/components/ui/button'
import { Badge, Card, CardBody, CardHeader, CardTitle, Stat } from '@/components/ui/surface'
import { ActionError, Async, EmptyState, Select } from '@/components/ui/async'

interface Line {
  id: string
  head: string
  counterparty: string | null
  tan: string | null
  ais_amount: string
  books_amount: string | null
  tds_credit: string | null
  variance: string | null
  flagged: boolean
  note: string | null
}

interface Statement {
  id: string
  client_id: string
  client_name: string
  assessment_year: string
  financial_year: string
  status: FilingStatus
  ais_total: string
  books_total: string
  variance_total: string
  flagged_lines: number
  tds_total: string
  created_at: string
}

interface StatementDetail extends Statement {
  lines: Line[]
}

/** AY runs one year ahead of the FY: FY 2026-27 is assessed in AY 2027-28. */
function assessmentYears(count = 5): string[] {
  const now = new Date()
  const fyStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
  return Array.from({ length: count }, (_, i) => {
    const start = fyStart + 1 - i
    return `${start}-${String((start + 1) % 100).padStart(2, '0')}`
  })
}

export default function IncomeTaxPage() {
  const picker = useClientPicker()
  const [statementId, setStatementId] = useState<string | null>(null)

  const statements = useApi<Statement[]>(
    picker.selected ? `/ais/statements?client_id=${picker.selected}` : null,
  )
  const activeId = statementId ?? statements.data?.[0]?.id ?? null
  const detail = useApi<StatementDetail>(activeId ? `/ais/statements/${activeId}` : null)

  return (
    <>
      <PageHeader
        title="Income tax & AIS"
        lede="The Annual Information Statement matched line by line against the book entries for the same year."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ClientPicker
              clients={picker.clients}
              value={picker.selected}
              onChange={(id) => {
                picker.setSelected(id)
                setStatementId(null)
              }}
            />
            {statements.data && statements.data.length > 0 && (
              <label className="flex items-center gap-2 text-sm">
                <span className="label shrink-0">AY</span>
                <Select
                  value={activeId ?? ''}
                  onChange={(e) => setStatementId(e.target.value)}
                >
                  {statements.data.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.assessment_year}
                    </option>
                  ))}
                </Select>
              </label>
            )}
            {picker.selected && (
              <ImportAis
                clientId={picker.selected}
                onDone={() => {
                  setStatementId(null)
                  statements.reload()
                }}
              />
            )}
          </div>
        }
      />

      {statements.data && statements.data.length === 0 && !statements.loading && (
        <EmptyState
          title="No AIS statements for this client"
          hint="Import the AIS CSV or XLSX export above. Each line is matched against the books by counterparty, TAN and amount."
        />
      )}

      {activeId && (
        <Async query={detail}>
          {(s) => (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Stat label="AIS total" value={inr(num(s.ais_total))} note={s.assessment_year} />
                <Stat label="Books total" value={inr(num(s.books_total))} />
                <Stat
                  label="Unexplained"
                  value={inr(Math.abs(num(s.variance_total)))}
                  tone={num(s.variance_total) === 0 ? 'ok' : 'warn'}
                  note={`${s.flagged_lines} line${s.flagged_lines === 1 ? '' : 's'} differ`}
                />
                <Stat
                  label="TDS credit"
                  value={inr(num(s.tds_total))}
                  tone="info"
                  note="Claimable against liability"
                />
              </div>

              <div className="mt-4">
                <FilingBadge status={s.status} />
              </div>

              <Card className="mt-4 overflow-hidden">
                <CardHeader>
                  <CardTitle>AIS against books</CardTitle>
                  <span className="text-sm text-ink-muted">{s.lines.length} lines</span>
                </CardHeader>

                {s.lines.length === 0 ? (
                  <CardBody>
                    <p className="text-sm text-ink-muted">This statement has no lines.</p>
                  </CardBody>
                ) : (
                  <div className="scroll-slim overflow-x-auto">
                    <table className="w-full min-w-[46rem] border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b border-hairline bg-paper-sunken">
                          <th scope="col" className="px-5 py-3 font-medium text-ink-secondary">
                            Source
                          </th>
                          <th scope="col" className="px-5 py-3 font-medium text-ink-secondary">
                            Head
                          </th>
                          {['AIS', 'Books', 'TDS'].map((h) => (
                            <th
                              key={h}
                              scope="col"
                              className="px-5 py-3 text-right font-medium text-ink-secondary"
                            >
                              {h}
                            </th>
                          ))}
                          <th scope="col" className="px-5 py-3 font-medium text-ink-secondary">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-hairline">
                        {s.lines.map((r) => {
                          const missing = r.books_amount === null
                          const variance = num(r.variance)
                          return (
                            <tr key={r.id} className="hover:bg-paper-sunken/60">
                              <td className="px-5 py-3">
                                <span className="block font-medium text-ink">
                                  {r.counterparty ?? '—'}
                                </span>
                                {r.tan && (
                                  <span className="block font-mono text-xs text-ink-muted">
                                    {r.tan}
                                  </span>
                                )}
                              </td>
                              <td className="px-5 py-3 text-ink-secondary">
                                {AIS_HEADS[r.head] ?? r.head}
                              </td>
                              <td className="tnum px-5 py-3 text-right">
                                {inr(num(r.ais_amount))}
                              </td>
                              <td
                                className={cn('tnum px-5 py-3 text-right', missing && 'text-ink-faint')}
                              >
                                {missing ? '—' : inr(num(r.books_amount))}
                              </td>
                              <td className="tnum px-5 py-3 text-right text-ink-secondary">
                                {num(r.tds_credit) === 0 ? (
                                  <span className="text-ink-faint">&mdash;</span>
                                ) : (
                                  inr(num(r.tds_credit))
                                )}
                              </td>
                              <td className="px-5 py-3">
                                {!r.flagged ? (
                                  <Badge tone="ok">Matched</Badge>
                                ) : missing ? (
                                  <Badge tone="risk">Not in books</Badge>
                                ) : (
                                  <Badge tone="warn">Differs by {inr(Math.abs(variance))}</Badge>
                                )}
                                {r.note && (
                                  <span className="mt-1 block text-xs text-ink-muted">{r.note}</span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>

              <p className="mt-4 text-xs text-ink-muted">
                Rows that differ must be explained before the return is prepared — an AIS entry
                with no corresponding book entry is the most common cause of a s.143(1) notice.
              </p>
            </>
          )}
        </Async>
      )}
    </>
  )
}

function ImportAis({ clientId, onDone }: { clientId: string; onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [year, setYear] = useState(assessmentYears()[0])
  const action = useAction()

  return (
    <span className="flex flex-col items-end gap-1">
      <span className="flex items-center gap-2">
        <label className="flex items-center gap-2 text-sm">
          <span className="label shrink-0">Import AY</span>
          <Select value={year} onChange={(e) => setYear(e.target.value)}>
            {assessmentYears().map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        </label>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.xlsx"
          className="sr-only"
          onChange={async (e) => {
            const file = e.target.files?.[0]
            if (!file) return
            const body = new FormData()
            body.set('assessment_year', year)
            body.set('file', file)
            body.set('replace', 'true')
            const ok = await action.run(() => api.form(`/clients/${clientId}/ais/upload`, body))
            if (fileRef.current) fileRef.current.value = ''
            if (ok) onDone()
          }}
        />
        <Button
          variant="secondary"
          size="sm"
          state={action.busy ? 'loading' : 'idle'}
          onClick={() => fileRef.current?.click()}
        >
          <Upload aria-hidden className="size-4" />
          {action.busy ? 'Matching' : 'Import AIS'}
        </Button>
      </span>
      <ActionError message={action.error} />
    </span>
  )
}
