import { Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ButtonLink } from '@/components/ui/button'
import { Section, SectionHead } from '@/components/ui/surface'

/**
 * Four tiers in the reference's comparison layout: price, billing note,
 * audience line, usage ceiling, then an included/excluded feature list.
 *
 * The figures are provisional — set them in one place here once you have
 * decided. The note under the grid says so on the page rather than letting a
 * reader assume they are final.
 */
interface Row {
  label: string
  /** false = excluded from this tier. A string adds a qualifier line. */
  value: boolean | string
}

interface Tier {
  name: string
  price: string
  period?: string
  billing: string
  blurb: string
  ceiling: string
  featured?: boolean
  cta: string
  rows: Row[]
}

const TIERS: Tier[] = [
  {
    name: 'Starter',
    price: '₹999',
    period: '/month',
    billing: 'Billed monthly',
    blurb: 'For solo practitioners getting started.',
    ceiling: 'Up to 25 active clients',
    cta: 'Get started',
    rows: [
      { label: 'Client & engagement management', value: true },
      { label: 'Compliance calendar & tasks', value: true },
      { label: 'Document storage', value: '5 GB' },
      { label: 'Document extraction (OCR)', value: true },
      { label: 'GSTR-2B reconciliation', value: false },
      { label: 'Income tax & AIS matching', value: false },
      { label: 'Payroll & secretarial', value: false },
      { label: 'AI copilot', value: false },
      { label: 'Team seats', value: '1 seat' },
    ],
  },
  {
    name: 'Growth',
    price: '₹2,499',
    period: '/month',
    billing: 'Billed monthly',
    blurb: 'For growing practices that need reconciliation and AI.',
    ceiling: 'Up to 100 active clients',
    featured: true,
    cta: 'Get started',
    rows: [
      { label: 'Client & engagement management', value: true },
      { label: 'Compliance calendar & tasks', value: true },
      { label: 'Document storage', value: '25 GB' },
      { label: 'Document extraction (OCR)', value: true },
      { label: 'GSTR-2B reconciliation', value: true },
      { label: 'Income tax & AIS matching', value: true },
      { label: 'Payroll & secretarial', value: false },
      { label: 'AI copilot', value: 'Limited: 50 queries/mo' },
      { label: 'Team seats', value: '5 seats' },
    ],
  },
  {
    name: 'Pro',
    price: '₹5,999',
    period: '/month',
    billing: 'Billed monthly',
    blurb: 'For busy firms that need every module and more seats.',
    ceiling: 'Unlimited clients',
    cta: 'Get started',
    rows: [
      { label: 'Client & engagement management', value: true },
      { label: 'Compliance calendar & tasks', value: true },
      { label: 'Document storage', value: '100 GB' },
      { label: 'Document extraction (OCR)', value: true },
      { label: 'GSTR-2B reconciliation', value: true },
      { label: 'Income tax & AIS matching', value: true },
      { label: 'Payroll & secretarial', value: true },
      { label: 'AI copilot', value: 'Full: 500 queries/mo' },
      { label: 'Team seats', value: '15 seats' },
    ],
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    billing: 'Annual agreement',
    blurb: 'For large firms with custom needs and dedicated support.',
    ceiling: 'Unlimited clients',
    cta: 'Talk to us',
    rows: [
      { label: 'Client & engagement management', value: true },
      { label: 'Compliance calendar & tasks', value: true },
      { label: 'Document storage', value: 'Custom storage' },
      { label: 'Document extraction (OCR)', value: true },
      { label: 'GSTR-2B reconciliation', value: true },
      { label: 'Income tax & AIS matching', value: true },
      { label: 'Payroll & secretarial', value: true },
      { label: 'AI copilot', value: 'Full + custom limits' },
      { label: 'Team seats', value: 'Unlimited seats' },
    ],
  },
]

function FeatureRow({ row }: { row: Row }) {
  const excluded = row.value === false
  const qualifier = typeof row.value === 'string' ? row.value : null

  return (
    <li className="flex items-start gap-2.5">
      {excluded ? (
        <X aria-hidden className="mt-0.5 size-4 shrink-0 text-exclude" strokeWidth={2.5} />
      ) : (
        <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-include" strokeWidth={2.5} />
      )}
      <span className="min-w-0">
        <span className={cn('block text-sm', excluded ? 'text-exclude' : 'text-ink')}>
          {row.label}
        </span>
        {qualifier && <span className="block text-xs text-ink-muted">{qualifier}</span>}
      </span>
      <span className="sr-only">{excluded ? 'not included' : 'included'}</span>
    </li>
  )
}

export function Pricing() {
  return (
    <Section id="pricing" className="scroll-mt-16 bg-paper-soft">
      <div className="shell">
        <SectionHead
          title="Choose your plan"
          lede="Select the plan that fits your practice. Switch plans as the practice grows."
          align="center"
        />

        <ul className="mt-12 grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {TIERS.map((t) => (
            <li
              key={t.name}
              className={cn(
                'relative flex h-full flex-col rounded-card-lg bg-paper-raised p-6 text-center',
                t.featured
                  ? 'border-2 border-accent-strong shadow-lg xl:-mt-4 xl:pb-10'
                  : 'border border-hairline',
              )}
            >
              {t.featured && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 nowrap-action rounded-pill bg-tint-lilac px-3 py-1 text-xs font-medium text-ink">
                  Most Popular
                </span>
              )}

              <h3 className="text-2xl font-semibold text-ink">{t.name}</h3>

              <p className="mt-4 flex items-baseline justify-center gap-0.5">
                <span className="text-4xl font-semibold tracking-tight text-ink">{t.price}</span>
                {t.period && <span className="text-sm text-ink-muted">{t.period}</span>}
              </p>
              <p className="mt-1.5 text-xs text-ink-muted">{t.billing}</p>

              <p className="mt-5 text-sm text-ink-secondary">{t.blurb}</p>
              <p className="mt-1 text-xs text-ink-muted">{t.ceiling}</p>

              <ul className="mt-6 flex flex-1 flex-col gap-3 text-left">
                {t.rows.map((r) => (
                  <FeatureRow key={r.label} row={r} />
                ))}
              </ul>

              <ButtonLink
                href="/register"
                variant={t.featured ? 'primary' : 'secondary'}
                size="md"
                className="mt-7 w-full"
              >
                {t.cta}
              </ButtonLink>
            </li>
          ))}
        </ul>

        <p className="mt-6 text-center text-xs text-ink-muted">
          Figures are provisional for this build. The tier boundaries are final; set the
          prices in <code className="font-mono">components/marketing/pricing.tsx</code>.
        </p>
      </div>
    </Section>
  )
}
