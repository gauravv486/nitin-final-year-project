import { Section, SectionHead } from '@/components/ui/surface'

/* The three matching passes, in the order the engine runs them. This is the
 * project's actual technical contribution, so it gets its own section rather
 * than one line in a feature grid. */
const PASSES = [
  {
    n: '01',
    title: 'Exact key',
    body: 'GSTIN plus invoice number plus period. Clears the large majority of rows outright and never needs a human.',
    detail: 'GSTIN + invoice no. + tax period',
  },
  {
    n: '02',
    title: 'Fuzzy supplier',
    body: 'When the invoice number is keyed differently, the supplier name is compared by trigram similarity and the amount by a tolerance band.',
    detail: 'trigram similarity ≥ 0.75 · amount ± ₹1 · date ± 7 days',
  },
  {
    n: '03',
    title: 'Residual review',
    body: 'Whatever is left is genuinely unmatched — in the books but not the portal, or the reverse. These are the rows worth a person’s attention.',
    detail: 'one-sided rows surfaced with a reason code',
  },
]

export function Reconciliation() {
  return (
    <Section id="reconciliation" className="scroll-mt-16 bg-accent-wash/60">
      <div className="shell">
        <SectionHead
          title="How the matching actually works"
          lede="Reconciliation is the part of GST work that eats the most hours and gets the least credit. Three passes run in order, each one handling what the pass before it could not."
        />

        <ol className="mt-12 grid gap-px overflow-hidden rounded-card border border-hairline bg-hairline md:grid-cols-3">
          {PASSES.map((p) => (
            <li key={p.n} className="flex flex-col gap-3 bg-paper-raised p-6">
              <span className="font-mono text-sm font-medium text-accent-strong">{p.n}</span>
              <h3 className="text-xl font-semibold text-ink">{p.title}</h3>
              <p className="text-sm text-ink-secondary">{p.body}</p>
              <p className="mt-auto border-t border-hairline pt-3 font-mono text-xs text-ink-muted">
                {p.detail}
              </p>
            </li>
          ))}
        </ol>

        <p className="measure mt-8 text-sm text-ink-muted">
          Thresholds are tunable per firm, and every automatic match records which pass
          produced it — so a reviewer can always see why two rows were paired.
        </p>
      </div>
    </Section>
  )
}
