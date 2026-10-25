import { Compass, Layers, Workflow } from 'lucide-react'
import { Section, SectionHead } from '@/components/ui/surface'

/**
 * Three icon-led blocks, matching the reference's "At a Glance" section:
 * Problems We Solve · Why CA-OS · How It Works.
 *
 * This is a three-column icon-above-heading grid, which Hallmark normally
 * fails on (gate 3). Kept at the user's explicit direction to match the
 * reference layout; the pastel block fills and uneven copy length keep it from
 * reading as a stock feature triplet.
 */
const BLOCKS = [
  {
    icon: Compass,
    kicker: 'Problems we solve',
    title: 'The work that eats the month',
    tone: 'bg-tint-blue',
    body: 'Reconciling 2B line by line. Chasing clients for a bill that never arrives. Finding out on the 19th that a return was never started. Re-keying the same invoice into three places.',
  },
  {
    icon: Layers,
    kicker: 'Why CA-OS',
    title: 'Sixteen modules, one client record',
    tone: 'bg-tint-mint',
    body: 'A registration entered once decides which deadlines exist, which returns apply and which forms appear. Nothing is typed twice, and nothing drifts out of sync.',
  },
  {
    icon: Workflow,
    kicker: 'How it works',
    title: 'Import, match, resolve, file',
    tone: 'bg-tint-lilac',
    body: 'Documents come in and are read. The portal statement is imported and matched. What is left is a short worklist of real exceptions, not a spreadsheet of everything.',
  },
]

export function Glance() {
  return (
    <Section id="glance" className="scroll-mt-16">
      <div className="shell">
        <SectionHead title="CA-OS at a glance" />

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {BLOCKS.map((b) => (
            <div
              key={b.kicker}
              className={`flex flex-col gap-4 rounded-card-lg ${b.tone} p-7`}
            >
              <span className="grid size-11 place-items-center rounded-pill bg-paper-raised">
                <b.icon aria-hidden className="size-5 text-ink" strokeWidth={1.75} />
              </span>
              <div>
                <p className="label-on-tint">{b.kicker}</p>
                <h3 className="mt-2 text-xl font-semibold text-ink">{b.title}</h3>
              </div>
              <p className="text-sm text-ink-secondary">{b.body}</p>
            </div>
          ))}
        </div>
      </div>
    </Section>
  )
}
