'use client'

import { useState } from 'react'
import { Check, UserPlus } from 'lucide-react'
import { api } from '@/lib/api'
import { useApi, useAction } from '@/lib/use-api'
import { ENTITY_TYPES } from '@/lib/enums'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/app-shell/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/surface'
import { ActionError, Async, EmptyState, Select } from '@/components/ui/async'
import { Field, Input, Textarea } from '@/components/ui/field'

interface Step {
  key: string
  title: string
  detail: string
  status: 'done' | 'active' | 'todo'
}

interface Onboarding {
  id: string
  legal_name: string
  trade_name: string | null
  pan: string | null
  gstin: string | null
  cin: string | null
  entity_type: string | null
  stage: string
  derived: Record<string, string | null>
  registrations: string[]
  directors: { name?: string; din?: string }[]
  engagement_letter_md: string | null
  letter_approved_at: string | null
  client_id: string | null
  completed_at: string | null
  steps: Step[]
  created_at: string
}

/** Everything the calendar can be driven from. */
const REGISTRATIONS = ['GST', 'Income tax', 'TDS', 'PF', 'ESI', 'ROC']

export default function OnboardingPage() {
  const [starting, setStarting] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const list = useApi<Onboarding[]>('/onboarding')

  const activeId = selected ?? list.data?.[0]?.id ?? null
  const record = useApi<Onboarding>(activeId ? `/onboarding/${activeId}` : null)

  function reloadAll() {
    list.reload()
    record.reload()
  }

  return (
    <>
      <PageHeader
        title="Client onboarding"
        lede="Identity and registrations entered once. What you record here decides which deadlines, returns and forms exist for this client."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {list.data && list.data.length > 0 && (
              <label className="flex items-center gap-2 text-sm">
                <span className="label shrink-0">Record</span>
                <Select value={activeId ?? ''} onChange={(e) => setSelected(e.target.value)}>
                  {list.data.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.legal_name}
                    </option>
                  ))}
                </Select>
              </label>
            )}
            <Button size="sm" onClick={() => setStarting((v) => !v)}>
              <UserPlus aria-hidden className="size-4" />
              {starting ? 'Cancel' : 'New client'}
            </Button>
          </div>
        }
      />

      {starting && (
        <StartOnboarding
          onDone={(id) => {
            setStarting(false)
            setSelected(id)
            list.reload()
          }}
        />
      )}

      {list.data && list.data.length === 0 && !list.loading && !starting && (
        <EmptyState
          title="No onboardings in progress"
          hint="Start one above. The GSTIN is validated including its check digit, and the state code and PAN inside it are cross-checked against what you type."
          action={<Button size="sm" onClick={() => setStarting(true)}>Start one</Button>}
        />
      )}

      {activeId && (
        <Async query={record}>
          {(o) => (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)]">
              <Card>
                <CardHeader>
                  <CardTitle>Progress</CardTitle>
                  <span className="font-mono text-xs text-ink-muted">
                    {o.steps.filter((s) => s.status === 'done').length} / {o.steps.length}
                  </span>
                </CardHeader>

                <ol className="px-5 py-4">
                  {o.steps.map((s, i) => (
                    <li key={s.key} className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4">
                      <div className="flex flex-col items-center">
                        <span
                          className={cn(
                            'grid size-8 shrink-0 place-items-center rounded-pill font-mono text-xs',
                            s.status === 'done' &&
                              'bg-accent text-accent-ink ring-1 ring-accent-strong/35',
                            s.status === 'active' &&
                              'border-2 border-accent-strong bg-paper-raised text-ink',
                            s.status === 'todo' &&
                              'border border-hairline-strong bg-paper-raised text-ink-faint',
                          )}
                        >
                          {s.status === 'done' ? <Check aria-hidden className="size-4" /> : i + 1}
                        </span>
                        {i < o.steps.length - 1 && (
                          <span aria-hidden className="w-px flex-1 bg-hairline-strong" />
                        )}
                      </div>

                      <div className="pb-6">
                        <p
                          className={cn(
                            'text-sm font-medium',
                            s.status === 'todo' ? 'text-ink-muted' : 'text-ink',
                          )}
                        >
                          {s.title}
                        </p>
                        <p className="mt-0.5 text-xs text-ink-muted">{s.detail}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </Card>

              <div className="flex flex-col gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>What the identifiers tell us</CardTitle>
                  </CardHeader>
                  <CardBody className="flex flex-col gap-5">
                    <p className="text-sm text-ink-secondary">
                      Nothing here is typed in. The state, the PAN and the holder type are read
                      out of the GSTIN itself, and the CIN says whether the company is listed.
                    </p>

                    <dl className="grid gap-3 rounded-control bg-paper-sunken p-4 text-sm sm:grid-cols-2">
                      <div className="min-w-0">
                        <dt className="label">Legal name</dt>
                        <dd className="mt-0.5 text-ink">{o.legal_name}</dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="label">Entity type</dt>
                        <dd className="mt-0.5 text-ink">
                          {o.entity_type ? (ENTITY_TYPES[o.entity_type] ?? o.entity_type) : '—'}
                        </dd>
                      </div>
                      {Object.entries(o.derived ?? {}).map(([key, value]) => (
                        <div key={key} className="min-w-0">
                          <dt className="label">{key.replace(/_/g, ' ')}</dt>
                          <dd className="mt-0.5 text-ink">{value ?? '—'}</dd>
                        </div>
                      ))}
                    </dl>

                    <RegistrationPicker record={o} onDone={reloadAll} />
                  </CardBody>
                </Card>

                <EngagementLetter record={o} onDone={reloadAll} />
                {o.letter_approved_at && !o.completed_at && (
                  <CompleteOnboarding record={o} onDone={reloadAll} />
                )}
                {o.completed_at && (
                  <Card>
                    <CardBody>
                      <p className="flex items-center gap-2 text-sm text-ok">
                        <Check aria-hidden className="size-4" />
                        Client created. The compliance calendar has been generated from the
                        registrations above.
                      </p>
                    </CardBody>
                  </Card>
                )}
              </div>
            </div>
          )}
        </Async>
      )}
    </>
  )
}

