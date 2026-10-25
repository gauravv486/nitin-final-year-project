'use client'

import { useState } from 'react'
import { Copy, ShieldAlert, UserPlus } from 'lucide-react'
import { api } from '@/lib/api'
import { useApi, useAction } from '@/lib/use-api'
import { FIRM_ROLES, userStatus, type UserStatus } from '@/lib/enums'
import { formatDate } from '@/lib/utils'
import { PageHeader } from '@/components/app-shell/page-header'
import { Button } from '@/components/ui/button'
import { Badge, Card, CardBody, CardHeader, CardTitle, Stat } from '@/components/ui/surface'
import { ActionError, Async, EmptyState, Select } from '@/components/ui/async'
import { Field, Input } from '@/components/ui/field'

interface Member {
  id: string
  name: string
  email: string
  role: string
  ui_role: string
  status: UserStatus
  client_id: string | null
  last_login_at: string | null
  mfa_enabled: boolean
}

interface AuditEntry {
  id: string
  at: string
  actor: string | null
  action: string
  resource_type: string | null
  resource_id: string | null
  outcome: string
  meta: Record<string, unknown> | null
  ip_address: string | null
}

interface AuditPage {
  data: AuditEntry[]
  total: number
}

interface Consent {
  id: string
  client_id: string
  client_name: string
  purpose: string
  status: string
  granted_by: string | null
  granted_at: string
  withdrawn_at: string | null
  notice_version: string | null
}

