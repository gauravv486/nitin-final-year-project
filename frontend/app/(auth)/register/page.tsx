import type { Metadata } from 'next'
import Link from 'next/link'
import { RegisterForm } from './register-form'

export const metadata: Metadata = { title: 'Create account' }

export default function RegisterPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-ink">Create a firm account</h1>
        <p className="text-sm text-ink-secondary">
          Already set up?{' '}
          <Link
            href="/login"
            className="font-medium text-accent-strong underline decoration-accent-strong/40 underline-offset-4 hover:decoration-accent-strong"
          >
            Log in
          </Link>
        </p>
      </div>

      <RegisterForm />
    </div>
  )
}