/** Confirming registrations is what unlocks the rest — it drives the calendar. */
function RegistrationPicker({
  record,
  onDone,
}: {
  record: Onboarding
  onDone: () => void
}) {
  const [chosen, setChosen] = useState<string[]>(record.registrations ?? [])
  const action = useAction()

  return (
    <div className="flex flex-col gap-2">
      <p className="label">Registrations that apply</p>
      <ul className="flex flex-wrap gap-2">
        {REGISTRATIONS.map((r) => {
          const on = chosen.includes(r)
          return (
            <li key={r}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() =>
                  setChosen((prev) => (on ? prev.filter((x) => x !== r) : [...prev, r]))
                }
                className={cn(
                  'press nowrap-action rounded-pill border px-3 py-1 text-xs font-medium',
                  on
                    ? 'border-accent-strong bg-accent text-accent-ink'
                    : 'border-hairline-strong bg-paper-raised text-ink-secondary hover:bg-paper-sunken',
                )}
              >
                {r}
              </button>
            </li>
          )
        })}
      </ul>
      <p className="mt-1 text-xs text-ink-muted">
        Each registration creates its own recurring deadlines for this client.
      </p>
      <div className="mt-1 flex flex-col gap-1">
        <div>
          <Button
            size="sm"
            variant="secondary"
            state={action.busy ? 'loading' : 'idle'}
            onClick={async () => {
              if (
                await action.run(() =>
                  api.patch(`/onboarding/${record.id}`, { registrations: chosen }),
                )
              )
                onDone()
            }}
          >
            Confirm registrations
          </Button>
        </div>
        <ActionError message={action.error} />
      </div>
    </div>
  )
}

function EngagementLetter({ record, onDone }: { record: Onboarding; onDone: () => void }) {
  const draft = useAction()
  const approve = useAction()
  const [services, setServices] = useState('')

  return (
    <Card>
      <CardHeader>
        <CardTitle>Engagement letter</CardTitle>
        {record.letter_approved_at && (
          <span className="flex items-center gap-1 text-xs text-ok">
            <Check aria-hidden className="size-3.5" />
            Approved
          </span>
        )}
      </CardHeader>
      <CardBody className="flex flex-col gap-3">
        {!record.engagement_letter_md ? (
          <>
            <Field label="Services" hint="One per line. Left blank, the firm's standard scope is used.">
              {(a) => (
                <Textarea
                  {...a}
                  rows={3}
                  value={services}
                  onChange={(e) => setServices(e.target.value)}
                  placeholder={'Monthly GST compliance\nAnnual accounts and audit support'}
                />
              )}
            </Field>
            <div>
              <Button
                size="sm"
                state={draft.busy ? 'loading' : 'idle'}
                onClick={async () => {
                  if (
                    await draft.run(() =>
                      api.post(`/onboarding/${record.id}/engagement-letter`, {
                        services: services
                          .split('\n')
                          .map((s) => s.trim())
                          .filter(Boolean),
                      }),
                    )
                  )
                    onDone()
                }}
              >
                Draft letter
              </Button>
            </div>
            <ActionError message={draft.error} />
          </>
        ) : (
          <>
            <pre className="scroll-slim max-h-64 overflow-auto whitespace-pre-wrap rounded-control bg-paper-sunken p-4 text-sm text-ink-secondary">
              {record.engagement_letter_md}
            </pre>
            {!record.letter_approved_at && (
              <>
                <div>
                  <Button
                    size="sm"
                    state={approve.busy ? 'loading' : 'idle'}
                    onClick={async () => {
                      if (
                        await approve.run(() =>
                          api.post(`/onboarding/${record.id}/approve-letter`),
                        )
                      )
                        onDone()
                    }}
                  >
                    Approve letter
                  </Button>
                </div>
                <ActionError message={approve.error} />
              </>
            )}
          </>
        )}
      </CardBody>
    </Card>
  )
}

