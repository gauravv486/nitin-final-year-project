'use client'

import { useState } from 'react'
import { Download, FileSpreadsheet, Play } from 'lucide-react'
import { api, download } from '@/lib/api'
import { useApi, useAction } from '@/lib/use-api'
import { reportStatus, type ReportStatus } from '@/lib/enums'
import { formatDate } from '@/lib/utils'
import { PageHeader } from '@/components/app-shell/page-header'
import { Button } from '@/components/ui/button'
import { Badge, Card, CardBody, CardHeader, CardTitle, Stat } from '@/components/ui/surface'
import { ActionError, Async, EmptyState, Select } from '@/components/ui/async'

interface Definition {
  kind: string
  name: string
  scope: string
  params: string[]
  formats: string[]
}

interface Report {
  id: string
  name: string
  kind: string
  format: string
  status: ReportStatus
  parameters: Record<string, unknown>
  row_count: number | null
  size_bytes: number | null
  checksum: string | null
  generated_by: string | null
  created_at: string
}

export default function ReportsPage() {
  const definitions = useApi<Definition[]>('/reports/definitions')
  const generated = useApi<Report[]>('/reports')

  const thisMonth = (generated.data ?? []).filter(
    (r) => new Date(r.created_at).getMonth() === new Date().getMonth(),
  ).length

  return (
    <>
      <PageHeader
        title="Reports & export"
        lede="Aggregated reporting across every client you can see, exported as CSV or XLSX with a SHA-256 of the file."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Report types" value={String(definitions.data?.length ?? 0)} />
        <Stat label="Generated" value={String(generated.data?.length ?? 0)} tone="info" />
        <Stat label="Run this month" value={String(thisMonth)} />
      </div>

      <Async query={definitions} isEmpty={(d) => d.length === 0}>
        {(defs) => (
          <ul className="mt-4 grid gap-4 lg:grid-cols-2">
            {defs.map((d) => (
              <DefinitionCard key={d.kind} definition={d} onDone={generated.reload} />
            ))}
          </ul>
        )}
      </Async>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Generated reports</CardTitle>
          <span className="text-sm text-ink-muted">{generated.data?.length ?? 0}</span>
        </CardHeader>

        <Async
          query={generated}
          isEmpty={(d) => d.length === 0}
          empty={
            <CardBody>
              <EmptyState
                title="Nothing generated yet"
                hint="Generate one above. Every generation and download is written to the audit log with the actor and the scope."
              />
            </CardBody>
          }
        >
          {(list) => (
            <ul className="divide-y divide-hairline">
              {list.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
                  <FileSpreadsheet
                    aria-hidden
                    className="size-4 shrink-0 text-ink-faint"
                    strokeWidth={1.75}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{r.name}</span>
                    <span className="block truncate text-xs text-ink-muted">
                      {r.row_count ?? 0} row{r.row_count === 1 ? '' : 's'} ·{' '}
                      {r.size_bytes ? `${Math.max(1, Math.round(r.size_bytes / 1024))} KB · ` : ''}
                      {formatDate(r.created_at)}
                      {r.generated_by ? ` · ${r.generated_by}` : ''}
                    </span>
                  </span>

                  {/* The checksum is what makes an export verifiable after it
                      has left the building. */}
                  {r.checksum && (
                    <span
                      className="nowrap-action hidden font-mono text-xs text-ink-faint sm:block"
                      title={`SHA-256 ${r.checksum}`}
                    >
                      {r.checksum.slice(0, 10)}…
                    </span>
                  )}

                  <Badge tone={reportStatus.tone(r.status)}>{reportStatus.label(r.status)}</Badge>
                  <DownloadButton report={r} />
                </li>
              ))}
            </ul>
          )}
        </Async>
      </Card>
    </>
  )
}

function DownloadButton({ report }: { report: Report }) {
  const action = useAction()
  return (
    <span className="flex flex-col items-end gap-1">
      <Button
        variant="secondary"
        size="sm"
        disabled={report.status !== 'READY'}
        state={action.busy ? 'loading' : 'idle'}
        onClick={() =>
          action.run(() =>
            download(
              `/reports/${report.id}/download`,
              `${report.kind}.${report.format.toLowerCase()}`,
            ),
          )
        }
      >
        <Download aria-hidden className="size-4" />
        Download
      </Button>
      <ActionError message={action.error} />
    </span>
  )
}

function DefinitionCard({
  definition,
  onDone,
}: {
  definition: Definition
  onDone: () => void
}) {
  const [format, setFormat] = useState(definition.formats[0] ?? 'XLSX')
  const action = useAction()
  const [note, setNote] = useState<string | null>(null)

  return (
    <Card as="li">
      <CardBody className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-ink">{definition.name}</h3>
            <p className="mt-0.5 text-sm text-ink-muted">{definition.scope}</p>
          </div>
          <Badge tone="neutral">On demand</Badge>
        </div>

        {definition.params.length > 0 && (
          <p className="text-xs text-ink-muted">
            Accepts: {definition.params.join(', ')}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <span className="label shrink-0">Format</span>
            <Select value={format} onChange={(e) => setFormat(e.target.value)}>
              {definition.formats.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </Select>
          </label>

          <Button
            size="sm"
            state={action.busy ? 'loading' : 'idle'}
            onClick={async () => {
              await action.run(async () => {
                const report = await api.post<Report>('/reports', {
                  kind: definition.kind,
                  format,
                  parameters: {},
                })
                setNote(`${report.row_count ?? 0} rows. Ready to download below.`)
                onDone()
              })
            }}
          >
            <Play aria-hidden className="size-4" />
            {action.busy ? 'Generating' : 'Generate'}
          </Button>
        </div>

        {note && <p className="text-xs text-ok">{note}</p>}
        <ActionError message={action.error} />
      </CardBody>
    </Card>
  )
}
