import { Children, type ComponentProps, type ReactNode } from 'react'
import Link from 'next/link'
import { AlertCircle, Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'onAccent'
type Size = 'sm' | 'md' | 'lg'
type State = 'idle' | 'loading' | 'error' | 'success'

const base = [
  'press inline-flex items-center justify-center gap-2',
  'font-medium nowrap-action select-none',
  // 44px min hit target on touch, per WCAG 2.5.5
  'min-h-11 sm:min-h-0',
  'disabled:cursor-not-allowed disabled:opacity-45',
].join(' ')

const variants: Record<Variant, string> = {
  /* The hairline is load-bearing, not decoration: a light blue fill is only
   * 1.29:1 against paper, so without it the primary and secondary buttons are
   * two pale pills of the same apparent weight. */
  primary: cn(
    'bg-accent text-accent-ink border border-accent-strong/35 shadow-sm',
    'hover:bg-accent-pressed hover:border-accent-strong/55 [&.is-hover]:bg-accent-pressed',
    'active:bg-accent-pressed [&.is-active]:bg-accent-pressed',
  ),
  secondary: cn(
    'bg-paper-raised text-ink border border-hairline-strong shadow-sm',
    'hover:bg-paper-sunken hover:border-ink-faint [&.is-hover]:bg-paper-sunken',
    'active:bg-paper-sunken [&.is-active]:bg-paper-sunken',
  ),
  ghost: cn(
    'bg-transparent text-ink-secondary',
    'hover:bg-paper-sunken hover:text-ink [&.is-hover]:bg-paper-sunken',
    'active:bg-paper-sunken [&.is-active]:bg-paper-sunken',
  ),
  danger: cn(
    'bg-risk text-paper shadow-sm',
    'hover:brightness-110 [&.is-hover]:brightness-110',
    'active:brightness-95 [&.is-active]:brightness-95',
  ),
  /* For a button sitting ON the light blue accent fill — blue-on-blue would
   * vanish, so this takes a white fill with the ink-weight blue as text. */
  onAccent: cn(
    'bg-paper-raised text-accent-strong shadow-sm',
    'hover:bg-paper-sunken [&.is-hover]:bg-paper-sunken',
    'active:bg-paper-sunken [&.is-active]:bg-paper-sunken',
  ),
}

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-[0.8125rem] rounded-control',
  md: 'h-11 px-5 text-[0.9375rem] rounded-pill',
  lg: 'h-12 px-6 text-base rounded-pill',
}

const stateRing: Record<State, string> = {
  idle: '',
  loading: 'cursor-progress',
  error: 'ring-2 ring-risk ring-offset-2 ring-offset-paper',
  success: 'ring-2 ring-ok ring-offset-2 ring-offset-paper',
}

interface CommonProps {
  variant?: Variant
  size?: Size
  state?: State
  children: ReactNode
  className?: string
}

function Inner({ state, children }: { state: State; children: ReactNode }) {
  if (state === 'loading')
    return (
      <>
        <Loader2 aria-hidden className="size-4 animate-spin" />
        <span>{children}</span>
      </>
    )
  if (state === 'error')
    return (
      <>
        <AlertCircle aria-hidden className="size-4" />
        <span>{children}</span>
      </>
    )
  if (state === 'success')
    return (
      <>
        <Check aria-hidden className="size-4" />
        <span>{children}</span>
      </>
    )
  return <>{Children.toArray(children)}</>
}

export function Button({
  variant = 'primary',
  size = 'md',
  state = 'idle',
  className,
  children,
  ...rest
}: CommonProps & Omit<ComponentProps<'button'>, 'children' | 'className'>) {
  return (
    <button
      {...rest}
      aria-busy={state === 'loading' || undefined}
      disabled={rest.disabled ?? state === 'loading'}
      className={cn(base, variants[variant], sizes[size], stateRing[state], className)}
    >
      <Inner state={state}>{children}</Inner>
    </button>
  )
}

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...rest
}: CommonProps & Omit<ComponentProps<typeof Link>, 'children' | 'className'>) {
  return (
    <Link
      {...rest}
      className={cn(base, variants[variant], sizes[size], className)}
    >
      {children}
    </Link>
  )
}
