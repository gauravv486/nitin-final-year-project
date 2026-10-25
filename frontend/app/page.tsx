import { SiteNav } from '@/components/marketing/site-nav'
import { Hero } from '@/components/marketing/hero'
import { Audience } from '@/components/marketing/audience'
import { Glance } from '@/components/marketing/glance'
import { Modules } from '@/components/marketing/modules'
import { Reconciliation } from '@/components/marketing/reconciliation'
import { Workflow } from '@/components/marketing/workflow'
import { Testimonials } from '@/components/marketing/testimonials'
import { Pricing } from '@/components/marketing/pricing'
import { Faq } from '@/components/marketing/faq'
import { CtaStrip } from '@/components/marketing/cta-strip'
import { SiteFooter } from '@/components/marketing/site-footer'

/**
 * Workbench macrostructure, following the reference page's section skeleton:
 *
 *   nav · hero · audience split · at-a-glance triptych · features ·
 *   deep-dive · how-it-works · testimonials · 4-tier pricing · 8 FAQs ·
 *   closing CTA · five-group footer
 *
 * Three sections are additions, not substitutions: Modules (all sixteen),
 * Reconciliation (the core algorithm) and Workflow. The reference has no
 * equivalent depth there, and a sixteen-module product needs it.
 */
export default function LandingPage() {
  return (
    <>
      <SiteNav />
      <main id="main">
        <Hero />
        <Audience />
        <Glance />
        <Modules />
        <Reconciliation />
        <Workflow />
        <Testimonials />
        <Pricing />
        <Faq />
        <CtaStrip />
      </main>
      <SiteFooter />
    </>
  )
}
