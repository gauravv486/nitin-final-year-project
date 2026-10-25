'use client'

import { useRef, useState } from 'react'
import { CheckCircle2, CloudUpload, FileText, RefreshCw } from 'lucide-react'
import { api, num } from '@/lib/api'
import { useApi, useAction } from '@/lib/use-api'
import { DOCUMENT_KINDS, docStatus, type DocumentStatus } from '@/lib/enums'
import { cn, formatDate, inr } from '@/lib/utils'
import { PageHeader } from '@/components/app-shell/page-header'
import { ClientPicker, useClientPicker } from '@/components/app-shell/pickers'
import { Badge, Card, CardBody, CardHeader, CardTitle } from '@/components/ui/surface'
import { Button } from '@/components/ui/button'
import { ActionError, Async, EmptyState, Select } from '@/components/ui/async'

interface Doc {
  id: string
  client_id: string
  client_name: string
  file_name: string
  mime_type: string
  size_bytes: number
  kind: string
  status: DocumentStatus
  period: string | null
  uploaded_by: string | null
  created_at: string
  confidence: number | null
  summary: Record<string, unknown> | null
}

interface DocList {
  data: Doc[]
  total: number
  status_counts: Record<string, number>
}

/** The summary the backend attaches per document kind. */
function summaryRows(doc: Doc): { label: string; value: string }[] {
  const s = doc.summary ?? {}
  const pick = (key: string) => (s[key] === null || s[key] === undefined ? null : String(s[key]))
  const rows: { label: string; value: string }[] = []

  const supplier = pick('supplier_name') ?? pick('taxpayer_name') ?? pick('deductor_tan')
  if (supplier) rows.push({ label: 'Party', value: supplier })

  const ref = pick('invoice_no') ?? pick('notice_number') ?? pick('section')
  if (ref) rows.push({ label: 'Reference', value: ref })

  const amount =
    pick('invoice_total') ?? pick('taxable_value') ?? pick('demand_amount') ?? pick('amount_paid')
  if (amount) rows.push({ label: 'Amount', value: inr(num(amount)) })

  const when = pick('invoice_date') ?? pick('issued_on') ?? pick('due_date')
  if (when) rows.push({ label: 'Date', value: formatDate(when) })

  return rows
}

