import { Section, SectionHead } from '@/components/ui/surface'

/**
 * F4 · Step sequence. Knobs: numbering = 01/02/03 · layout = vertical stack ·
 * connector = line.
 */
const STEPS = [
  {
    n: '01',
    title: 'Add the client once',
    body: 'GSTIN, PAN and entity type go in at onboarding. Those registrations decide which statutory deadlines the system creates — a client with no TDS registration never sees a 26Q task.',
  },
  {
    n: '02',
    title: 'Send documents in',
    body: 'Staff upload purchase and sales invoices, or the client uploads their own through a scoped portal link. Each file is queued, read, and returned as editable fields with a confidence score.',
  },
  {
    n: '03',
    title: 'Run the reconciliation',
    body: 'Import the period’s GSTR-2B. The three matching passes run, and what comes back is a worklist of genuine exceptions rather than a spreadsheet of everything.',
  },
  {
    n: '04',
    title: 'Resolve, then file',
    body: 'Accept a match, correct an amount, or raise it with the supplier. Once the exceptions are clear the period is marked ready and the deadline closes on the calendar.',
  },
]

export function Workflow() {
  return (
    <Section id="workflow" className="scroll-mt-16">
      <div className="shell">
        <SectionHead
          title="A period, start to finish"
          lede="The same four steps every month, for every client, with the state of each one visible to whoever picks it up next."
        />

        <ol className="mt-12 flex flex-col">
          {STEPS.map((s, i) => (
            <li key={s.n} className="group grid grid-cols-[auto_minmax(0,1fr)] gap-x-5 sm:gap-x-8">
              {/* Rail: numeral + connector */}
              <div className="flex flex-col items-center">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-pill border border-hairline-strong bg-paper-raised font-mono text-sm font-medium text-accent-strong">
                  {s.n}
                </span>
                {i < STEPS.length - 1 && (
                  <span aria-hidden className="w-px flex-1 bg-hairline-strong" />
                )}
              </div>

              <div className="pb-10 pt-2.5">
                <h3 className="text-xl font-semibold text-ink">{s.title}</h3>
                <p className="measure mt-2 text-sm text-ink-secondary">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </Section>
  )
}