function time(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function SecurityPage() {
  const [inviting, setInviting] = useState(false)
  const members = useApi<Member[]>('/security/members')
  const audit = useApi<AuditPage>('/security/audit-log?page_size=50')
  const consents = useApi<Consent[]>('/security/consents')

  const list = members.data ?? []
  const withoutMfa = list.filter((m) => !m.mfa_enabled && m.status === 'ACTIVE')
  const active = (consents.data ?? []).filter((c) => c.status === 'GRANTED')

  return (
    <>
      <PageHeader
        title="Security & access"
        lede="Who can reach what, the consent records held per client, and an append-only log of every action on client data."
        actions={
          <Button size="sm" onClick={() => setInviting((v) => !v)}>
            <UserPlus aria-hidden className="size-4" />
            {inviting ? 'Cancel' : 'Invite member'}
          </Button>
        }
      />

      {inviting && (
        <InviteMember
          onDone={() => {
            setInviting(false)
            members.reload()
          }}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Members" value={String(list.length)} />
        <Stat
          label="Without 2FA"
          value={String(withoutMfa.length)}
          tone={withoutMfa.length ? 'warn' : 'ok'}
          note={withoutMfa.length ? 'Enforce before go-live' : 'All covered'}
          icon={<ShieldAlert aria-hidden className="size-4" strokeWidth={1.75} />}
        />
        <Stat
          label="Active consents"
          value={String(active.length)}
          tone="ok"
          note="DPDP Act records"
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Members & roles</CardTitle>
          </CardHeader>
          <Async query={members} isEmpty={(d) => d.length === 0}>
            {(rows) => (
              <ul className="divide-y divide-hairline">
                {rows.map((m) => (
                  <MemberRow key={m.id} member={m} onDone={members.reload} />
                ))}
              </ul>
            )}
          </Async>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Audit log</CardTitle>
            <span className="font-mono text-xs text-ink-muted">append-only</span>
          </CardHeader>
          <Async
            query={audit}
            isEmpty={(d) => d.data.length === 0}
            empty={
              <CardBody>
                <EmptyState title="No entries" hint="Every action on client data is recorded here." />
              </CardBody>
            }
          >
            {(page) => (
              <ul className="scroll-slim max-h-[32rem] divide-y divide-hairline overflow-y-auto">
                {page.data.map((e) => (
                  <li key={e.id} className="px-5 py-3.5">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <span className="text-sm text-ink">
                        <span className="font-medium">{e.actor ?? 'System'}</span>{' '}
                        <span className="text-ink-secondary">
                          {e.action.toLowerCase().replace(/_/g, ' ')}
                        </span>
                      </span>
                      <span className="tnum nowrap-action font-mono text-xs text-ink-muted">
                        {time(e.at)}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-ink-muted">
                      {e.resource_type ?? '—'}
                      {e.ip_address ? ` · ${e.ip_address}` : ''}
                      {e.outcome !== 'SUCCESS' ? ` · ${e.outcome}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Async>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Consent records</CardTitle>
          <span className="text-sm text-ink-muted">DPDP Act</span>
        </CardHeader>
        <Async
          query={consents}
          isEmpty={(d) => d.length === 0}
          empty={
            <CardBody>
              <EmptyState
                title="No consent records"
                hint="Consent is captured when a client is taken through onboarding, and every withdrawal is kept beside the grant."
              />
            </CardBody>
          }
        >
          {(rows) => (
            <ul className="divide-y divide-hairline">
              {rows.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">
                      {c.client_name}
                    </span>
                    <span className="block truncate text-xs text-ink-muted">
                      {c.purpose.toLowerCase().replace(/_/g, ' ')}
                      {c.granted_by ? ` · by ${c.granted_by}` : ''}
                      {c.notice_version ? ` · notice ${c.notice_version}` : ''}
                    </span>
                  </span>
                  <span className="tnum nowrap-action text-xs text-ink-secondary">
                    {formatDate(c.granted_at)}
                    {c.withdrawn_at ? ` → withdrawn ${formatDate(c.withdrawn_at)}` : ''}
                  </span>
                  <Badge tone={c.status === 'GRANTED' ? 'ok' : 'neutral'}>
                    {c.status === 'GRANTED' ? 'Active' : 'Withdrawn'}
                  </Badge>
                  {c.status === 'GRANTED' && (
                    <WithdrawConsent id={c.id} onDone={consents.reload} />
                  )}
                </li>
              ))}
            </ul>
          )}
        </Async>
      </Card>

      <p className="mt-4 text-xs text-ink-muted">
        Role visibility in the sidebar is a convenience only. Authorisation is enforced per
        request and scoped to the signed-in firm — changing a role here changes what the server
        permits, not merely what the menu shows.
      </p>
    </>
  )
}

function MemberRow({ member, onDone }: { member: Member; onDone: () => void }) {
  const action = useAction()
  const suspended = member.status === 'SUSPENDED'

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ink">{member.name}</span>
        <span className="block truncate text-xs text-ink-muted">
          {member.email}
          {member.last_login_at ? ` · last in ${formatDate(member.last_login_at)}` : ' · never signed in'}
        </span>
      </span>

      <label className="shrink-0">
        <span className="sr-only">Role for {member.name}</span>
        <Select
          value={member.role}
          disabled={action.busy}
          onChange={async (e) => {
            if (
              await action.run(() =>
                api.patch(`/security/members/${member.id}`, { role: e.target.value }),
              )
            )
              onDone()
          }}
        >
          {Object.entries(FIRM_ROLES).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </label>

      <Badge tone={userStatus.tone(member.status)}>{userStatus.label(member.status)}</Badge>
      {member.mfa_enabled ? <Badge tone="ok">2FA</Badge> : <Badge tone="warn">No 2FA</Badge>}

      <Button
        variant="ghost"
        size="sm"
        state={action.busy ? 'loading' : 'idle'}
        onClick={async () => {
          if (
            await action.run(() =>
              api.patch(`/security/members/${member.id}`, {
                status: suspended ? 'ACTIVE' : 'SUSPENDED',
              }),
            )
          )
            onDone()
        }}
      >
        {suspended ? 'Restore' : 'Suspend'}
      </Button>
      <ActionError message={action.error} />
    </li>
  )
}

function WithdrawConsent({ id, onDone }: { id: string; onDone: () => void }) {
  const action = useAction()
  return (
    <Button
      variant="ghost"
      size="sm"
      state={action.busy ? 'loading' : 'idle'}
      onClick={async () => {
        if (await action.run(() => api.post(`/consents/${id}/withdraw`))) onDone()
      }}
    >
      Withdraw
    </Button>
  )
}

/**
 * The invite token is returned once and only its digest is stored, so it can
 * never be recovered — it has to be copied now or the invite reissued.
 */
function InviteMember({ onDone }: { onDone: () => void }) {
  const action = useAction()
  const [token, setToken] = useState<string | null>(null)

  if (token) {
    return (
      <Card className="mb-5">
        <CardHeader>
          <CardTitle>Invite created</CardTitle>
        </CardHeader>
        <CardBody className="flex flex-col gap-3">
          <p className="text-sm text-ink-secondary">
            Send this one-time token to the invitee — they set their own password with it. Only
            its digest is stored, so it cannot be shown again; reissue the invite if it is lost.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="scroll-slim min-w-0 flex-1 overflow-x-auto rounded-control bg-paper-sunken px-3 py-2 font-mono text-xs text-ink">
              {token}
            </code>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void navigator.clipboard?.writeText(token)}
            >
              <Copy aria-hidden className="size-4" />
              Copy
            </Button>
            <Button size="sm" onClick={onDone}>
              Done
            </Button>
          </div>
        </CardBody>
      </Card>
    )
  }

  return (
    <Card className="mb-5">
      <CardHeader>
        <CardTitle>Invite a colleague</CardTitle>
      </CardHeader>
      <CardBody>
        <form
          className="grid gap-4 sm:grid-cols-4"
          onSubmit={async (e) => {
            e.preventDefault()
            const data = new FormData(e.currentTarget)
            await action.run(async () => {
              const result = await api.post<{ invite_token: string }>('/auth/invite', {
                email: String(data.get('email')).trim(),
                first_name: String(data.get('first_name')).trim(),
                last_name: String(data.get('last_name')).trim(),
                role: String(data.get('role')),
              })
              setToken(result.invite_token)
            })
          }}
        >
          <Field label="First name">
            {(a) => <Input {...a} name="first_name" required placeholder="Sunita" />}
          </Field>
          <Field label="Last name">
            {(a) => <Input {...a} name="last_name" required placeholder="Nair" />}
          </Field>
          <Field label="Work email">
            {(a) => <Input {...a} name="email" type="email" required placeholder="s.nair@firm.in" />}
          </Field>
          <Field label="Role">
            {(a) => (
              <Select {...a} name="role" defaultValue="STAFF" className="h-11 w-full">
                {Object.entries(FIRM_ROLES)
                  .filter(([value]) => value !== 'OWNER' && value !== 'CLIENT')
                  .map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
              </Select>
            )}
          </Field>

          <div className="flex flex-col gap-2 sm:col-span-4">
            <ActionError message={action.error} />
            <div>
              <Button type="submit" size="sm" state={action.busy ? 'loading' : 'idle'}>
                Create invite
              </Button>
            </div>
          </div>
        </form>
      </CardBody>
    </Card>
  )
}
