import { ArrowUpRight } from 'lucide-react'
import { ButtonLink } from '@/components/ui/button'
import { DashboardPreview } from './dashboard-preview'
import { HeroIllustration } from './hero-illustration'

/* Statutory ground covered. Factual scope — a customer-logo wall would need
 * real customers, and inventing them is the one thing that would not survive
 * a reviewer asking "which firms?" */
const COVERAGE = ['GST', 'Income tax', 'TDS', 'PF & ESI', 'ROC / MCA', 'Payroll']

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden">
      <div aria-hidden className="grid-field pointer-events-none absolute inset-0 -z-10" />

      <div className="shell pt-12 pb-24 lg:pt-16 lg:pb-36">
        {/* Row 1 — copy + illustration */}
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.92fr)] lg:gap-14">
          <div className="flex flex-col items-start gap-6">
            <p className="inline-flex items-center gap-2 rounded-pill border border-hairline-strong bg-paper-raised px-3 py-1 text-xs text-ink-secondary">
              <span className="size-1.5 rounded-pill bg-accent-strong" aria-hidden />
              Built for Indian practice, not adapted to it
            </p>

            <h1 className="text-display font-semibold text-ink">
              One workspace for the whole practice.
            </h1>

            <p className="measure text-xl text-ink-secondary">
              CA-OS brings practice management, GST and income-tax compliance, payroll,
              secretarial filings and an AI layer over your own ledger into a single
              system — sixteen modules that share one client record.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <ButtonLink href="/register" size="lg">
                Get started
              </ButtonLink>
              <ButtonLink href="#contact" variant="secondary" size="lg">
                Book a demo
                <ArrowUpRight aria-hidden className="size-4" />
              </ButtonLink>
            </div>

            <div className="mt-1 flex flex-col gap-2.5">
              <p className="label">Covers</p>
              <ul className="flex flex-wrap items-center gap-2">
                {COVERAGE.map((item) => (
                  <li
                    key={item}
                    className="nowrap-action rounded-pill bg-accent-wash px-3 py-1 text-xs font-medium text-ink-secondary"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="w-full min-w-0">
            <HeroIllustration className="h-auto w-full" />
          </div>
        </div>

        {/* Row 2 — the product itself */}
        <div className="mt-14 w-full min-w-0 lg:mt-20">
          <DashboardPreview />
        </div>
      </div>
    </section>
  )
}
