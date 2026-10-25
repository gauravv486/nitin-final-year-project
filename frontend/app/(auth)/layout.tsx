import Link from 'next/link'
import { Wordmark } from '@/components/marketing/wordmark'

const PASSES = [
  { k: 'Exact key', v: 'GSTIN + invoice no. + period' },
  { k: 'Fuzzy supplier', v: 'trigram ≥ 0.75 · ± ₹1 · ± 7 days' },
  { k: 'Residual', v: 'one-sided rows, with a reason' },
]

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
      {/* Form column */}
      <main id="main" className="flex flex-col px-6 py-8 sm:px-10">
        <Link href="/" className="inline-flex w-fit rounded-chip" aria-label="CA-OS home">
          <Wordmark />
        </Link>

        <div className="flex flex-1 items-center py-12">
          <div className="w-full max-w-[26rem]">{children}</div>
        </div>

        <p className="text-xs text-ink-muted">Built in India · {new Date().getFullYear()}</p>
      </main>

      {/* Context column — decorative, so it is hidden rather than stacked on
          mobile. Nothing here is needed to complete the form. */}
      <aside
        aria-hidden
        className="relative hidden flex-col justify-end overflow-hidden bg-accent-wash p-10 lg:flex"
      >
        <div className="grid-field pointer-events-none absolute inset-0 opacity-60" />

        <div className="relative">
          {/* Display-size text on a <p>, so it misses the global h1-h6 wrap
              rule — declare the long-word break here. */}
          <p className="text-display-s max-w-[22ch] font-semibold wrap-anywhere text-ink">
            Every mismatch, found before you file.
          </p>

          <dl className="mt-10 flex flex-col gap-px overflow-hidden rounded-card border border-hairline-strong bg-hairline-strong">
            {PASSES.map((p) => (
              <div key={p.k} className="flex flex-wrap items-baseline gap-x-3 bg-accent-wash px-5 py-3.5">
                <dt className="text-sm font-medium text-ink">{p.k}</dt>
                <dd className="font-mono text-xs text-ink-muted">{p.v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </aside>
    </div>
  )
}
