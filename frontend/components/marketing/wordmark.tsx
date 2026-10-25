import { cn } from '@/lib/utils'

/**
 * Typographic wordmark plus a small built mark — three ledger rules, the
 * shortest honest glyph for reconciliation. Tier-A (inline SVG, no asset).
 */
export function Wordmark({
  className,
  showText = true,
}: {
  className?: string
  showText?: boolean
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <svg
        viewBox="0 0 24 24"
        aria-hidden
        className="size-6 shrink-0"
        fill="none"
      >
        <rect width="24" height="24" rx="7" fill="var(--accent)" />
        <path
          d="M6.5 8.75h11M6.5 12h11M6.5 15.25h6.5"
          stroke="var(--accent-ink)"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
      {showText && (
        <span className="text-[0.9375rem] font-semibold tracking-tight text-ink">
          CA<span className="text-accent-strong">·</span>OS
        </span>
      )}
    </span>
  )
}
