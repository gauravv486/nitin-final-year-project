'use client'

import { useState } from 'react'
import { CheckCircle2, CopyPlus, Plus, Wallet } from 'lucide-react'
import { api, num } from '@/lib/api'
import { useApi, useAction } from '@/lib/use-api'
import type { PayrollStatus } from '@/lib/enums'
import { inr } from '@/lib/utils'
import { PageHeader } from '@/components/app-shell/page-header'
import { PayrollBadge } from '@/components/app-shell/status'
import {
  ClientPicker,
  PeriodPicker,
  periodLabel,
  recentPeriods,
  useClientPicker,
} from '@/components/app-shell/pickers'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader, CardTitle, Stat } from '@/components/ui/surface'
import { ActionError, Async, EmptyState, Select } from '@/components/ui/async'
import { Field, Input } from '@/components/ui/field'

interface Line {
  id: string
  employee_code: string
  employee_name: string
  state: string | null
  paid_days: string
  gross: string
  pf_employee: string
  pf_employer: string
  esi_employee: string
  esi_employer: string
  professional_tax: string
  tds: string
  net: string
}

interface Run {
  id: string
  client_id: string
  client_name: string
  period: string
  status: PayrollStatus
  headcount: number
  gross_total: string
  net_total: string
  pf_total: string
  esi_total: string
  pt_total: string
  tds_total: string
  approved_at: string | null
  paid_on: string | null
}

interface RunDetail extends Run {
  lines: Line[]
  rate_snapshot: Record<string, unknown>
  notes: Record<string, string>
}

