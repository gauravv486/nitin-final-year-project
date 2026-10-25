'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { useAuth } from '@/lib/auth'
import { ApiError } from '@/lib/api'

type Status = 'idle' | 'loading' | 'error'

interface Errors {
  email?: string
  password?: string
}

export function LoginForm() {
  const router = useRouter()
  const { login, status: session } = useAuth()
  const [status, setStatus] = useState<Status>('idle')
  const [errors, setErrors] = useState<Errors>({})
  const [failure, setFailure] = useState<string | null>(null)

  // Someone who is already signed in has no business on the login page.
  useEffect(() => {
    if (session === 'authed') router.replace('/dashboard')
  }, [session, router])

  function validate(form: HTMLFormElement): Errors {
    const data = new FormData(form)
    const email = String(data.get('email') ?? '').trim()
    const password = String(data.get('password') ?? '')
    const next: Errors = {}

    // Error copy says what happened, then what to do about it.
    if (!email) next.email = 'Enter the email you registered with.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      next.email = 'That does not look like an email address. Check for a typo.'

    if (!password) next.password = 'Enter your password.'
    else if (password.length < 8)
      next.password = 'Passwords are at least 8 characters. Try the full one.'

    return next
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    const found = validate(e.currentTarget)
    setErrors(found)
    setFailure(null)
    if (Object.keys(found).length > 0) {
      setStatus('error')
      return
    }

    setStatus('loading')
    try {
      await login(String(data.get('email')).trim(), String(data.get('password')))
      router.replace('/dashboard')
    } catch (caught) {
      setStatus('error')
      // The backend returns a byte-identical 401 for a wrong password and an
      // unknown email, deliberately — it will not confirm whether an address is
      // registered. The message here must not leak more than the API does.
      setFailure(
        caught instanceof ApiError && caught.status === 401
          ? 'Those credentials were not accepted. Check the email and password and try again.'
          : caught instanceof ApiError
            ? caught.message
            : 'Something went wrong. Try again.',
      )
    }
  }

  return (
    <>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <Field
          label="Work email"
          state={errors.email ? 'error' : 'idle'}
          message={errors.email}
        >
          {(a) => (
            <Input
              {...a}
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@firm.in"
              state={errors.email ? 'error' : 'idle'}
            />
          )}
        </Field>

        <Field
          label="Password"
          state={errors.password ? 'error' : 'idle'}
          message={errors.password}
        >
          {(a) => (
            <Input
              {...a}
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              state={errors.password ? 'error' : 'idle'}
            />
          )}
        </Field>

        <div className="flex items-center justify-between gap-4">
          <label className="flex items-center gap-2 text-sm text-ink-secondary">
            <input
              type="checkbox"
              name="remember"
              className="size-4 rounded-sm border-hairline-strong accent-accent-strong"
            />
            Keep me signed in
          </label>
          <button
            type="button"
            className="nowrap-action rounded-chip text-sm text-ink-muted hover:text-ink"
          >
            Forgot password?
          </button>
        </div>

        {failure && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-control border border-risk/30 bg-risk-wash/50 px-3.5 py-3 text-sm text-ink"
          >
            <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0 text-risk" />
            <span>{failure}</span>
          </p>
        )}

        <Button
          type="submit"
          size="lg"
          state={status === 'loading' ? 'loading' : 'idle'}
          className="w-full"
        >
          {status === 'loading' ? 'Signing in' : 'Log in'}
        </Button>
      </form>
    </>
  )
}
