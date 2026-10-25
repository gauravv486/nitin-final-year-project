import { ArrowUpRight } from 'lucide-react'
import { ButtonLink } from '@/components/ui/button'

/** Closing CTA on the light blue accent, matching the reference's two actions. */
export function CtaStrip() {
  return (
    <section id="contact" className="shell scroll-mt-16 py-20 sm:py-24">
      <div className="flex flex-col items-start gap-6 rounded-card-lg bg-accent px-7 py-12 sm:px-12 sm:py-16">
        <h2 className="text-display-s max-w-[30ch] font-semibold text-accent-ink">
          Still reconciling by hand on a Sunday?
        </h2>
        <p className="max-w-[54ch] text-base text-accent-ink-muted">
          Set up one client, import a period of GSTR-2B, and look at what the matching
          returns. It takes about ten minutes.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <ButtonLink href="/register" variant="onAccent" size="lg">
            Get started
          </ButtonLink>
          <ButtonLink
            href="/login"
            size="lg"
            className="border border-accent-ink/30 bg-transparent text-accent-ink shadow-none hover:bg-accent-ink/10 [&.is-hover]:bg-accent-ink/10"
          >
            Log in
            <ArrowUpRight aria-hidden className="size-4" />
          </ButtonLink>
        </div>
      </div>
    </section>
  )
}