/**
 * The last step. Consent is not optional — the DPDP Act requires a named
 * person to have given it, so the API will not create the client without one.
 */
function CompleteOnboarding({ record, onDone }: { record: Onboarding; onDone: () => void }) {
  const action = useAction()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create the client</CardTitle>
      </CardHeader>
      <CardBody>
        <form
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault()
            const data = new FormData(e.currentTarget)
            if (
              await action.run(() =>
                api.post(`/onboarding/${record.id}/complete`, {
                  name: String(data.get('name') ?? '').trim() || null,
                  gst_frequency: String(data.get('gst_frequency')),
                  consent_given_by: String(data.get('consent_given_by')).trim(),
                }),
              )
            )
              onDone()
          }}
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Short name" hint="Defaults to the trade name.">
              {(a) => <Input {...a} name="name" defaultValue={record.trade_name ?? ''} />}
            </Field>
            <Field label="GST frequency">
              {(a) => (
                <Select {...a} name="gst_frequency" defaultValue="MONTHLY" className="h-11 w-full">
                  <option value="MONTHLY">Monthly</option>
                  <option value="QRMP">QRMP (quarterly)</option>
                </Select>
              )}
            </Field>
            <Field label="Consent given by" hint="Required under the DPDP Act.">
              {(a) => (
                <Input {...a} name="consent_given_by" required placeholder="Rakesh Arora, Director" />
              )}
            </Field>
          </div>

          <ActionError message={action.error} />
          <div>
            <Button type="submit" size="sm" state={action.busy ? 'loading' : 'idle'}>
              {action.busy ? 'Creating' : 'Create client & calendar'}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  )
}

function StartOnboarding({ onDone }: { onDone: (id: string) => void }) {
  const action = useAction()

  return (
    <Card className="mb-5">
      <CardHeader>
        <CardTitle>Start an onboarding</CardTitle>
      </CardHeader>
      <CardBody>
        <form
          className="grid gap-4 sm:grid-cols-3"
          onSubmit={async (e) => {
            e.preventDefault()
            const data = new FormData(e.currentTarget)
            await action.run(async () => {
              const created = await api.post<Onboarding>('/onboarding', {
                legal_name: String(data.get('legal_name')).trim(),
                trade_name: String(data.get('trade_name') ?? '').trim() || null,
                pan: String(data.get('pan') ?? '').trim().toUpperCase() || null,
                gstin: String(data.get('gstin') ?? '').trim().toUpperCase() || null,
                cin: String(data.get('cin') ?? '').trim().toUpperCase() || null,
                entity_type: String(data.get('entity_type') ?? '') || null,
              })
              onDone(created.id)
            })
          }}
        >
          <Field label="Legal name">
            {(a) => (
              <Input {...a} name="legal_name" required placeholder="Arora Trading Private Limited" />
            )}
          </Field>
          <Field label="Trade name">
            {(a) => <Input {...a} name="trade_name" placeholder="Arora Trading" />}
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
          <Field label="GSTIN" hint="Check digit is verified.">
            {(a) => (
              <Input {...a} name="gstin" maxLength={15} placeholder="27AABCA1234M1Z5" className="font-mono" />
            )}
          </Field>
          <Field label="PAN">
            {(a) => (
              <Input {...a} name="pan" maxLength={10} placeholder="AABCA1234M" className="font-mono" />
            )}
          </Field>
          <Field label="CIN" hint="Companies only.">
            {(a) => (
              <Input {...a} name="cin" maxLength={21} placeholder="U51909MH2018PTC301234" className="font-mono" />
            )}
          </Field>

          <div className="flex flex-col gap-2 sm:col-span-3">
            <ActionError message={action.error} />
            <div>
              <Button type="submit" size="sm" state={action.busy ? 'loading' : 'idle'}>
                Start onboarding
              </Button>
            </div>
          </div>
        </form>
      </CardBody>
    </Card>
  )
}
