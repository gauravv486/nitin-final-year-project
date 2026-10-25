import { Building2, Sprout } from 'lucide-react'
import { Section, SectionHead } from '@/components/ui/surface'

/**
 * Mirrors the reference's two-column "Scale-Ups / Enterprise" split, but as
 * who the product is *for* rather than who already uses it. A "trusted by"
 * band needs real named firms; describing the fit needs none and is true.
 */
const SEGMENTS = [
  {
    icon: Sprout,
    tag: 'Growing practices',
    title: 'One or two partners, a few articles',
    tone: 'bg-accent-wash',
    points: [
      'Up to ~50 clients across GST and income tax',
      'Everyone does a bit of everything',
      'Deadlines tracked in a spreadsheet today',
      'Needs the filing calendar and reconciliation first',
    ],
  },
  {
    icon: Building2,
    tag: 'Established firms',
    title: 'Multiple partners with dedicated teams',
    tone: 'bg-tint-lilac',
    points: [
      'Hundreds of clients, work split by domain',
      'Separate payroll, secretarial and litigation desks',
      'Review and sign-off has to be auditable',
      'Needs role separation and the audit log',
    ],
  },
]

export function Audience() {
  return (
    <Section id="audience" className="scroll-mt-16">
      <div className="shell">
        <SectionHead
          title="Built for Indian practices of both shapes"
          lede="The modules are the same; which ones matter first is not."
        />

        <div className="mt-12 grid gap-5 lg:grid-cols-2">
          {SEGMENTS.map((s) => (
            <div
              key={s.tag}
              className={`flex flex-col gap-4 rounded-card-lg ${s.tone} p-7 sm:p-9`}
            >
              <s.icon aria-hidden className="size-6 text-ink" strokeWidth={1.75} />
              <div>
                <p className="label-on-tint">{s.tag}</p>
                <h3 className="mt-2 text-2xl font-semibold text-ink">{s.title}</h3>
              </div>
              <ul className="mt-1 flex flex-col gap-2.5">
                {s.points.map((p) => (
                  <li key={p} className="flex items-start gap-2.5 text-sm text-ink-secondary">
                    <span
                      aria-hidden
                      className="mt-1.5 size-1.5 shrink-0 rounded-pill bg-ink"
                    />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </Section>
  )
}
