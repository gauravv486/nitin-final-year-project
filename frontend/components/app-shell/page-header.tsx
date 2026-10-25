import type { ReactNode } from 'react'

export function PageHeader({
  title,
  lede,
  actions,
}: {
  title: string
  lede?: string
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 pb-6">
      <div className="min-w-0 flex-1">
        <h1 className="text-3xl font-semibold text-ink">{title}</h1>
        {lede && <p className="measure mt-1.5 text-sm text-ink-secondary">{lede}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
