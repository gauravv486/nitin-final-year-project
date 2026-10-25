'use client'

import { type ComponentProps, type ReactNode, useId } from 'react'
import { AlertCircle, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

type FieldState = 'idle' | 'error' | 'success'

interface FieldProps {
  label: string
  hint?: string
  /** Rendered beneath the control; announced to assistive tech. */
  message?: string
  state?: FieldState
  children: (props: {
    id: string
    'aria-describedby': string | undefined
    'aria-invalid': boolean | undefined
  }) => ReactNode
}

/**
 * Label + control + message, wired for screen readers.
 *
 * Error copy follows the house rule: say what happened, then what to do.
 * "GSTIN must be 15 characters. Check for a missing digit." — not "Invalid input."
 */
export function Field({ label, hint, message, state = 'idle', children }: FieldProps) {
  const id = useId()
  const messageId = message ? `${id}-msg` : undefined
  const hintId = hint ? `${id}-hint` : undefined
  const describedBy = [hintId, messageId].filter(Boolean).join(' ') || undefined

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>

      {hint && (
        <p id={hintId} className="text-xs text-ink-muted">
          {hint}
        </p>
      )}

      {children({
        id,
        'aria-describedby': describedBy,
        'aria-invalid': state === 'error' || undefined,
      })}

      {/* The slot is always rendered and reserves one line of height, so an
          error appearing does not shove the rest of the form downward. */}
      <p
        id={messageId}
        role={state === 'error' ? 'alert' : undefined}
        className={cn(
          'flex min-h-5 items-start gap-1.5 text-xs',
          state === 'error' && 'text-risk',
          state === 'success' && 'text-ok',
          state === 'idle' && 'text-ink-muted',
        )}
      >
        {message && (
          <>
            {state === 'error' && <AlertCircle aria-hidden className="mt-px size-3.5 shrink-0" />}
            {state === 'success' && <Check aria-hidden className="mt-px size-3.5 shrink-0" />}
            <span>{message}</span>
          </>
        )}
      </p>
    </div>
  )
}

interface InputProps extends Omit<ComponentProps<'input'>, 'className'> {
  state?: FieldState
  className?: string
}

export function Input({ state = 'idle', className, ...rest }: InputProps) {
  return (
    <input
      {...rest}
      className={cn(
        'h-11 w-full min-w-0 rounded-control border bg-paper-raised px-3.5',
        'text-[0.9375rem] text-ink placeholder:text-ink-faint',
        'transition-[border-color,background-color,box-shadow] duration-150 ease-out',
        'hover:border-ink-faint',
        'disabled:cursor-not-allowed disabled:bg-paper-sunken disabled:opacity-60',
        'read-only:bg-paper-sunken',
        state === 'idle' && 'border-hairline-strong',
        state === 'error' && 'border-risk bg-risk-wash/40',
        state === 'success' && 'border-ok',
        className,
      )}
    />
  )
}

export function Textarea({
  state = 'idle',
  className,
  ...rest
}: Omit<ComponentProps<'textarea'>, 'className'> & { state?: FieldState; className?: string }) {
  return (
    <textarea
      {...rest}
      className={cn(
        'w-full min-w-0 resize-y rounded-control border bg-paper-raised px-3.5 py-2.5',
        'text-[0.9375rem] text-ink placeholder:text-ink-faint',
        'transition-[border-color,background-color] duration-150 ease-out',
        'hover:border-ink-faint',
        'disabled:cursor-not-allowed disabled:bg-paper-sunken disabled:opacity-60',
        state === 'idle' && 'border-hairline-strong',
        state === 'error' && 'border-risk bg-risk-wash/40',
        state === 'success' && 'border-ok',
        className,
      )}
    />
  )
}
