'use client'

import type { ComponentProps, ReactNode } from 'react'
import { AlertCircle, Inbox, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Query } from '@/lib/use-api'

/**
 * The three states every page used to pretend didn't exist.
 *
 * Order matters: error beats loading (a reload keeps `data` on screen while it
 * re-fetches, and a stale table under a red banner is better than a flash of
 * skeleton), and `empty` is only consulted once data has actually arrived —
 * "no results" and "not loaded yet" look identical otherwise.
 */
export function Async<T>({
  query,
  children,
  empty,
  isEmpty,
  skeleton,
}: {
  query: Query<T>
  children: (data: T) => ReactNode
  empty?: ReactNode
  isEmpty?: (data: T) => boolean
  skeleton?: ReactNode
}) {
  const { data, error, loading } = query

  if (error) return <ErrorState message={error} onRetry={query.reload} />
  if (data === undefined) return <>{loading ? (skeleton ?? <Skeleton />) : null}</>
  if (isEmpty?.(data)) return <>{empty ?? <EmptyState />}</>
  return <>{children(data)}</>
}

export function Skeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2.5" aria-busy aria-live="polite">
      <span className="sr-only">Loading</span>
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="h-11 animate-pulse rounded-control bg-paper-sunken"
          style={{ animationDelay: `${i * 80}ms` }}
        />
      ))}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-card border border-risk/30 bg-risk-wash/50 px-5 py-4"
    >
      <p className="flex items-start gap-2 text-sm text-ink">
        <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0 text-risk" />
        <span>{message}</span>
      </p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <RefreshCw aria-hidden className="size-3.5" />
          Try again
        </Button>
      )}
    </div>
  )
}

export function EmptyState({
  title = 'Nothing here yet',
  hint,
  action,
}: {
  title?: string
  hint?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-card border border-dashed border-hairline-strong px-6 py-12 text-center">
      <Inbox aria-hidden className="size-6 text-ink-faint" />
      <p className="text-sm font-medium text-ink">{title}</p>
      {hint && <p className="max-w-[46ch] text-xs text-ink-muted">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

/** Inline failure message for a write — sits next to the button that failed. */
export function ActionError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="flex items-start gap-1.5 text-xs text-risk">
      <AlertCircle aria-hidden className="mt-px size-3.5 shrink-0" />
      <span>{message}</span>
    </p>
  )
}

/* --- Small form controls the rewired pages need ---------------------------- */

export function Select({ className, ...rest }: ComponentProps<'select'>) {
  return (
    <select
      {...rest}
      className={cn(
        'h-9 min-w-0 rounded-control border border-hairline-strong bg-paper-raised px-2.5',
        'text-sm text-ink hover:border-ink-faint',
        'disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
    />
  )
}

/* --- Table scaffolding ----------------------------------------------------- */

/** Horizontal scroll lives on the wrapper, never on the page — gate 34. */
export function TableWrap({ className, ...rest }: ComponentProps<'div'>) {
  return <div {...rest} className={cn('w-full overflow-x-auto', className)} />
}

export function Th({ className, ...rest }: ComponentProps<'th'>) {
  return (
    <th
      {...rest}
      className={cn(
        'whitespace-nowrap px-4 py-2.5 text-left align-bottom',
        'label text-ink-muted',
        className,
      )}
    />
  )
}

export function Td({ className, ...rest }: ComponentProps<'td'>) {
  return <td {...rest} className={cn('px-4 py-3 align-middle text-sm text-ink-secondary', className)} />
}
