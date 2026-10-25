'use client'

import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Plus, Search, X } from 'lucide-react'
import { api } from '@/lib/api'
import { useApi, useAction } from '@/lib/use-api'
import { ENTITY_TYPES, type FilingStatus } from '@/lib/enums'
import { PageHeader } from '@/components/app-shell/page-header'
import { FilingBadge } from '@/components/app-shell/status'
import { Button } from '@/components/ui/button'
import { Badge, Card, CardBody, CardHeader, CardTitle } from '@/components/ui/surface'
import { ActionError, Async, EmptyState, Select } from '@/components/ui/async'
import { Field, Input } from '@/components/ui/field'

/** A row of `/clients-overview`. */
interface Overview {
  id: string
  name: string
  legal_name: string
  gstin: string | null
  pan: string | null
  entity_type: string
  status: string
  gst_status: FilingStatus | null
  itr_status: FilingStatus | null
  open_items: number
  assigned_to: string | null
}

export default function ClientsPage() {
  const params = useSearchParams()
  // The topbar search lands here as ?q= — seed the filter from it so the
  // result is visible rather than the box merely being pre-filled.
  const [term, setTerm] = useState(params.get('q') ?? '')
  const [adding, setAdding] = useState(false)
  const query = useApi<Overview[]>('/clients-overview')

  const rows = useMemo(() => {
    const needle = term.trim().toLowerCase()
    if (!needle || !query.data) return query.data ?? []
    return query.data.filter((c) =>
      [c.name, c.legal_name, c.gstin, c.pan].some((v) => v?.toLowerCase().includes(needle)),
    )
  }, [query.data, term])

  return (
    <>
      <PageHeader
        title="Clients"
        lede="One record per client. Registrations here decide which statutory deadlines get created."
        actions={
          <Button size="sm" onClick={() => setAdding((v) => !v)}>
            {adding ? <X aria-hidden className="size-4" /> : <Plus aria-hidden className="size-4" />}
            {adding ? 'Cancel' : 'Add client'}
          </Button>
        }
      />

      {adding && (
        <AddClient
          onDone={() => {
            setAdding(false)
            query.reload()
          }}
        />
      )}

      <label className="mb-4 flex h-10 max-w-sm items-center gap-2 rounded-pill border border-hairline-strong bg-paper-raised px-3.5 text-sm focus-within:border-ink-faint">
        <Search aria-hidden className="size-4 shrink-0 text-ink-muted" />
        <span className="sr-only">Filter clients by name, GSTIN or PAN</span>
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Filter by name, GSTIN or PAN"
          className="min-w-0 flex-1 bg-transparent text-ink placeholder:text-ink-faint focus:outline-none"
        />
        {term && (
          <button type="button" onClick={() => setTerm('')} className="press shrink-0 rounded-chip">
            <X aria-hidden className="size-4 text-ink-muted" />
            <span className="sr-only">Clear filter</span>
          </button>
        )}
      </label>

      <Async
        query={query}
        isEmpty={(d) => d.length === 0}
        empty={
          <EmptyState
            title="No clients yet"
            hint="Add one here, or take a prospect through onboarding to collect their registrations first."
          />
        }
      >
        {() =>
          rows.length === 0 ? (
            <EmptyState title="No matches" hint={`Nothing matches "${term}".`} />
          ) : (
            <>
              <p className="mb-3 text-xs text-ink-muted">
                {rows.length} of {query.data?.length} client
                {query.data?.length === 1 ? '' : 's'}
              </p>

              {/* Desktop table */}
              <Card className="hidden overflow-hidden lg:block">
                <div className="scroll-slim overflow-x-auto">
                  <table className="w-full min-w-[56rem] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-hairline bg-paper-sunken">
                        {['Client', 'GSTIN', 'Entity', 'GST', 'Income tax', 'Open', 'Owner'].map(
                          (h) => (
                            <th
                              key={h}
                              scope="col"
                              className="px-4 py-3 font-medium text-ink-secondary"
                            >
                              {h}
                            </th>
                          ),
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-hairline">
                      {rows.map((c) => (
                        <tr key={c.id} className="hover:bg-paper-sunken/60">
                          <td className="px-4 py-3">
                            <span className="block font-medium text-ink">{c.name}</span>
                            <span className="block text-xs text-ink-muted">{c.legal_name}</span>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-ink-secondary">
                            {c.gstin ?? '—'}
                          </td>
                          <td className="px-4 py-3 text-ink-secondary">
                            {ENTITY_TYPES[c.entity_type] ?? c.entity_type}
                          </td>
                          <td className="px-4 py-3">
                            <FilingBadge status={c.gst_status} />
                          </td>
                          <td className="px-4 py-3">
                            <FilingBadge status={c.itr_status} />
                          </td>
                          <td className="px-4 py-3">
                            {c.open_items === 0 ? (
                              <span className="text-ink-faint">&mdash;</span>
                            ) : (
                              <Badge tone={c.open_items > 5 ? 'risk' : 'warn'}>
                                {c.open_items}
                              </Badge>
                            )}
                          </td>
                          <td className="px-4 py-3 text-ink-secondary">
                            {c.assigned_to ?? 'Unassigned'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* Mobile cards */}
              <ul className="flex flex-col gap-3 lg:hidden">
                {rows.map((c) => (
                  <Card as="li" key={c.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink">{c.name}</p>
                        <p className="truncate font-mono text-xs text-ink-muted">
                          {c.gstin ?? c.pan ?? '—'}
                        </p>
                      </div>
                      {c.open_items > 0 && (
                        <Badge tone={c.open_items > 5 ? 'risk' : 'warn'}>
                          {c.open_items} open
                        </Badge>
                      )}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-hairline pt-3">
                      <span className="label">GST</span>
                      <FilingBadge status={c.gst_status} />
                      <span className="label ml-2">ITR</span>
                      <FilingBadge status={c.itr_status} />
                    </div>

                    <p className="mt-2.5 text-xs text-ink-muted">
                      {ENTITY_TYPES[c.entity_type] ?? c.entity_type} ·{' '}
                      {c.assigned_to ?? 'Unassigned'}
                    </p>
                  </Card>
                ))}
              </ul>
            </>
          )
        }
      </Async>
    </>
  )
}

/**
 * Only `name` and `legal_name` are required by the API. GSTIN is validated
 * server-side — including the base-36 check digit — so a typo comes back as a
 * 422 and is shown here rather than silently saved.
 */
function AddClient({ onDone }: { onDone: () => void }) {
  const action = useAction()

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    const payload = {
      name: String(data.get('name') ?? '').trim(),
      legal_name: String(data.get('legal_name') ?? '').trim(),
      entity_type: String(data.get('entity_type') ?? 'PRIVATE_LIMITED'),
      gstin: String(data.get('gstin') ?? '').trim().toUpperCase() || null,
      pan: String(data.get('pan') ?? '').trim().toUpperCase() || null,
      email: String(data.get('email') ?? '').trim() || null,
    }
    if (await action.run(() => api.post('/clients', payload))) onDone()
  }

  return (
    <Card className="mb-5">
      <CardHeader>
        <CardTitle>Add a client</CardTitle>
      </CardHeader>
      <CardBody>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <Field label="Short name">
            {(a) => <Input {...a} name="name" required placeholder="Arora Trading" />}
          </Field>
          <Field label="Legal name">
            {(a) => (
              <Input
                {...a}
                name="legal_name"
                required
                placeholder="Arora Trading Private Limited"
              />
            )}
          </Field>
          <Field label="GSTIN" hint="Optional. The check digit is verified.">
            {(a) => <Input {...a} name="gstin" placeholder="27AABCA1234M1Z5" maxLength={15} />}
          </Field>
          <Field label="PAN" hint="Optional.">
            {(a) => <Input {...a} name="pan" placeholder="AABCA1234M" maxLength={10} />}
          </Field>
          <Field label="Entity type">
            {(a) => (
              <Select {...a} name="entity_type" defaultValue="PRIVATE_LIMITED" className="h-11 w-full">
                {Object.entries(ENTITY_TYPES).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Email" hint="Optional.">
            {(a) => <Input {...a} name="email" type="email" placeholder="accounts@client.in" />}
          </Field>

          <div className="flex flex-col gap-2 sm:col-span-2">
            <ActionError message={action.error} />
            <div>
              <Button type="submit" size="sm" state={action.busy ? 'loading' : 'idle'}>
                {action.busy ? 'Saving' : 'Save client'}
              </Button>
            </div>
          </div>
        </form>
      </CardBody>
    </Card>
  )
}
