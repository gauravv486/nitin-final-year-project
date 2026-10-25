'use client'

import { useRef, useState } from 'react'
import { Sparkles, Upload } from 'lucide-react'
import { api, num } from '@/lib/api'
import { useApi, useAction } from '@/lib/use-api'
import { journal, type JournalStatus } from '@/lib/enums'
import { cn, formatDate, inr } from '@/lib/utils'
import { PageHeader } from '@/components/app-shell/page-header'
import { ClientPicker, useClientPicker } from '@/components/app-shell/pickers'
import { Button } from '@/components/ui/button'
import { Badge, Card, CardBody, CardHeader, CardTitle, Stat } from '@/components/ui/surface'
import { ActionError, Async, EmptyState, Select } from '@/components/ui/async'

interface LedgerRef {
  code: string
  name: string
}

interface Entry {
  id: string
  client_name: string
  transaction_date: string
  narration: string
  counterparty: string | null
  amount: string
  direction: string
  status: JournalStatus
  suggested: LedgerRef | null
  confidence: number | null
  model_version: string | null
  alternatives: { ledger_code: string; ledger_name: string; probability: number }[]
  posted: LedgerRef | null
  overridden: boolean
  auto_applied: boolean
}

interface EntryList {
  data: Entry[]
  total: number
  status_counts: Record<string, number>
}

interface Account {
  id: string
  code: string
  name: string
  group: string
  is_active: boolean
}

interface TrialBalance {
  period: string
  rows: { code: string; name: string; group: string; debit: string; credit: string }[]
  total_debit: string
  total_credit: string
  balanced: boolean
  unposted_count: number
  unposted_amount: string
}

