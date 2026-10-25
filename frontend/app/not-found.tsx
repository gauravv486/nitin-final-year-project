import Link from 'next/link'
import { ButtonLink } from '@/components/ui/button'
import { Wordmark } from '@/components/marketing/wordmark'

export default function NotFound() {
  return (
    <main id="main" className="grid min-h-dvh place-items-center px-6">
      <div className="flex max-w-[44ch] flex-col items-start gap-5">
        <Link href="/" className="rounded-chip" aria-label="CA-OS home">
          <Wordmark />
        </Link>
        <h1 className="text-4xl font-semibold text-ink">That page does not exist</h1>
        <p className="text-base text-ink-secondary">
          The link may be out of date. All sixteen modules are reachable from the
          dashboard sidebar.
        </p>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/dashboard">Go to dashboard</ButtonLink>
          <ButtonLink href="/" variant="secondary">
            Back to home
          </ButtonLink>
        </div>
      </div>
    </main>
  )
}
