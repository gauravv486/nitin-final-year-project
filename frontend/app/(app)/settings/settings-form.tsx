'use client'

import { useEffect, useState } from 'react'
import { Check, Sparkles } from 'lucide-react'
import { api } from '@/lib/api'
import { useApi, useAction } from '@/lib/use-api'
import { PageHeader } from '@/components/app-shell/page-header'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { Badge, Card, CardBody, CardHeader, CardTitle } from '@/components/ui/surface'
import { ActionError, Async } from '@/components/ui/async'
import { Wordmark } from '@/components/marketing/wordmark'

interface Settings {
  firm_name: string
  frn: string | null
  pan: string | null
  gstin: string | null
  email: string | null
  phone: string | null
  address_line1: string | null
  city: string | null
  state: string | null
  pincode: string | null
  tier: string
  auto_apply_floor: number | string
  financial_year_end: string | null
  timezone: string | null
  ai_rules: Record<string, unknown>
  notification_rules: Record<string, boolean>
}

/** Which AI components are actually running right now. */
interface AiStatus {
  [key: string]: unknown
}

const NOTIFY: { key: string; label: string }[] = [
  { key: 'deadline_7_days', label: 'A filing deadline is within 7 days' },
  { key: 'recon_exceptions', label: 'A reconciliation run finds new exceptions' },
  { key: 'client_upload', label: 'A client uploads a document' },
  { key: 'notice_14_days', label: 'A notice reply deadline is within 14 days' },
  { key: 'weekly_summary', label: 'Weekly firm summary, Monday morning' },
]

