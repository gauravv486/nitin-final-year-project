'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/app-shell/sidebar'
import { Topbar } from '@/components/app-shell/topbar'
import { Skeleton } from '@/components/ui/async'
import { useAuth } from '@/lib/auth'

/**
 * Application shell and the signed-in gate.
 *
 * `role` is no longer hard-coded: it comes from the user's `ui_role`, which the
 * backend derives from their firm role. The server still enforces access —
 * this only decides what the sidebar offers, because hiding a link is not
 * security and every endpoint re-checks the caller anyway.
 *
 * The redirect waits for `status` to leave 'loading'. Firing it earlier would
 * bounce a signed-in user to /login on every hard refresh, before the stored
 * token has been exchanged for a session.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, status } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (status === 'anon') router.replace('/login')
  }, [status, router])

  if (status !== 'authed' || !user) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
        <Skeleton rows={3} />
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh">
      <Sidebar role={user.ui_role} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar role={user.ui_role} />
        <main id="main" className="min-w-0 flex-1 px-4 py-6 sm:px-6 sm:py-8">
          {children}
        </main>
      </div>
    </div>
  )
}
