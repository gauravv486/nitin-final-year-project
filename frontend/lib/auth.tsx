'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
import { api, onSignedOut, tokens } from '@/lib/api'
import type { Role } from '@/lib/nav'

/** `MeOut` from the backend. `ui_role` collapses the seven firm roles onto the
 * three the sidebar switches on, which is why nav.ts needs no change. */
export interface Me {
  id: string
  firm_id: string
  client_id: string | null
  email: string
  first_name: string
  last_name: string
  full_name: string
  role: string
  ui_role: Role
  status: string
  firm_name: string | null
  last_login_at: string | null
}

interface TokenPair {
  access_token: string
  refresh_token: string
  user: Me
}

interface AuthValue {
  user: Me | null
  /** 'loading' only until the first /auth/me settles — guards must wait for it. */
  status: 'loading' | 'authed' | 'anon'
  login: (email: string, password: string) => Promise<void>
  register: (payload: RegisterPayload) => Promise<void>
  logout: () => Promise<void>
}

export interface RegisterPayload {
  firm_name: string
  email: string
  password: string
  first_name: string
  last_name: string
  phone?: string
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null)
  const [status, setStatus] = useState<'loading' | 'authed' | 'anon'>('loading')
  const router = useRouter()

  // Restore the session on first paint. A stored token may be expired, in which
  // case api.ts refreshes it transparently; if that fails we land on 'anon'.
  useEffect(() => {
    let cancelled = false
    if (!tokens.access()) {
      setStatus('anon')
      return
    }
    api
      .get<Me>('/auth/me')
      .then((me) => {
        if (cancelled) return
        setUser(me)
        setStatus('authed')
      })
      .catch(() => {
        if (cancelled) return
        tokens.clear()
        setStatus('anon')
      })
    return () => {
      cancelled = true
    }
  }, [])

  // A refresh that fails mid-session (revoked family, expired refresh) has to
  // drop the UI to signed-out, not leave it rendering stale data.
  useEffect(
    () =>
      onSignedOut(() => {
        setUser(null)
        setStatus('anon')
      }),
    [],
  )

  const accept = useCallback((pair: TokenPair) => {
    tokens.save(pair.access_token, pair.refresh_token)
    setUser(pair.user)
    setStatus('authed')
  }, [])

  const login = useCallback(
    async (email: string, password: string) => {
      accept(await api.post<TokenPair>('/auth/login', { email, password }))
    },
    [accept],
  )

  const register = useCallback(
    async (payload: RegisterPayload) => {
      accept(await api.post<TokenPair>('/auth/register', payload))
    },
    [accept],
  )

  const logout = useCallback(async () => {
    const refresh_token = tokens.refresh()
    try {
      if (refresh_token) await api.post('/auth/logout', { refresh_token })
    } catch {
      // Logout is idempotent on the backend and the local session must end
      // regardless of what the network did.
    }
    tokens.clear()
    setUser(null)
    setStatus('anon')
    router.replace('/login')
  }, [router])

  const value = useMemo(
    () => ({ user, status, login, register, logout }),
    [user, status, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>')
  return context
}
