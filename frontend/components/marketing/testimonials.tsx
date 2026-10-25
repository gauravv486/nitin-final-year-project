import { Quote } from 'lucide-react'
import { Section, SectionHead } from '@/components/ui/surface'

/**
 * The reference's four-card testimonial grid, reproduced as *labelled empty
 * slots*.
 *
 * Writing four quotes from CA firms that have never used this product would be
 * fabricated proof — the single easiest thing on this page to invent and the
 * one a reviewer is most likely to ask about. The layout is here and ready;
 * drop a real quote, name, firm and city into each slot as you get them.
 */
const SLOTS = [
  { role: 'Partner, mid-size practice', focus: 'on reconciliation time' },
  { role: 'Article assistant', focus: 'on document handover' },
  { role: 'Practice manager', focus: 'on deadline tracking' },
  { role: 'Client (private limited)', focus: 'on the portal experience' },
]

export function Testimonials() {
  return (
    <Section className="bg-paper-soft">
      <div className="shell">
        <SectionHead
          title="What users say"
          lede="Nothing here yet — the product has no users to quote. These four slots are the finished layout, waiting on real feedback."
        />

        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SLOTS.map((s) => (
            <li
              key={s.role}
              className="flex flex-col gap-4 rounded-card border border-dashed border-hairline-strong bg-paper-raised p-6"
            >
              <Quote aria-hidden className="size-5 text-ink-faint" strokeWidth={1.75} />

              {/* Ruled placeholder lines, so the slot reads as deliberate */}
              <div aria-hidden className="flex flex-col gap-2">
                <span className="block h-2.5 w-full rounded-pill bg-paper-sunken" />
                <span className="block h-2.5 w-full rounded-pill bg-paper-sunken" />
                <span className="block h-2.5 w-3/5 rounded-pill bg-paper-sunken" />
              </div>

              <div className="mt-auto flex items-center gap-3 border-t border-hairline pt-4">
                <span
                  aria-hidden
                  className="size-9 shrink-0 rounded-pill bg-paper-sunken"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-ink-muted">
                    Quote to add
                  </span>
                  <span className="block truncate text-xs text-ink-muted">{s.role}</span>
                </span>
              </div>

              <p className="font-mono text-xs text-ink-faint">{s.focus}</p>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  )
}