export default function DocumentsPage() {
  const picker = useClientPicker()
  const [status, setStatus] = useState('')
  const query = useApi<DocList>(
    `/documents?page_size=50${picker.selected ? `&client_id=${picker.selected}` : ''}${status ? `&status=${status}` : ''}`,
  )

  return (
    <>
      <PageHeader
        title="Documents"
        lede="Upload invoices, notices and statements. Fields come back with a confidence score and the checks behind it."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ClientPicker
              clients={picker.clients}
              value={picker.selected}
              onChange={picker.setSelected}
            />
            <label className="flex items-center gap-2 text-sm">
              <span className="label shrink-0">Status</span>
              <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">All</option>
                {(['QUEUED', 'EXTRACTING', 'NEEDS_REVIEW', 'VERIFIED', 'FAILED'] as const).map(
                  (s) => (
                    <option key={s} value={s}>
                      {docStatus.label(s)}
                    </option>
                  ),
                )}
              </Select>
            </label>
          </div>
        }
      />

      {picker.selected && <UploadBox clientId={picker.selected} onDone={query.reload} />}

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Uploads</CardTitle>
          <span className="text-sm text-ink-muted">{query.data?.total ?? 0}</span>
        </CardHeader>

        <Async
          query={query}
          isEmpty={(d) => d.data.length === 0}
          empty={
            <CardBody>
              <EmptyState
                title="No documents yet"
                hint="Upload a purchase invoice above. Extraction runs immediately and the fields come back for review."
              />
            </CardBody>
          }
        >
          {(list) => (
            <ul className="divide-y divide-hairline">
              {list.data.map((d) => (
                <li key={d.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
                    <FileText
                      aria-hidden
                      className="mt-0.5 size-4 shrink-0 text-ink-faint"
                      strokeWidth={1.75}
                    />

                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-sm text-ink">{d.file_name}</p>
                      <p className="truncate text-xs text-ink-muted">
                        {d.client_name} · {DOCUMENT_KINDS[d.kind] ?? d.kind} ·{' '}
                        {Math.max(1, Math.round(d.size_bytes / 1024))} KB · {formatDate(d.created_at)}
                      </p>
                    </div>

                    <Badge tone={docStatus.tone(d.status)}>{docStatus.label(d.status)}</Badge>
                    <DocActions doc={d} onDone={query.reload} />
                  </div>

                  {(summaryRows(d).length > 0 || d.confidence !== null) && (
                    /* A sunken well, not a nested card — no border, so it reads as
                       inset rather than as a second surface stacked on the first. */
                    <dl className="tnum mt-3 grid gap-3 rounded-control bg-paper-sunken p-3 text-sm sm:grid-cols-4">
                      {summaryRows(d).map((row) => (
                        <div key={row.label} className="min-w-0">
                          <dt className="label">{row.label}</dt>
                          <dd className="mt-0.5 truncate text-ink">{row.value}</dd>
                        </div>
                      ))}
                      {d.confidence !== null && (
                        <div>
                          <dt className="label">Confidence</dt>
                          <dd
                            className={cn(
                              'mt-0.5 font-medium',
                              d.confidence >= 0.9
                                ? 'text-ok'
                                : d.confidence >= 0.75
                                  ? 'text-warn'
                                  : 'text-risk',
                            )}
                          >
                            {Math.round(d.confidence * 100)}%
                          </dd>
                        </div>
                      )}
                    </dl>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Async>
      </Card>
    </>
  )
}

/** Verify accepts the extraction as-is; re-extract re-runs the reader. */
function DocActions({ doc, onDone }: { doc: Doc; onDone: () => void }) {
  const action = useAction()

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <div className="flex gap-1.5">
        {doc.status === 'NEEDS_REVIEW' && (
          <Button
            size="sm"
            state={action.busy ? 'loading' : 'idle'}
            onClick={async () => {
              if (await action.run(() => api.post(`/documents/${doc.id}/verify`, { corrections: {} })))
                onDone()
            }}
          >
            <CheckCircle2 aria-hidden className="size-4" />
            Verify
          </Button>
        )}
        {(doc.status === 'FAILED' || doc.status === 'QUEUED' || doc.status === 'NEEDS_REVIEW') && (
          <Button
            variant="secondary"
            size="sm"
            state={action.busy ? 'loading' : 'idle'}
            onClick={async () => {
              if (await action.run(() => api.post(`/documents/${doc.id}/extract`))) onDone()
            }}
          >
            <RefreshCw aria-hidden className="size-4" />
            Re-read
          </Button>
        )}
      </div>
      <ActionError message={action.error} />
    </div>
  )
}

function UploadBox({ clientId, onDone }: { clientId: string; onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [kind, setKind] = useState('PURCHASE_INVOICE')
  const [dragging, setDragging] = useState(false)
  const action = useAction()

  async function send(files: FileList | null) {
    if (!files || files.length === 0) return
    // One request per file rather than one multi-file request: the endpoint
    // extracts synchronously, and a single failure shouldn't lose the rest.
    const ok = await action.run(async () => {
      for (const file of Array.from(files)) {
        const body = new FormData()
        body.set('file', file)
        body.set('kind', kind)
        await api.form(`/clients/${clientId}/documents`, body)
      }
    })
    if (ok) {
      if (fileRef.current) fileRef.current.value = ''
      onDone()
    }
  }

  return (
    <Card
      className={cn(
        'border-dashed border-hairline-strong bg-paper-sunken/50 transition-colors',
        dragging && 'border-accent-strong bg-accent-wash',
      )}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        void send(e.dataTransfer.files)
      }}
    >
      <CardBody className="flex flex-col items-center gap-3 py-10 text-center">
        <CloudUpload aria-hidden className="size-7 text-ink-faint" strokeWidth={1.5} />
        <div>
          <p className="text-sm font-medium text-ink">
            {action.busy ? 'Reading…' : 'Drop files here'}
          </p>
          <p className="mt-1 text-xs text-ink-muted">PDF, JPG or PNG · up to 10 MB each</p>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <span className="label shrink-0">Kind</span>
          <Select value={kind} onChange={(e) => setKind(e.target.value)}>
            {Object.entries(DOCUMENT_KINDS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </label>

        <input
          ref={fileRef}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.csv,.xlsx"
          className="sr-only"
          onChange={(e) => void send(e.target.files)}
        />
        <Button
          variant="secondary"
          size="sm"
          state={action.busy ? 'loading' : 'idle'}
          onClick={() => fileRef.current?.click()}
        >
          Choose files
        </Button>
        <ActionError message={action.error} />
      </CardBody>
    </Card>
  )
}
