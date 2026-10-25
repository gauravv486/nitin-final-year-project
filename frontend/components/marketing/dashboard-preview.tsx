import { ArrowRight, CircleAlert, CircleCheck } from 'lucide-react'
import { inr } from '@/lib/utils'
import { Badge } from '@/components/ui/surface'

/**
 * A real fragment of the product, not a picture of one.
 *
 * Deliberately NOT wrapped in a drawn browser bar / traffic-light dots / phone
 * bezel — invented chrome is the clearest "generated" tell, and the viewer's
 * own browser already supplies the real thing. A hairline figure is enough.
 */
export function DashboardPreview() {
  const rows = [
    { supplier: 'Deepak Steel Suppliers', inv: 'DS/2026/0455', books: 212000, portal: 212000 },
    { supplier: 'Mehta Packaging', inv: 'MP-8891', books: 75000, portal: 78500 },
    { supplier: 'Vector Office Solutions', inv: 'VOS/1120', books: 128000, portal: null },
  ]

  return (
    <figure className="m-0 overflow-hidden rounded-card-lg border border-hairline bg-paper-raised shadow-lg">
      {/* Panel head */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-ink">GSTR-2B reconciliation</p>
          <p className="mt-0.5 text-xs text-ink-muted">Arora Trading · September 2026</p>
        </div>
        <Badge tone="warn">
          <CircleAlert aria-hidden className="size-3.5" />2 to resolve
        </Badge>
      </div>

      {/* Summary strip */}
      <dl className="grid grid-cols-3 divide-x divide-hairline border-b border-hairline">
        {[
          { k: 'Matched', v: '18', tone: 'text-ok' },
          { k: 'Mismatched', v: '2', tone: 'text-warn' },
          { k: 'ITC at risk', v: '₹14.1K', tone: 'text-ink' },
        ].map((s) => (
          /* Tight padding below sm — three columns at 320px with 20px gutters
             clips the rupee figure. */
          <div key={s.k} className="min-w-0 px-3 py-3 sm:px-5 sm:py-3.5">
            <dt className="label">{s.k}</dt>
            <dd className={`tnum mt-1 text-base font-semibold sm:text-lg ${s.tone}`}>{s.v}</dd>
          </div>
        ))}
      </dl>

      {/* Rows */}
      <ul className="divide-y divide-hairline">
        {rows.map((r) => {
          const diff = r.portal === null ? null : r.portal - r.books
          const ok = diff === 0
          return (
            <li key={r.inv} className="flex items-center gap-3 px-5 py-3.5">
              <span className="shrink-0">
                {ok ? (
                  <CircleCheck aria-hidden className="size-4 text-ok" />
                ) : (
                  <CircleAlert aria-hidden className="size-4 text-warn" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">{r.supplier}</span>
                <span className="block truncate font-mono text-xs text-ink-muted">{r.inv}</span>
              </span>
              <span className="tnum shrink-0 text-right text-sm">
                {r.portal === null ? (
                  <span className="text-warn">Not in 2B</span>
                ) : ok ? (
                  <span className="text-ink-muted">{inr(r.books)}</span>
                ) : (
                  <>
                    <span className="block text-ink-muted line-through">{inr(r.books)}</span>
                    <span className="block font-medium text-warn">{inr(r.portal)}</span>
                  </>
                )}
              </span>
            </li>
          )
        })}
      </ul>

      <figcaption className="flex items-center gap-1.5 border-t border-hairline bg-paper-sunken px-5 py-3 text-xs text-ink-muted">
        Sample data shown
        <ArrowRight aria-hidden className="size-3" />
        your figures come from your own books
      </figcaption>
    </figure>
  )
}
