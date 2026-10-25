'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import { MARKETING_LINKS } from '@/lib/nav'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth'
import { Button, ButtonLink } from '@/components/ui/button'
import { Wordmark } from './wordmark'

/**
 * N1b · Canonical SaaS three-section.
 * Knobs: centre links = 4 · dropdowns = none · scroll = frost-on-scroll.
 *
 * Frosts rather than switching colour, so the hairline stays continuous with
 * the page beneath it.
 */
export function SiteNav() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const { status } = useAuth()
  const signedIn = status === 'authed'

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Close the mobile panel when the viewport grows past the breakpoint.
  useEffect(() => {
    if (!open) return
    const mq = window.matchMedia('(min-width: 768px)')
    const close = () => setOpen(false)
    mq.addEventListener('change', close)
    return () => mq.removeEventListener('change', close)
  }, [open])

  return (
    <header
      className={cn(
        'sticky top-0 z-50 border-b transition-colors duration-200 ease-out',
        scrolled
          ? 'border-hairline bg-paper/80 backdrop-blur-md backdrop-saturate-150'
          : 'border-transparent bg-transparent',
      )}
    >
      <nav className="shell flex h-16 items-center gap-6" aria-label="Main">
        <Link href="/" className="rounded-chip" aria-label="CA-OS home">
          <Wordmark />
        </Link>

        <ul className="mx-auto hidden items-center gap-1 md:flex">
          {MARKETING_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className={cn(
                  'press nowrap-action block rounded-pill px-3.5 py-2 text-sm',
                  'text-ink-secondary hover:bg-paper-sunken hover:text-ink',
                )}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        {/* Log in takes the lilac pill, Get started the blue one — as the
            reference pairs them. Signed in, both collapse to one way back. */}
        <div className="ml-auto hidden items-center gap-2 md:flex">
          {signedIn ? (
            <ButtonLink href="/dashboard" variant="primary" size="sm">
              Open dashboard
            </ButtonLink>
          ) : (
            <>
              <ButtonLink
                href="/login"
                variant="secondary"
                size="sm"
                className="border-transparent bg-tint-lilac text-ink hover:bg-tint-lilac/70 [&.is-hover]:bg-tint-lilac/70"
              >
                Log in
              </ButtonLink>
              <ButtonLink href="/register" variant="primary" size="sm">
                Get started
              </ButtonLink>
            </>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="ml-auto md:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X aria-hidden className="size-5" /> : <Menu aria-hidden className="size-5" />}
          <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
        </Button>
      </nav>

      {open && (
        <div
          id="mobile-nav"
          className="border-t border-hairline bg-paper/95 backdrop-blur-md md:hidden"
        >
          <ul className="shell flex flex-col py-2">
            {MARKETING_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="nowrap-action flex min-h-11 items-center rounded-chip px-1 text-base text-ink-secondary"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="shell flex flex-col gap-2 pb-4">
            {signedIn ? (
              <ButtonLink href="/dashboard" variant="primary" size="md" className="w-full">
                Open dashboard
              </ButtonLink>
            ) : (
              <>
                <ButtonLink href="/login" variant="secondary" size="md" className="w-full">
                  Log in
                </ButtonLink>
                <ButtonLink href="/register" variant="primary" size="md" className="w-full">
                  Get started
                </ButtonLink>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
