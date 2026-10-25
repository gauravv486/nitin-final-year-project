'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { useAuth } from '@/lib/auth'
import { ApiError } from '@/lib/api'

type Errors = Partial<Record<'firm' | 'name' | 'email' | 'password', string>>

export function RegisterForm() {
  const router = useRouter()
  const { register } = useAuth()
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  const [failure, setFailure] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    const firm = String(data.get('firm') ?? '').trim()
    const name = String(data.get('name') ?? '').trim()
    const email = String(data.get('email') ?? '').trim()
    const password = String(data.get('password') ?? '')

    const next: Errors = {}
    if (!firm) next.firm = 'Enter the name your practice trades under.'
    if (!name) next.name = 'Enter your full name.'
    if (!email) next.email = 'Enter a work email address.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      next.email = 'That does not look like an email address. Check for a typo.'
    if (password.length < 8)
      next.password = 'Use at least 8 characters. A short phrase works well.'

    setErrors(next)
    setFailure(null)
    if (Object.keys(next).length > 0) return

    // The API wants the name in two parts. Everything after the first space is
    // the surname, so "Ramesh Kumar Iyer" keeps "Kumar Iyer" together rather
    // than dropping the middle name.
    const [first_name, ...rest] = name.split(/\s+/)

    setLoading(true)
    try {
      await register({
        firm_name: firm,
        email,
        password,
        first_name,
        last_name: rest.join(' ') || first_name,
      })
      router.replace('/dashboard')
    } catch (caught) {
      setFailure(
        caught instanceof ApiError
          ? caught.message
          : 'Could not create the account. Try again.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <Field label="Firm name" state={errors.firm ? 'error' : 'idle'} message={errors.firm}>
          {(a) => (
            <Input
              {...a}
              name="firm"
              autoComplete="organization"
              placeholder="Iyer & Associates"
              state={errors.firm ? 'error' : 'idle'}
            />
          )}
        </Field>

        <Field label="Your name" state={errors.name ? 'error' : 'idle'} message={errors.name}>
          {(a) => (
            <Input
              {...a}
              name="name"
              autoComplete="name"
              placeholder="Ramesh Iyer"
              state={errors.name ? 'error' : 'idle'}
            />
          )}
        </Field>

        <Field label="Work email" state={errors.email ? 'error' : 'idle'} message={errors.email}>
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
          hint="At least 8 characters."
          state={errors.password ? 'error' : 'idle'}
          message={errors.password}
        >
          {(a) => (
            <Input
              {...a}
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              state={errors.password ? 'error' : 'idle'}
            />
          )}
        </Field>

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
          state={loading ? 'loading' : 'idle'}
          className="w-full"
        >
          {loading ? 'Creating account' : 'Create account'}
        </Button>

        <p className="text-xs text-ink-muted">
          You will be the first partner on this workspace and can invite staff afterwards.
        </p>
      </form>
    </>
  )
}