export function SettingsForm() {
  const settings = useApi<Settings>('/settings')
  const ai = useApi<AiStatus>('/ai/status')
  const action = useAction()
  const [saved, setSaved] = useState(false)
  const [notify, setNotify] = useState<Record<string, boolean>>({})
  const [floor, setFloor] = useState('')

  // Seed the local copies once the server's version arrives.
  useEffect(() => {
    if (!settings.data) return
    setNotify(settings.data.notification_rules ?? {})
    setFloor(String(settings.data.auto_apply_floor ?? ''))
  }, [settings.data])

  async function save(form: HTMLFormElement) {
    const data = new FormData(form)
    const ok = await action.run(() =>
      api.patch('/settings', {
        firm_name: String(data.get('firm_name') ?? '').trim() || null,
        email: String(data.get('email') ?? '').trim() || null,
        phone: String(data.get('phone') ?? '').trim() || null,
        address_line1: String(data.get('address_line1') ?? '').trim() || null,
        city: String(data.get('city') ?? '').trim() || null,
        state: String(data.get('state') ?? '').trim() || null,
        pincode: String(data.get('pincode') ?? '').trim() || null,
        auto_apply_floor: floor || null,
        notification_rules: notify,
      }),
    )
    if (ok) {
      setSaved(true)
      settings.reload()
      window.setTimeout(() => setSaved(false), 2500)
    }
  }

  return (
    <Async query={settings}>
      {(s) => (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void save(e.currentTarget)
          }}
        >
          <PageHeader
            title="Settings"
            lede="Firm profile, the classifier's auto-apply floor, and who hears about what."
            actions={
              <div className="flex flex-col items-end gap-1">
                <Button
                  type="submit"
                  size="sm"
                  state={action.busy ? 'loading' : saved ? 'success' : 'idle'}
                >
                  {saved ? 'Saved' : action.busy ? 'Saving' : 'Save changes'}
                </Button>
                <ActionError message={action.error} />
              </div>
            }
          />

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
            <Card>
              <CardHeader>
                <CardTitle>Firm profile</CardTitle>
              </CardHeader>
              <CardBody className="grid gap-4 sm:grid-cols-2">
                <Field label="Firm name">
                  {(a) => <Input {...a} name="firm_name" defaultValue={s.firm_name} />}
                </Field>
                <Field label="ICAI registration no." hint="Set at registration.">
                  {(a) => (
                    <Input {...a} defaultValue={s.frn ?? ''} readOnly className="font-mono" />
                  )}
                </Field>
                <Field label="Firm PAN" hint="Set at registration.">
                  {(a) => (
                    <Input {...a} defaultValue={s.pan ?? ''} readOnly className="font-mono" />
                  )}
                </Field>
                <Field label="Firm GSTIN" hint="Set at registration.">
                  {(a) => (
                    <Input {...a} defaultValue={s.gstin ?? ''} readOnly className="font-mono" />
                  )}
                </Field>
                <Field label="Email">
                  {(a) => <Input {...a} name="email" type="email" defaultValue={s.email ?? ''} />}
                </Field>
                <Field label="Phone">
                  {(a) => <Input {...a} name="phone" defaultValue={s.phone ?? ''} />}
                </Field>
                <div className="sm:col-span-2">
                  <Field
                    label="Registered address"
                    hint="Appears on engagement letters and signed exports."
                  >
                    {(a) => (
                      <Input {...a} name="address_line1" defaultValue={s.address_line1 ?? ''} />
                    )}
                  </Field>
                </div>
                <Field label="City">
                  {(a) => <Input {...a} name="city" defaultValue={s.city ?? ''} />}
                </Field>
                <Field label="State">
                  {(a) => <Input {...a} name="state" defaultValue={s.state ?? ''} />}
                </Field>
              </CardBody>
            </Card>

            <div className="flex flex-col gap-4">
              {/* The single most consequential setting in the product. */}
              <Card>
                <CardHeader>
                  <CardTitle>Auto-apply floor</CardTitle>
                  <Badge tone="accent">{s.tier}</Badge>
                </CardHeader>
                <CardBody className="flex flex-col gap-3">
                  <p className="text-sm text-ink-secondary">
                    A classification at or above this confidence posts itself. Below it, the entry
                    waits for a human. Raising the floor means more review and fewer silent
                    mistakes; lowering it means the opposite.
                  </p>
                  <label className="flex items-center gap-3">
                    <span className="sr-only">Auto-apply confidence floor</span>
                    <input
                      type="range"
                      min="0.5"
                      max="1"
                      step="0.01"
                      value={floor || '0.85'}
                      onChange={(e) => setFloor(e.target.value)}
                      className="min-w-0 flex-1 accent-accent-strong"
                    />
                    <span className="tnum w-14 shrink-0 text-right font-mono text-sm text-ink">
                      {(Number(floor || 0.85) * 100).toFixed(0)}%
                    </span>
                  </label>
                </CardBody>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Client-facing branding</CardTitle>
                </CardHeader>
                <CardBody className="flex flex-col gap-4">
                  <p className="text-sm text-ink-secondary">
                    What your clients see when they open the portal.
                  </p>

                  {/* Live preview — real components, not a drawn mockup */}
                  <div className="overflow-hidden rounded-card border border-hairline">
                    <div className="flex items-center justify-between gap-3 border-b border-hairline bg-paper-raised px-4 py-3">
                      <Wordmark />
                      <span className="nowrap-action rounded-pill bg-accent px-3 py-1 text-xs font-medium text-accent-ink">
                        Client portal
                      </span>
                    </div>
                    <div className="bg-paper-sunken px-4 py-5">
                      <p className="text-sm font-medium text-ink">{s.firm_name}</p>
                      <p className="mt-1 text-xs text-ink-muted">
                        Documents, filings and approvals in one place
                      </p>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </div>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            {/* Reported, not claimed: this is what is actually loaded. */}
            <Card>
              <CardHeader>
                <CardTitle>AI components</CardTitle>
                <span className="flex items-center gap-1 text-xs text-ink-muted">
                  <Sparkles aria-hidden className="size-3" />
                  live status
                </span>
              </CardHeader>
              <Async query={ai}>
                {(status) => (
                  <ul className="divide-y divide-hairline">
                    {Object.entries(status).map(([key, value]) => (
                      <li
                        key={key}
                        className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5"
                      >
                        <span className="min-w-0 flex-1 truncate text-sm text-ink">
                          {key.replace(/_/g, ' ')}
                        </span>
                        {typeof value === 'boolean' ? (
                          value ? (
                            <Badge tone="ok">
                              <Check aria-hidden className="size-3.5" />
                              Running
                            </Badge>
                          ) : (
                            <Badge tone="neutral">Not installed</Badge>
                          )
                        ) : (
                          <span className="nowrap-action font-mono text-xs text-ink-secondary">
                            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Async>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Notify me when</CardTitle>
              </CardHeader>
              <ul className="divide-y divide-hairline">
                {NOTIFY.map((n) => (
                  <li key={n.key} className="px-5 py-1">
                    <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink-secondary">
                      <input
                        type="checkbox"
                        checked={notify[n.key] ?? false}
                        onChange={() =>
                          setNotify((prev) => ({ ...prev, [n.key]: !prev[n.key] }))
                        }
                        className="size-4 shrink-0 rounded-sm border-hairline-strong accent-accent-strong"
                      />
                      <span>{n.label}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </form>
      )}
    </Async>
  )
}
