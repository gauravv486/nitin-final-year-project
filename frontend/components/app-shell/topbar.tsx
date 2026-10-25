'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LogOut, Menu, Search, X } from 'lucide-react'
import type { Role } from '@/lib/nav'
import { Button } from '@/components/ui/button'
import { Wordmark } from '@/components/marketing/wordmark'
import { useAuth } from '@/lib/auth'
import { SidebarNav } from './sidebar'

export function Topbar({ role = 'partner' }: { role?: Role }) {
  const [open, setOpen] = useState(false)
  const [term, setTerm] = useState('')
  const { user, logout } = useAuth()
  const router = useRouter()

  return (
    <>
      <header className="sticky top-0 z-40 flex h-(--topbar-h) items-center gap-3 border-b border-hairline bg-paper/85 px-4 backdrop-blur-md sm:px-6">
        <Button
          variant="ghost"
          size="sm"
          className="lg:hidden"
          aria-expanded={open}
          aria-controls="app-nav"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X aria-hidden className="size-5" /> : <Menu aria-hidden className="size-5" />}
          <span className="sr-only">{open ? 'Close navigation' : 'Open navigation'}</span>
        </Button>

        <Link href="/" className="rounded-chip lg:hidden" aria-label="CA-OS home">
          <Wordmark showText={false} />
        </Link>

        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault()
            const q = term.trim()
            if (q) router.push(`/clients?q=${encodeURIComponent(q)}`)
          }}
          className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-pill border border-hairline-strong bg-paper-raised px-3 text-sm text-ink-muted focus-within:border-ink-faint sm:max-w-xs"
        >
          <Search aria-hidden className="size-4 shrink-0" />
          <label htmlFor="global-search" className="sr-only">
            Search clients
          </label>
          <input
            id="global-search"
            type="search"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search clients"
            className="min-w-0 flex-1 bg-transparent text-ink placeholder:text-ink-faint focus:outline-none"
          />
        </form>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {user && (
            <span className="hidden text-right sm:block">
              <span className="block text-xs font-medium leading-tight text-ink">
                {user.full_name}
              </span>
              <span className="block text-[0.6875rem] leading-tight text-ink-muted">
                {user.firm_name ?? user.role}
              </span>
            </span>
          )}
          <Button variant="ghost" size="sm" onClick={() => void logout()}>
            <LogOut aria-hidden className="size-4" />
            <span className="sr-only sm:not-sr-only">Sign out</span>
          </Button>
        </div>
      </header>

      {open && (
        <div
          id="app-nav"
          className="sticky top-(--topbar-h) z-30 border-b border-hairline bg-paper/95 p-3 backdrop-blur-md lg:hidden"
        >
          <SidebarNav role={role} />
        </div>
      )}
    </>
  )
}
