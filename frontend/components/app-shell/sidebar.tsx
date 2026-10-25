'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { navForRole, type Role } from '@/lib/nav'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth'
import { Wordmark } from '@/components/marketing/wordmark'

export function SidebarNav({ role = 'partner' }: { role?: Role }) {
  const pathname = usePathname()
  const groups = navForRole(role)

  return (
    <nav aria-label="Modules" className="flex flex-col gap-5">
      {groups.map((group) => (
        <div key={group.layer} className="flex flex-col gap-1">
          <p className="label px-3 pb-1">{group.layer}</p>

          {group.items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                title={item.description}
                className={cn(
                  'press flex min-h-10 items-center gap-2.5 rounded-pill px-3 py-2',
                  'nowrap-action text-sm',
                  // The ring, like the primary button's, keeps a 1.29:1 fill
                  // from dissolving into the paper behind it — "which page am
                  // I on" has to be answerable at a glance.
                  active
                    ? 'bg-accent font-medium text-accent-ink ring-1 ring-accent-strong/35'
                    : 'text-ink-secondary hover:bg-accent-wash hover:text-ink',
                )}
              >
                <item.icon
                  aria-hidden
                  strokeWidth={1.75}
                  className={cn('size-4 shrink-0', active ? 'text-accent-ink' : 'text-ink-faint')}
                />
                <span className="truncate">{item.label}</span>
              </Link>
            )
          })}
        </div>
      ))}
    </nav>
  )
}

/** Initials from the real name — two letters, or one for a single-word name. */
function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '??'
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

function SignedInAs() {
  const { user } = useAuth()
  if (!user) return null
  return (
    <div className="flex items-center gap-2.5 px-2 py-1.5">
      <span
        aria-hidden
        className="grid size-8 shrink-0 place-items-center rounded-pill bg-tint-lilac text-sm font-medium text-ink"
      >
        {initials(user.full_name)}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-ink">{user.full_name}</span>
        <span className="block truncate text-xs capitalize text-ink-muted">
          {user.role.toLowerCase().replace(/_/g, ' ')}
        </span>
      </span>
    </div>
  )
}

export function Sidebar({ role = 'partner' }: { role?: Role }) {
  return (
    <aside className="sticky top-0 hidden h-dvh shrink-0 border-r border-hairline bg-paper lg:flex lg:w-(--sidebar-w) lg:flex-col">
      <div className="flex h-(--topbar-h) shrink-0 items-center px-4">
        <Link href="/" className="rounded-chip" aria-label="CA-OS home">
          <Wordmark />
        </Link>
      </div>

      <div className="scroll-slim min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        <SidebarNav role={role} />
      </div>

      <div className="shrink-0 border-t border-hairline p-3">
        <SignedInAs />
      </div>
    </aside>
  )
}
