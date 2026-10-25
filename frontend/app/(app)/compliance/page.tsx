'use client'

import { useMemo, useState } from 'react'
import { CalendarPlus } from 'lucide-react'
import { api } from '@/lib/api'
import { useApi, useAction } from '@/lib/use-api'
import type { FilingStatus } from '@/lib/enums'
import { formatDate } from '@/lib/utils'
import { PageHeader } from '@/components/app-shell/page-header'
import { DueIn, FilingBadge } from '@/components/app-shell/status'
import { PeriodPicker, recentPeriods } from '@/components/app-shell/pickers'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader, CardTitle, Stat } from '@/components/ui/surface'
import { ActionError, Async, EmptyState, Select } from '@/components/ui/async'

interface Task {
  id: string
  client_id: string
  client_name: string
  form: string
  description: string | null
  period: string
  due_date: string
  days_left: number
  status: FilingStatus
  assignee: string | null
}

export default function CompliancePage() {
  const query = useApi<Task[]>('/compliance/tasks?limit=200')
  const [note, setNote] = useState<string | null>(null)

  const groups = useMemo(() => {
    const tasks = [...(query.data ?? [])].sort((a, b) => a.days_left - b.days_left)
    return [
      {
        title: 'Overdue',
        items: tasks.filter((t) => t.status === 'OVERDUE'),
        empty: 'Nothing overdue.',
      },
      {
        title: 'Upcoming',
        items: tasks.filter((t) => t.status !== 'OVERDUE' && t.status !== 'FILED'),
        empty: 'No open filings.',
      },
      { title: 'Filed', items: tasks.filter((t) => t.status === 'FILED'), empty: 'Nothing filed yet.' },
    ]
  }, [query.data])

  return (
    <>
      <PageHeader
        title="Compliance calendar"
        lede="Deadlines generated per client from their registrations, assigned to whoever owns the filing."
        actions={
          <GeneratePeriod
            onDone={(message) => {
              setNote(message)
              query.reload()
            }}
          />
        }
      />

      {note && <p className="mb-4 text-sm text-ok">{note}</p>}

      <Async
        query={query}
        isEmpty={(d) => d.length === 0}
        empty={
          <EmptyState
            title="No deadlines yet"
            hint="Generate a period above. Tasks are created from each client's registrations — GST frequency, TDS applicability, ROC obligations."
          />
        }
      >
        {() => (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <Stat
                label="Overdue"
                value={String(groups[0].items.length)}
                tone={groups[0].items.length ? 'risk' : 'ok'}
              />
              <Stat label="Open" value={String(groups[1].items.length)} tone="warn" />
              <Stat label="Filed" value={String(groups[2].items.length)} tone="ok" />
            </div>

            <div className="mt-6 flex flex-col gap-4">
              {groups.map((g) => (
                <Card key={g.title}>
                  <CardHeader>
                    <CardTitle>{g.title}</CardTitle>
                    <span className="text-sm text-ink-muted">{g.items.length}</span>
                  </CardHeader>

                  {g.items.length === 0 ? (
                    <p className="px-5 py-5 text-sm text-ink-muted">{g.empty}</p>
                  ) : (
                    <ul className="divide-y divide-hairline">
                      {g.items.map((t) => (
                        <TaskRow key={t.id} task={t} onDone={query.reload} />
                      ))}
                    </ul>
                  )}
                </Card>
              ))}
            </div>
          </>
        )}
      </Async>
    </>
  )
}

/** The status dropdown writes straight through — no separate save button. */
function TaskRow({ task, onDone }: { task: Task; onDone: () => void }) {
  const action = useAction()

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
      <span className="w-20 shrink-0 font-mono text-sm font-medium text-ink">{task.form}</span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-ink">{task.description ?? task.form}</span>
        <span className="block truncate text-xs text-ink-muted">
          {task.client_name} · {task.period}
          {task.assignee ? ` · ${task.assignee}` : ''}
        </span>
      </span>

      <span className="tnum shrink-0 text-right">
        <span className="block text-sm text-ink">{formatDate(task.due_date)}</span>
        <DueIn days={task.days_left} />
      </span>

      <FilingBadge status={task.status} />

      <span className="flex shrink-0 flex-col items-end gap-1">
        <label className="sr-only" htmlFor={`status-${task.id}`}>
          Change status for {task.form}
        </label>
        <Select
          id={`status-${task.id}`}
          value={task.status === 'OVERDUE' ? '' : task.status}
          disabled={action.busy}
          onChange={async (e) => {
            const next = e.target.value
            if (!next) return
            if (await action.run(() => api.patch(`/compliance/tasks/${task.id}`, { status: next })))
              onDone()
          }}
        >
          {task.status === 'OVERDUE' && <option value="">Mark as…</option>}
          <option value="NOT_STARTED">Not started</option>
          <option value="PENDING">Pending</option>
          <option value="IN_PROGRESS">In progress</option>
          <option value="FILED">Filed</option>
        </Select>
        <ActionError message={action.error} />
      </span>
    </li>
  )
}

/**
 * Generating a period reads each client's registrations and creates only the
 * obligations that actually apply — a QRMP filer does not get monthly GSTR-3B.
 */
function GeneratePeriod({ onDone }: { onDone: (message: string) => void }) {
  const [period, setPeriod] = useState(recentPeriods()[0])
  const action = useAction()

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <PeriodPicker value={period} onChange={setPeriod} />
        <Button
          size="sm"
          state={action.busy ? 'loading' : 'idle'}
          onClick={async () => {
            await action.run(async () => {
              const created = await api.post<Task[]>('/compliance/generate', { period })
              onDone(
                created.length === 0
                  ? 'Nothing new — those deadlines already exist for this period.'
                  : `${created.length} deadline${created.length === 1 ? '' : 's'} created.`,
              )
            })
          }}
        >
          <CalendarPlus aria-hidden className="size-4" />
          {action.busy ? 'Generating' : 'Generate'}
        </Button>
      </div>
      <ActionError message={action.error} />
    </div>
  )
}
