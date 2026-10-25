'use client'

import { useState } from 'react'
import { FilePlus2 } from 'lucide-react'
import { api, num } from '@/lib/api'
import { useApi, useAction } from '@/lib/use-api'
import { MCA_FORMS, type FilingStatus } from '@/lib/enums'
import { cn, formatDate, inr } from '@/lib/utils'
import { PageHeader } from '@/components/app-shell/page-header'
import { FilingBadge } from '@/components/app-shell/status'
import {
  ClientPicker,
  currentFinancialYear,
  useClientPicker,
} from '@/components/app-shell/pickers'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader, CardTitle, Stat } from '@/components/ui/surface'
import { ActionError, Async, EmptyState, Select } from '@/components/ui/async'
import { Field, Input } from '@/components/ui/field'

interface Filing {
  id: string
  client_id: string
  client_name: string
  cin: string | null
  form_type: string
  form_label: string
  purpose: string | null
  financial_year: string
  status: FilingStatus
  due_date: string
  submitted_on: string | null
  srn: string | null
  days_late: number | null
  additional_fee: string | null
  filing_fee: string | null
  has_minutes: boolean
}

interface Template {
  key: string
  title: string
  provision: string | null
  follow_up: string | null
  placeholders: string[]
}

export default function SecretarialPage() {
  const picker = useClientPicker()
  const [adding, setAdding] = useState(false)
  const filings = useApi<Filing[]>(
    `/mca/filings${picker.selected ? `?client_id=${picker.selected}` : ''}`,
  )
  const templates = useApi<Template[]>('/mca/resolution-templates')

  const rows = filings.data ?? []
  const pending = rows.filter((f) => f.status !== 'FILED')

  return (
    <>
      <PageHeader
        title="Corporate secretarial"
        lede="MCA e-form tracking with SRN records, plus board resolutions drafted from the statutory templates."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ClientPicker
              clients={picker.clients}
              value={picker.selected}
              onChange={picker.setSelected}
            />
            <Button size="sm" onClick={() => setAdding((v) => !v)}>
              <FilePlus2 aria-hidden className="size-4" />
              {adding ? 'Cancel' : 'Add filing'}
            </Button>
          </div>
        }
      />

      {adding && picker.selected && (
        <AddFiling
          clientId={picker.selected}
          onDone={() => {
            setAdding(false)
            filings.reload()
          }}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Forms pending" value={String(pending.length)} tone={pending.length ? 'warn' : 'ok'} />
        <Stat label="Filed with SRN" value={String(rows.filter((f) => f.srn).length)} tone="ok" />
        <Stat
          label="Additional fee exposure"
          value={inr(rows.reduce((sum, f) => sum + num(f.additional_fee), 0))}
          note="Late-filing fee under s.403"
          tone={rows.some((f) => num(f.additional_fee) > 0) ? 'risk' : 'ok'}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>E-form register</CardTitle>
            <span className="text-sm text-ink-muted">{rows.length}</span>
          </CardHeader>

          <Async
            query={filings}
            isEmpty={(d) => d.length === 0}
            empty={
              <CardBody>
                <EmptyState
                  title="No ROC filings tracked"
                  hint="Add a form above. Due dates drive the additional-fee calculation, which is a multiple of the normal fee once the deadline passes."
                />
              </CardBody>
            }
          >
            {(list) => (
              <ul className="divide-y divide-hairline">
                {list.map((f) => (
                  <FilingRow key={f.id} filing={f} onDone={filings.reload} />
                ))}
              </ul>
            )}
          </Async>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resolution templates</CardTitle>
            <span className="text-sm text-ink-muted">{templates.data?.length ?? 0}</span>
          </CardHeader>
          <CardBody>
            <Async query={templates} isEmpty={(d) => d.length === 0}>
              {(list) => (
                <div className="flex flex-col gap-2">
                  {list.map((t) => (
                    <DraftResolution
                      key={t.key}
                      template={t}
                      clientId={picker.selected}
                      onDone={filings.reload}
                    />
                  ))}
                </div>
              )}
            </Async>
          </CardBody>
        </Card>
      </div>
    </>
  )
}

function FilingRow({ filing, onDone }: { filing: Filing; onDone: () => void }) {
  const action = useAction()
  const [srn, setSrn] = useState('')
  const [entering, setEntering] = useState(false)

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
      <span className="w-24 shrink-0 font-mono text-sm font-medium text-ink">
        {filing.form_label || MCA_FORMS[filing.form_type] || filing.form_type}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-ink">
          {filing.purpose ?? filing.financial_year}
        </span>
        <span className="block truncate text-xs text-ink-muted">
          {filing.client_name}
          {filing.cin ? ' · ' : ''}
          <span className="font-mono">{filing.cin ?? ''}</span>
        </span>
      </span>

      <span className="tnum shrink-0 text-right">
        <span className="block text-sm text-ink">{formatDate(filing.due_date)}</span>
        {filing.srn ? (
          <span className="block font-mono text-xs text-ok">SRN {filing.srn}</span>
        ) : filing.days_late && filing.days_late > 0 ? (
          <span className="block text-xs text-risk">
            {filing.days_late} days late
            {num(filing.additional_fee) > 0 ? ` · +${inr(num(filing.additional_fee))}` : ''}
          </span>
        ) : (
          <span className={cn('block text-xs text-ink-muted')}>
            {filing.filing_fee ? inr(num(filing.filing_fee)) : '—'}
          </span>
        )}
      </span>

      <FilingBadge status={filing.status} />

      {filing.status !== 'FILED' && (
        <span className="flex shrink-0 flex-col items-end gap-1">
          {entering ? (
            <form
              className="flex items-center gap-1.5"
              onSubmit={async (e) => {
                e.preventDefault()
                if (
                  await action.run(() =>
                    api.patch(`/mca/filings/${filing.id}`, {
                      srn: srn.trim(),
                      status: 'FILED',
                      submitted_on: new Date().toISOString().slice(0, 10),
                    }),
                  )
                ) {
                  setEntering(false)
                  onDone()
                }
              }}
            >
              <input
                value={srn}
                onChange={(e) => setSrn(e.target.value)}
                required
                placeholder="SRN"
                aria-label="SRN"
                className="h-9 w-32 rounded-control border border-hairline-strong bg-paper-raised px-2.5 font-mono text-sm text-ink"
              />
              <Button type="submit" size="sm" state={action.busy ? 'loading' : 'idle'}>
                File
              </Button>
            </form>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setEntering(true)}>
              Record SRN
            </Button>
          )}
          <ActionError message={action.error} />
        </span>
      )}
    </li>
  )
}

