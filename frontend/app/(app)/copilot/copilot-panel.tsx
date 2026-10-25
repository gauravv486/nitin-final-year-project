'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowUp, ShieldCheck, Sparkles, ThumbsDown, ThumbsUp } from 'lucide-react'
import { api } from '@/lib/api'
import { useAction } from '@/lib/use-api'
import { PageHeader } from '@/components/app-shell/page-header'
import { Button } from '@/components/ui/button'
import { Badge, Card, CardBody } from '@/components/ui/surface'
import { Textarea } from '@/components/ui/field'
import { ActionError } from '@/components/ui/async'

/* Each of these maps to a parameterised query the backend has vetted, not to
 * generated SQL. Classifying intent then running a fixed query is both safer
 * and far easier to defend than text-to-SQL over a multi-tenant database. */
const SUGGESTIONS = [
  'Which returns are overdue?',
  'How much ITC is at risk?',
  'What is due in the next seven days?',
  'Show me the open risk findings',
]

interface Answer {
  answer: string
  intent: string
  intent_label: string
  confidence: number
  columns: string[]
  rows: unknown[][]
  citations: { citation?: string; title?: string; passage?: string }[]
  slots: Record<string, unknown>
  provider: string
  model: string | null
  interaction_id: string | null
  suggestions: string[]
}

interface Turn {
  question: string
  answer: Answer
}

export function CopilotPanel() {
  const [value, setValue] = useState('')
  const [turns, setTurns] = useState<Turn[]>([])
  const action = useAction()
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [turns])

  async function ask(question: string) {
    const trimmed = question.trim()
    if (!trimmed) return
    setValue('')
    await action.run(async () => {
      const answer = await api.post<Answer>('/copilot/ask', { question: trimmed })
      setTurns((t) => [...t, { question: trimmed, answer }])
    })
  }

  return (
    <>
      <PageHeader
        title="Copilot"
        lede="Ask about your own ledger. Answers come back with the rows they were derived from."
      />

      <Card className="flex min-h-[26rem] flex-col">
        {turns.length === 0 ? (
          <CardBody className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
            <div className="max-w-[46ch]">
              <p className="text-base font-medium text-ink">Nothing asked yet</p>
              <p className="mt-1.5 text-sm text-ink-secondary">
                The copilot reads your firm&rsquo;s own data. It does not answer general tax
                questions, and it will say so rather than guess.
              </p>
            </div>

            <ul className="flex w-full max-w-xl flex-col gap-2">
              {SUGGESTIONS.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    onClick={() => void ask(s)}
                    className="press w-full rounded-control bg-paper-sunken px-4 py-2.5 text-left text-sm text-ink-secondary hover:bg-paper-sunken/70 hover:text-ink"
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </CardBody>
        ) : (
          <CardBody className="scroll-slim flex max-h-[34rem] flex-1 flex-col gap-6 overflow-y-auto">
            {turns.map((turn, i) => (
              <TurnView key={i} turn={turn} onFollowUp={(q) => void ask(q)} />
            ))}
            {action.busy && (
              <p className="text-sm text-ink-muted" aria-live="polite">
                Working…
              </p>
            )}
            <div ref={endRef} />
          </CardBody>
        )}

        <div className="border-t border-hairline p-4">
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              void ask(value)
            }}
          >
            <label htmlFor="ask" className="sr-only">
              Ask a question about your data
            </label>
            <Textarea
              id="ask"
              name="ask"
              rows={1}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                // Enter sends; Shift+Enter breaks the line.
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void ask(value)
                }
              }}
              placeholder="Ask about clients, filings or reconciliations"
              className="max-h-40 min-h-11"
            />
            <Button
              type="submit"
              size="md"
              disabled={!value.trim() || action.busy}
              state={action.busy ? 'loading' : 'idle'}
              aria-label="Send"
            >
              <ArrowUp aria-hidden className="size-4" />
            </Button>
          </form>
          <ActionError message={action.error} />
        </div>
      </Card>

      <p className="mt-4 flex items-start gap-2 text-xs text-ink-muted">
        <ShieldCheck aria-hidden className="mt-px size-3.5 shrink-0" />
        <span>
          Questions are classified into one of twelve intents and answered with a vetted,
          parameterised query. The copilot never generates SQL, and it only ever sees the
          clients you are permitted to see.
        </span>
      </p>
    </>
  )
}

function TurnView({ turn, onFollowUp }: { turn: Turn; onFollowUp: (q: string) => void }) {
  const { answer } = turn
  const feedback = useAction()
  const [rated, setRated] = useState<number | null>(null)

  return (
    <div className="flex flex-col gap-3">
      <p className="self-end rounded-card rounded-br-sm bg-accent px-4 py-2.5 text-sm text-accent-ink">
        {turn.question}
      </p>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="accent">{answer.intent_label}</Badge>
          {/* Low confidence is shown, not hidden — a reader deserves to know
              the classifier was unsure which question this was. */}
          <span className="text-xs text-ink-muted">
            {Math.round(answer.confidence * 100)}% confident
          </span>
          {answer.provider !== 'none' && (
            <span className="flex items-center gap-1 text-xs text-ink-muted">
              <Sparkles aria-hidden className="size-3" />
              {answer.provider}
              {answer.model ? ` · ${answer.model}` : ''}
            </span>
          )}
        </div>

        <p className="whitespace-pre-wrap text-sm text-ink">{answer.answer}</p>

        {answer.rows.length > 0 && (
          <div className="scroll-slim mt-1 overflow-x-auto rounded-control border border-hairline">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-hairline bg-paper-sunken">
                  {answer.columns.map((c) => (
                    <th
                      key={c}
                      scope="col"
                      className="whitespace-nowrap px-3 py-2 font-medium text-ink-secondary"
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {answer.rows.map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => (
                      <td key={j} className="whitespace-nowrap px-3 py-2 text-ink-secondary">
                        {cell === null || cell === undefined ? '—' : String(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {answer.citations.length > 0 && (
          <div className="mt-1">
            <p className="label">Authorities relied on</p>
            <ul className="mt-1 flex flex-col gap-1">
              {answer.citations.map((c, i) => (
                <li key={i} className="text-xs text-ink-secondary">
                  <span className="font-medium">{c.citation}</span> {c.title}
                </li>
              ))}
            </ul>
          </div>
        )}

        {answer.suggestions.length > 0 && (
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {answer.suggestions.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => onFollowUp(s)}
                  className="press nowrap-action rounded-pill border border-hairline-strong bg-paper-raised px-3 py-1 text-xs text-ink-secondary hover:bg-paper-sunken"
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        )}

        {answer.interaction_id && (
          <div className="mt-1 flex items-center gap-2">
            {rated === null ? (
              <>
                <span className="text-xs text-ink-muted">Was this right?</span>
                {([1, -1] as const).map((score) => (
                  <button
                    key={score}
                    type="button"
                    disabled={feedback.busy}
                    aria-label={score === 1 ? 'Helpful' : 'Not helpful'}
                    onClick={async () => {
                      if (
                        await feedback.run(() =>
                          api.post(`/copilot/feedback/${answer.interaction_id}`, { score }),
                        )
                      )
                        setRated(score)
                    }}
                    className="press rounded-chip p-1 text-ink-faint hover:text-ink"
                  >
                    {score === 1 ? (
                      <ThumbsUp aria-hidden className="size-3.5" />
                    ) : (
                      <ThumbsDown aria-hidden className="size-3.5" />
                    )}
                  </button>
                ))}
              </>
            ) : (
              <span className="text-xs text-ok">Thanks — recorded.</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
