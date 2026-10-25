import type { Metadata } from 'next'
import Link from 'next/link'
import { LoginForm } from './login-form'

export const metadata: Metadata = { title: 'Log in' }

export default function LoginPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-ink">Log in</h1>
        <p className="text-sm text-ink-secondary">
          New here?{' '}
          <Link
            href="/register"
            className="font-medium text-accent-strong underline decoration-accent-strong/40 underline-offset-4 hover:decoration-accent-strong"
          >
            Create a firm account
          </Link>
        </p>
      </div>

      <LoginForm />
    </div>
  )
}