/**
 * Drafts the resolution and the minutes together. The backend fills the
 * statutory recitals from the template and leaves the firm-specific values as
 * markers — it will not invent a meeting that did not happen.
 */
function DraftResolution({
  template,
  clientId,
  onDone,
}: {
  template: Template
  clientId: string | null
  onDone: () => void
}) {
  const action = useAction()
  const [text, setText] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={!clientId || action.busy}
        onClick={async () => {
          if (!clientId) return
          await action.run(async () => {
            const result = await api.post<{ resolution: string; minutes: string }>(
              `/clients/${clientId}/board-minutes`,
              { template_key: template.key },
            )
            setText(`${result.resolution}\n\n---\n\n${result.minutes}`)
            onDone()
          })
        }}
        className="press flex min-h-11 items-center justify-between gap-3 rounded-control bg-paper-sunken px-4 text-left text-sm text-ink-secondary hover:bg-accent-wash hover:text-ink disabled:opacity-50"
      >
        <span className="min-w-0">
          {template.title}
          {template.provision && (
            <span className="block text-xs text-ink-muted">{template.provision}</span>
          )}
        </span>
        <span aria-hidden className="nowrap-action shrink-0 text-xs text-ink-faint">
          {action.busy ? 'Drafting…' : 'Draft'}
        </span>
      </button>
      <ActionError message={action.error} />
      {text && (
        <pre className="scroll-slim max-h-64 overflow-auto whitespace-pre-wrap rounded-control border border-hairline bg-paper-raised p-3 text-xs text-ink-secondary">
          {text}
        </pre>
      )}
    </div>
  )
}

function AddFiling({ clientId, onDone }: { clientId: string; onDone: () => void }) {
  const action = useAction()

  return (
    <Card className="mb-5">
      <CardHeader>
        <CardTitle>Add an e-form</CardTitle>
      </CardHeader>
      <CardBody>
        <form
          className="grid gap-4 sm:grid-cols-4"
          onSubmit={async (e) => {
            e.preventDefault()
            const data = new FormData(e.currentTarget)
            if (
              await action.run(() =>
                api.post(`/clients/${clientId}/mca/filings`, {
                  form_type: String(data.get('form_type')),
                  financial_year: String(data.get('financial_year')),
                  due_date: String(data.get('due_date')),
                  filing_fee: String(data.get('filing_fee') || '0'),
                }),
              )
            )
              onDone()
          }}
        >
          <Field label="Form">
            {(a) => (
              <Select {...a} name="form_type" defaultValue="AOC_4" className="h-11 w-full">
                {Object.entries(MCA_FORMS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Financial year">
            {(a) => (
              <Input {...a} name="financial_year" defaultValue={currentFinancialYear()} required />
            )}
          </Field>
          <Field label="Due date">
            {(a) => <Input {...a} name="due_date" type="date" required />}
          </Field>
          <Field label="Normal fee" hint="Drives the late multiple.">
            {(a) => <Input {...a} name="filing_fee" inputMode="decimal" placeholder="400" />}
          </Field>

          <div className="flex flex-col gap-2 sm:col-span-4">
            <ActionError message={action.error} />
            <div>
              <Button type="submit" size="sm" state={action.busy ? 'loading' : 'idle'}>
                Save filing
              </Button>
            </div>
          </div>
        </form>
      </CardBody>
    </Card>
  )
}
