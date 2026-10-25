import Link from 'next/link'
import { Wordmark } from './wordmark'

/**
 * Ft3 · Index columns. Knobs: cols = 5 · heading = mono · bullet = none.
 *
 * Hallmark defaults away from the multi-column index footer (gate 43) — kept
 * here at the user's explicit direction to match the reference's five-group
 * footer. Every link below points at a destination that exists; no filler
 * sitemap entries, and no legal pages that would 404.
 */
const GROUPS = [
  {
    heading: 'Practice',
    links: [
      { href: '/dashboard', label: 'Dashboard' },
      { href: '/clients', label: 'Clients' },
      { href: '/onboarding', label: 'Onboarding' },
      { href: '/documents', label: 'Documents' },
      { href: '/bookkeeping', label: 'Bookkeeping' },
      { href: '/collaboration', label: 'Collaboration' },
    ],
  },
  {
    heading: 'Compliance',
    links: [
      { href: '/gst', label: 'GST & reconciliation' },
      { href: '/income-tax', label: 'Income tax & AIS' },
      { href: '/notices', label: 'Notices & litigation' },
      { href: '/payroll', label: 'Payroll & statutory' },
      { href: '/secretarial', label: 'Secretarial (ROC)' },
      { href: '/compliance', label: 'Compliance calendar' },
    ],
  },
  {
    heading: 'Intelligence',
    links: [
      { href: '/copilot', label: 'Copilot' },
      { href: '/risk', label: 'Risk & audit' },
      { href: '/reports', label: 'Reports & export' },
    ],
  },
  {
    heading: 'Administration',
    links: [
      { href: '/security', label: 'Security & access' },
      { href: '/settings', label: 'Settings' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { href: '#features', label: 'Features' },
      { href: '#glance', label: 'About' },
      { href: '#pricing', label: 'Pricing' },
      { href: '#faq', label: 'FAQs' },
      { href: '#contact', label: 'Contact' },
      { href: '/login', label: 'Log in' },
    ],
  },
]

export function SiteFooter() {
  return (
    <footer className="border-t border-hairline bg-paper-soft">
      <div className="shell py-14">
        <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-5">
          {GROUPS.map((g) => (
            <nav key={g.heading} aria-label={g.heading}>
              <p className="label">{g.heading}</p>
              <ul className="mt-4 flex flex-col gap-2.5">
                {g.links.map((l) => (
                  <li key={l.href + l.label}>
                    <Link
                      href={l.href}
                      className="press nowrap-action rounded-chip text-sm text-ink-secondary hover:text-ink"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-5 border-t border-hairline pt-7 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2">
            <Wordmark />
            <p className="text-xs text-ink-muted">Built in India</p>
          </div>
          <p className="text-xs text-ink-muted">
            &copy; {new Date().getFullYear()} CA-OS. Final-year project build.
          </p>
        </div>

        {/* Oversized wordmark closing the page, as the reference does. */}
        <p
          aria-hidden
          className="mt-10 text-center text-[clamp(3rem,13vw,10rem)] leading-none font-semibold tracking-tight text-ink/5 select-none"
        >
          CA&middot;OS
        </p>
      </div>
    </footer>
  )
}
