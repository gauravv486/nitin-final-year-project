import { NAV_GROUPS } from '@/lib/nav'
import { Section, SectionHead } from '@/components/ui/surface'

/* One pastel per layer, cycling the studied block fills. */
const LAYER_TONE: Record<string, string> = {
  Practice: 'bg-accent-wash',
  Compliance: 'bg-tint-lilac',
  Intelligence: 'bg-tint-mint',
  Administration: 'bg-tint-blue',
}

/**
 * All sixteen modules, grouped by product layer. Sourced from `lib/nav.ts`, so
 * the marketing page and the application sidebar can never disagree about what
 * exists — the usual failure is a landing page listing a module the app does
 * not have.
 */
export function Modules() {
  return (
    <Section id="features" className="scroll-mt-16">
      <div className="shell">
        <SectionHead
          title="Sixteen modules across five layers"
          lede="Every module below has a screen in the application. They share one client record, so a registration entered at onboarding drives the calendar, the returns and the forms."
        />

        <div className="mt-12 flex flex-col gap-10">
          {NAV_GROUPS.map((group) => (
            <div key={group.layer}>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-hairline pb-3">
                <h3 className="text-2xl font-semibold text-ink">{group.layer}</h3>
                <p className="font-mono text-xs text-ink-muted">
                  {group.items.length} modules
                </p>
              </div>

              <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {group.items.map((item) => (
                  <li
                    key={item.href}
                    className="flex flex-col gap-3 rounded-card border border-hairline bg-paper-raised p-5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span
                        className={`grid size-10 shrink-0 place-items-center rounded-pill ${LAYER_TONE[group.layer]}`}
                      >
                        <item.icon
                          aria-hidden
                          className="size-4.5 text-ink"
                          strokeWidth={1.75}
                        />
                      </span>
                      <span className="font-mono text-xs text-ink-faint">
                        {String(item.module).padStart(2, '0')}
                      </span>
                    </div>

                    <h4 className="text-base font-semibold text-ink">{item.label}</h4>
                    <p className="text-sm text-ink-secondary">{item.description}</p>
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
