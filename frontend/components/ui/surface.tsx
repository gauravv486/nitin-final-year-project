import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'

/* --- Card ----------------------------------------------------------------- */

type CardTag = 'div' | 'section' | 'article' | 'li'

/**
 * `as` lets a card be a list item or a section without losing the surface.
 * Props are typed against `div` and the element is resolved dynamically —
 * the per-tag ref variance isn't worth a generic here.
 */
export function Card({
  className,
  as: tag = 'div',
  ...rest
}: Omit<ComponentProps<'div'>, 'ref'> & { as?: CardTag }) {
  const As = tag as 'div'
  return (
    <As
      {...rest}
      className={cn('rounded-card border border-hairline bg-paper-raised', className)}
    />
  )
}

export function CardHeader({ className, ...rest }: ComponentProps<'div'>) {
  return (
    <div
      {...rest}
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-5 py-4',
        className,
      )}
    />
  )
}

export function CardTitle({ className, ...rest }: ComponentProps<'h3'>) {
  return <h3 {...rest} className={cn('text-[0.9375rem] font-semibold text-ink', className)} />
}

export function CardBody({ className, ...rest }: ComponentProps<'div'>) {
  return <div {...rest} className={cn('px-5 py-4', className)} />
}

/* --- Badge ---------------------------------------------------------------- */

/* Status colour is reserved for data meaning. These five tones are the only
 * sanctioned mapping — do not introduce a sixth for decoration. */
type Tone = 'neutral' | 'ok' | 'warn' | 'risk' | 'info' | 'accent'

const tones: Record<Tone, string> = {
  neutral: 'bg-paper-sunken text-ink-secondary border-hairline-strong',
  ok: 'bg-ok-wash text-ok border-ok/20',
  warn: 'bg-warn-wash text-warn border-warn/20',
  risk: 'bg-risk-wash text-risk border-risk/20',
  info: 'bg-info-wash text-info border-info/20',
  accent: 'bg-accent-wash text-accent-strong border-accent-strong/20',
}

export function Badge({
  tone = 'neutral',
  className,
  ...rest
}: ComponentProps<'span'> & { tone?: Tone }) {
  return (
    <span
      {...rest}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-chip border px-2 py-0.5',
        'text-xs font-medium nowrap-action',
        tones[tone],
        className,
      )}
    />
  )
}

/* --- Stat tile ------------------------------------------------------------ */

interface StatProps {
  label: string
  /** Pass a string so callers control formatting (and can pass an em-dash). */
  value: string
  /** Short qualifier. Keep it factual — never an invented delta. */
  note?: string
  tone?: Tone
  icon?: ReactNode
}

/* Static map — a template-literal class name would never reach Tailwind's scanner. */
const valueTones: Record<Tone, string> = {
  neutral: 'text-ink',
  ok: 'text-ok',
  warn: 'text-warn',
  risk: 'text-risk',
  info: 'text-info',
  accent: 'text-accent-strong',
}

export function Stat({ label, value, note, tone = 'neutral', icon }: StatProps) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="label">{label}</p>
        {icon && <span className="text-ink-faint">{icon}</span>}
      </div>
      <p className={cn('tnum mt-3 text-3xl font-semibold tracking-tight', valueTones[tone])}>
        {value}
      </p>
      {note && <p className="mt-1 text-xs text-ink-muted">{note}</p>}
    </Card>
  )
}

/* --- Section scaffolding -------------------------------------------------- */

export function Section({
  className,
  ...rest
}: ComponentProps<'section'>) {
  return <section {...rest} className={cn('py-20 sm:py-24 lg:py-28', className)} />
}

/**
 * S2 Hanging section head — heading sits above the content in negative space,
 * no rule, no eyebrow number. Tag-left / heading-right is deliberately avoided:
 * it is the most recognisable templated-editorial tell.
 */
export function SectionHead({
  title,
  lede,
  align = 'left',
}: {
  title: string
  lede?: string
  align?: 'left' | 'center'
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4',
        align === 'center' && 'items-center text-center',
      )}
    >
      <h2 className="text-4xl font-semibold text-ink">{title}</h2>
      {lede && (
        <p
          className={cn(
            'measure text-base text-ink-secondary',
            align === 'center' && 'mx-auto',
          )}
        >
          {lede}
        </p>
      )}
    </div>
  )
}