export default function PayrollPage() {
  const picker = useClientPicker()
  const [runId, setRunId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const runs = useApi<Run[]>(
    picker.selected ? `/payroll/runs?client_id=${picker.selected}` : null,
  )
  const activeId = runId ?? runs.data?.[0]?.id ?? null
  const detail = useApi<RunDetail>(activeId ? `/payroll/runs/${activeId}` : null)

  function reloadAll() {
    runs.reload()
    detail.reload()
  }

  return (
    <>
      <PageHeader
        title="Payroll & statutory"
        lede="PF, ESI, professional tax and salary TDS computed from the structure — each against its own statutory ceiling."
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
                <Select value={activeId ?? ''} onChange={(e) => setRunId(e.target.value)}>
                  {runs.data.map((r) => (
                    <option key={r.id} value={r.id}>
                      {periodLabel(r.period)} · {r.headcount} staff
                    </option>
                  ))}
                </Select>
              </label>
            )}
            <Button size="sm" onClick={() => setAdding((v) => !v)}>
              <Plus aria-hidden className="size-4" />
              {adding ? 'Cancel' : 'New run'}
            </Button>
          </div>
        }
      />

      {adding && picker.selected && (
        <NewRun
          clientId={picker.selected}
          onDone={() => {
            setAdding(false)
            setRunId(null)
            reloadAll()
          }}
        />
      )}

      {runs.data && runs.data.length === 0 && !runs.loading && (
        <EmptyState
          title="No payroll runs for this client"
          hint="Create one above. Enter basic and HRA per employee — the statutory deductions are calculated, not typed in."
        />
      )}

      {activeId && (
        <Async query={detail}>
          {(run) => (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Stat
                  label="Gross payroll"
                  value={inr(num(run.gross_total))}
                  note={`${run.headcount} employee${run.headcount === 1 ? '' : 's'}`}
                />
                <Stat label="Net payable" value={inr(num(run.net_total))} tone="accent" />
                <Stat
                  label="PF remittance"
                  value={inr(num(run.pf_total))}
                  note="Employee + employer share"
                />
                <Stat
                  label="ESI + PT + TDS"
                  value={inr(num(run.esi_total) + num(run.pt_total) + num(run.tds_total))}
                  note="Other statutory deductions"
                />
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <PayrollBadge status={run.status} />
                <RunActions run={run} onDone={reloadAll} />
              </div>

              <Card className="mt-4 overflow-hidden">
                <CardHeader>
                  <CardTitle>Payroll register</CardTitle>
                  <span className="font-mono text-xs text-ink-muted">
                    {periodLabel(run.period)}
                  </span>
                </CardHeader>

                <div className="scroll-slim overflow-x-auto">
                  <table className="w-full min-w-[48rem] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-hairline bg-paper-sunken">
                        <th scope="col" className="px-5 py-3 font-medium text-ink-secondary">
                          Employee
                        </th>
                        {['Gross', 'PF', 'ESI', 'PT', 'TDS', 'Net'].map((h) => (
                          <th
                            key={h}
                            scope="col"
                            className="px-5 py-3 text-right font-medium text-ink-secondary"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-hairline">
                      {run.lines.map((r) => (
                        <tr key={r.id} className="hover:bg-paper-sunken/60">
                          <td className="px-5 py-3">
                            <span className="block font-medium text-ink">{r.employee_name}</span>
                            <span className="block font-mono text-xs text-ink-muted">
                              {r.employee_code}
                              {r.state ? ` · ${r.state}` : ''}
                            </span>
                          </td>
                          <td className="tnum px-5 py-3 text-right">{inr(num(r.gross))}</td>
                          <td className="tnum px-5 py-3 text-right text-ink-secondary">
                            {num(r.pf_employee) === 0 ? (
                              <span className="text-ink-faint">&mdash;</span>
                            ) : (
                              inr(num(r.pf_employee))
                            )}
                          </td>
                          <td className="tnum px-5 py-3 text-right text-ink-secondary">
                            {num(r.esi_employee) === 0 ? (
                              <span className="text-ink-faint">&mdash;</span>
                            ) : (
                              inr(num(r.esi_employee))
                            )}
                          </td>
                          <td className="tnum px-5 py-3 text-right text-ink-secondary">
                            {num(r.professional_tax) === 0 ? (
                              <span className="text-ink-faint">&mdash;</span>
                            ) : (
                              inr(num(r.professional_tax))
                            )}
                          </td>
                          <td className="tnum px-5 py-3 text-right text-ink-secondary">
                            {num(r.tds) === 0 ? (
                              <span className="text-ink-faint">&mdash;</span>
                            ) : (
                              inr(num(r.tds))
                            )}
                          </td>
                          <td className="tnum px-5 py-3 text-right font-medium text-ink">
                            {inr(num(r.net))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-hairline-strong bg-paper-sunken font-medium">
                        <td className="px-5 py-3 text-ink">Total</td>
                        <td className="tnum px-5 py-3 text-right text-ink">
                          {inr(num(run.gross_total))}
                        </td>
                        <td className="tnum px-5 py-3 text-right text-ink">
                          {inr(num(run.pf_total))}
                        </td>
                        <td className="tnum px-5 py-3 text-right text-ink">
                          {inr(num(run.esi_total))}
                        </td>
                        <td className="tnum px-5 py-3 text-right text-ink">
                          {inr(num(run.pt_total))}
                        </td>
                        <td className="tnum px-5 py-3 text-right text-ink">
                          {inr(num(run.tds_total))}
                        </td>
                        <td className="tnum px-5 py-3 text-right text-ink">
                          {inr(num(run.net_total))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </Card>

              {/* The engine explains its own exclusions rather than showing a
                  silent nil — "why is ESI blank for this person" is the first
                  question anyone asks. */}
              {Object.keys(run.notes ?? {}).length > 0 && (
                <ul className="mt-4 flex flex-col gap-1">
                  {Object.entries(run.notes).map(([key, text]) => (
                    <li key={key} className="text-xs text-ink-muted">
                      {text}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </Async>
      )}
    </>
  )
}

function RunActions({ run, onDone }: { run: Run; onDone: () => void }) {
  const action = useAction()
  const [copyTo, setCopyTo] = useState(recentPeriods()[0])

  return (
    <>
      {run.status === 'CALCULATED' && (
        <Button
          size="sm"
          state={action.busy ? 'loading' : 'idle'}
          onClick={async () => {
            if (await action.run(() => api.post(`/payroll/runs/${run.id}/approve`))) onDone()
          }}
        >
          <CheckCircle2 aria-hidden className="size-4" />
          Approve
        </Button>
      )}
      {run.status === 'APPROVED' && (
        <Button
          size="sm"
          state={action.busy ? 'loading' : 'idle'}
          onClick={async () => {
            if (await action.run(() => api.post(`/payroll/runs/${run.id}/mark-paid`))) onDone()
          }}
        >
          <Wallet aria-hidden className="size-4" />
          Mark paid
        </Button>
      )}

      <span className="flex items-center gap-2">
        <PeriodPicker value={copyTo} onChange={setCopyTo} label="Copy to" />
        <Button
          variant="secondary"
          size="sm"
          state={action.busy ? 'loading' : 'idle'}
          onClick={async () => {
            if (
              await action.run(() =>
                api.post(`/payroll/runs/${run.id}/copy`, { period: copyTo }),
              )
            )
              onDone()
          }}
        >
          <CopyPlus aria-hidden className="size-4" />
          Recalculate
        </Button>
      </span>

      <ActionError message={action.error} />
    </>
  )
}

interface Draft {
  employee_code: string
  employee_name: string
  state: string
  basic: string
  hra: string
  allowances: string
}

const BLANK: Draft = {
  employee_code: '',
  employee_name: '',
  state: 'MH',
  basic: '',
  hra: '',
  allowances: '',
}

/**
 * Only earnings are entered. PF, ESI, PT and TDS are never typed in — they are
 * derived from the structure against each statute's own ceiling, which is the
 * whole point of the module.
 */
function NewRun({ clientId, onDone }: { clientId: string; onDone: () => void }) {
  const [period, setPeriod] = useState(recentPeriods()[0])
  const [rows, setRows] = useState<Draft[]>([{ ...BLANK }])
  const action = useAction()

  function update(index: number, patch: Partial<Draft>) {
    setRows((current) => current.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  return (
    <Card className="mb-5">
      <CardHeader>
        <CardTitle>New payroll run</CardTitle>
        <PeriodPicker value={period} onChange={setPeriod} />
      </CardHeader>
      <CardBody>
        <form
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault()
            const employees = rows
              .filter((r) => r.employee_code.trim() && r.employee_name.trim())
              .map((r) => ({
                employee_code: r.employee_code.trim(),
                employee_name: r.employee_name.trim(),
                state: r.state.trim().toUpperCase() || null,
                basic: r.basic || '0',
                hra: r.hra || '0',
                allowances: r.allowances || '0',
              }))
            if (employees.length === 0) return
            if (
              await action.run(() =>
                api.post(`/clients/${clientId}/payroll/runs`, {
                  period,
                  employees,
                  replace: true,
                }),
              )
            )
              onDone()
          }}
        >
          {rows.map((row, i) => (
            <div key={i} className="grid gap-3 sm:grid-cols-6">
              <Field label={i === 0 ? 'Code' : ''}>
                {(a) => (
                  <Input
                    {...a}
                    value={row.employee_code}
                    onChange={(e) => update(i, { employee_code: e.target.value })}
                    placeholder="E-001"
                  />
                )}
              </Field>
              <Field label={i === 0 ? 'Name' : ''}>
                {(a) => (
                  <Input
                    {...a}
                    value={row.employee_name}
                    onChange={(e) => update(i, { employee_name: e.target.value })}
                    placeholder="Priya Shah"
                  />
                )}
              </Field>
              <Field label={i === 0 ? 'State' : ''} hint={i === 0 ? 'For PT' : undefined}>
                {(a) => (
                  <Input
                    {...a}
                    value={row.state}
                    onChange={(e) => update(i, { state: e.target.value })}
                    maxLength={2}
                    placeholder="MH"
                  />
                )}
              </Field>
              <Field label={i === 0 ? 'Basic' : ''}>
                {(a) => (
                  <Input
                    {...a}
                    value={row.basic}
                    onChange={(e) => update(i, { basic: e.target.value })}
                    inputMode="decimal"
                    placeholder="40000"
                  />
                )}
              </Field>
              <Field label={i === 0 ? 'HRA' : ''}>
                {(a) => (
                  <Input
                    {...a}
                    value={row.hra}
                    onChange={(e) => update(i, { hra: e.target.value })}
                    inputMode="decimal"
                    placeholder="16000"
                  />
                )}
              </Field>
              <Field label={i === 0 ? 'Allowances' : ''}>
                {(a) => (
                  <Input
                    {...a}
                    value={row.allowances}
                    onChange={(e) => update(i, { allowances: e.target.value })}
                    inputMode="decimal"
                    placeholder="4000"
                  />
                )}
              </Field>
            </div>
          ))}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setRows((r) => [...r, { ...BLANK }])}
            >
              <Plus aria-hidden className="size-4" />
              Add employee
            </Button>
            <Button type="submit" size="sm" state={action.busy ? 'loading' : 'idle'}>
              {action.busy ? 'Calculating' : 'Calculate payroll'}
            </Button>
            <ActionError message={action.error} />
          </div>
        </form>
      </CardBody>
    </Card>
  )
}