export default function BookkeepingPage() {
  const picker = useClientPicker()
  const [status, setStatus] = useState<string>('UNDER_REVIEW')

  const entries = useApi<EntryList>(
    picker.selected
      ? `/entries?client_id=${picker.selected}&page_size=50${status ? `&status=${status}` : ''}`
      : null,
  )
  const accounts = useApi<Account[]>('/ledger/accounts')
  const tb = useApi<TrialBalance>(
    picker.selected ? `/clients/${picker.selected}/trial-balance` : null,
  )

  function reloadAll() {
    entries.reload()
    tb.reload()
  }

  return (
    <>
      <PageHeader
        title="Bookkeeping"
        lede="What the classifier proposed, what a human decided, and the trial balance that results."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ClientPicker
              clients={picker.clients}
              value={picker.selected}
              onChange={picker.setSelected}
            />
            {picker.selected && (
              <ImportStatement clientId={picker.selected} onDone={reloadAll} />
            )}
          </div>
        }
      />

      <Async query={tb}>
        {(balance) => (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Stat label="Total debits" value={inr(num(balance.total_debit))} />
              <Stat label="Total credits" value={inr(num(balance.total_credit))} />
              <Stat
                label="Difference"
                value={inr(Math.abs(num(balance.total_debit) - num(balance.total_credit)))}
                tone={balance.balanced ? 'ok' : 'warn'}
                note={balance.balanced ? 'Trial balance agrees' : 'Trial balance does not agree'}
              />
              <Stat
                label="Not yet posted"
                value={String(balance.unposted_count)}
                tone={balance.unposted_count > 0 ? 'warn' : 'ok'}
                note={inr(num(balance.unposted_amount))}
              />
            </div>
          </>
        )}
      </Async>

      {/* The review queue — this is the work, so it comes first. */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Classified entries</CardTitle>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm">
              <span className="label shrink-0">Show</span>
              <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="UNDER_REVIEW">Awaiting review</option>
                <option value="SUGGESTED">Unclassified</option>
                <option value="APPROVED">Posted</option>
                <option value="">All</option>
              </Select>
            </label>
            <span className="text-sm text-ink-muted">{entries.data?.total ?? 0}</span>
          </div>
        </CardHeader>

        <Async
          query={entries}
          isEmpty={(d) => d.data.length === 0}
          empty={
            <CardBody>
              <EmptyState
                title="Nothing in this queue"
                hint="Import a bank statement to classify its narrations, or switch the filter to see posted entries."
              />
            </CardBody>
          }
        >
          {(list) => (
            <ul className="divide-y divide-hairline">
              {list.data.map((entry) => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  accounts={accounts.data ?? []}
                  onDone={reloadAll}
                />
              ))}
            </ul>
          )}
        </Async>
      </Card>

      {/* Trial balance */}
      <Async query={tb}>
        {(balance) => (
          <Card className="mt-4 overflow-hidden">
            <CardHeader>
              <CardTitle>Trial balance</CardTitle>
              <span className="font-mono text-xs text-ink-muted">
                {balance.rows.length} account{balance.rows.length === 1 ? '' : 's'} with a balance
              </span>
            </CardHeader>

            {balance.rows.length === 0 ? (
              <CardBody>
                <p className="text-sm text-ink-muted">
                  No posted entries yet. Approve something from the queue above and it appears
                  here.
                </p>
              </CardBody>
            ) : (
              <div className="scroll-slim overflow-x-auto">
                <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-hairline bg-paper-sunken">
                      <th scope="col" className="px-5 py-3 font-medium text-ink-secondary">
                        Code
                      </th>
                      <th scope="col" className="px-5 py-3 font-medium text-ink-secondary">
                        Account
                      </th>
                      <th scope="col" className="px-5 py-3 font-medium text-ink-secondary">
                        Group
                      </th>
                      <th scope="col" className="px-5 py-3 text-right font-medium text-ink-secondary">
                        Debit
                      </th>
                      <th scope="col" className="px-5 py-3 text-right font-medium text-ink-secondary">
                        Credit
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline">
                    {balance.rows.map((a) => (
                      <tr key={a.code} className="hover:bg-paper-sunken/60">
                        <td className="px-5 py-3 font-mono text-xs text-ink-muted">{a.code}</td>
                        <td className="px-5 py-3 font-medium text-ink">{a.name}</td>
                        <td className="px-5 py-3 capitalize text-ink-secondary">
                          {a.group.toLowerCase()}
                        </td>
                        <td
                          className={cn(
                            'tnum px-5 py-3 text-right',
                            num(a.debit) === 0 && 'text-ink-faint',
                          )}
                        >
                          {num(a.debit) ? inr(num(a.debit)) : '—'}
                        </td>
                        <td
                          className={cn(
                            'tnum px-5 py-3 text-right',
                            num(a.credit) === 0 && 'text-ink-faint',
                          )}
                        >
                          {num(a.credit) ? inr(num(a.credit)) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-hairline-strong bg-paper-sunken font-medium">
                      <td colSpan={3} className="px-5 py-3 text-ink">
                        Total
                      </td>
                      <td className="tnum px-5 py-3 text-right text-ink">
                        {inr(num(balance.total_debit))}
                      </td>
                      <td className="tnum px-5 py-3 text-right text-ink">
                        {inr(num(balance.total_credit))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Card>
        )}
      </Async>
    </>
  )
}

/**
 * One entry, with the model's opinion and the reviewer's decision kept apart.
 *
 * Posting to an account the classifier did NOT suggest is the interesting path:
 * the backend records it as a correction in `ledger_training_examples`, which
 * is the only real labelled data the system ever accumulates. The UI says so,
 * because a reviewer who knows their correction teaches the model behaves
 * differently from one who thinks they are just fixing a row.
 */
function EntryRow({
  entry,
  accounts,
  onDone,
}: {
  entry: Entry
  accounts: Account[]
  onDone: () => void
}) {
  const suggestedCode = entry.suggested?.code ?? ''
  const [code, setCode] = useState(suggestedCode)
  const action = useAction()
  const settled = entry.status === 'APPROVED' || entry.status === 'REJECTED'
  const willOverride = Boolean(suggestedCode) && code !== suggestedCode

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4">
      <span className="min-w-0 flex-1">
        <span className="block truncate font-mono text-sm text-ink">{entry.narration}</span>
        <span className="block text-xs text-ink-muted">
          {formatDate(entry.transaction_date)}
          {entry.counterparty ? ` · ${entry.counterparty}` : ''}
          {entry.posted
            ? ` · posted to ${entry.posted.code} ${entry.posted.name}`
            : entry.suggested
              ? ` · proposed → ${entry.suggested.code} ${entry.suggested.name}`
              : ' · no suggestion'}
        </span>
      </span>

      <span className="tnum shrink-0 text-sm font-medium text-ink">{inr(num(entry.amount))}</span>

      {entry.confidence !== null && (
        <Badge
          tone={entry.confidence >= 0.85 ? 'ok' : entry.confidence >= 0.7 ? 'warn' : 'risk'}
          title={entry.model_version ? `Model ${entry.model_version}` : undefined}
        >
          {Math.round(entry.confidence * 100)}%
        </Badge>
      )}

      {entry.auto_applied && <Badge tone="info">Auto-applied</Badge>}
      {entry.overridden && <Badge tone="accent">Corrected</Badge>}

      {settled ? (
        <Badge tone={journal.tone(entry.status)}>{journal.label(entry.status)}</Badge>
      ) : (
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span className="flex items-center gap-2">
            <label className="sr-only" htmlFor={`acct-${entry.id}`}>
              Post to account
            </label>
            <Select
              id={`acct-${entry.id}`}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="max-w-[14rem]"
            >
              <option value="">Choose an account…</option>
              {accounts
                .filter((a) => a.is_active)
                .map((a) => (
                  <option key={a.id} value={a.code}>
                    {a.code} {a.name}
                  </option>
                ))}
            </Select>
            <Button
              size="sm"
              disabled={!code}
              state={action.busy ? 'loading' : 'idle'}
              onClick={async () => {
                if (
                  await action.run(() =>
                    api.post(`/entries/${entry.id}/review`, { ledger_code: code }),
                  )
                )
                  onDone()
              }}
            >
              {willOverride ? 'Correct' : 'Approve'}
            </Button>
          </span>
          {willOverride && (
            <span className="flex items-center gap-1 text-xs text-accent-strong">
              <Sparkles aria-hidden className="size-3" />
              Saved as training data
            </span>
          )}
          <ActionError message={action.error} />
        </span>
      )}
    </li>
  )
}

/** CSV or XLSX in, classified journal entries out. */
function ImportStatement({ clientId, onDone }: { clientId: string; onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const action = useAction()
  const [note, setNote] = useState<string | null>(null)

  return (
    <span className="flex flex-col items-end gap-1">
      <input
        ref={fileRef}
        type="file"
        accept=".csv,.xlsx"
        className="sr-only"
        onChange={async (e) => {
          const file = e.target.files?.[0]
          if (!file) return
          const body = new FormData()
          body.set('file', file)
          const ok = await action.run(async () => {
            const result = await api.form<{ imported: number; skipped: string[] }>(
              `/clients/${clientId}/entries/import`,
              body,
            )
            // Classification is a separate call: import stores the rows, then
            // the model reads them.
            const classified = await api.post<{ classified: number; auto_applied: number }>(
              `/clients/${clientId}/entries/classify`,
            )
            setNote(
              `${result.imported} imported, ${classified.classified} classified, ${classified.auto_applied} posted automatically.`,
            )
          })
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
        {action.busy ? 'Importing' : 'Import statement'}
      </Button>
      {note && <span className="text-xs text-ok">{note}</span>}
      <ActionError message={action.error} />
    </span>
  )
}
