'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, api } from '@/lib/api'

export interface Query<T> {
  data: T | undefined
  error: string | null
  loading: boolean
  /** Re-run the request — call after any mutation that changes this data. */
  reload: () => void
}

/**
 * GET `path` and keep it in state.
 *
 * `path` may be null, which means "not ready yet" (waiting on a client id, a
 * selected period, an authenticated user) and skips the request entirely —
 * without that, every detail panel would fire a request for `/undefined`.
 *
 * Responses are guarded by a sequence number rather than a cancelled flag: when
 * the user changes filter twice quickly, the first response can land after the
 * second, and whoever writes last would win. Only the newest is accepted.
 */
export function useApi<T>(path: string | null): Query<T> {
  const [data, setData] = useState<T | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(path !== null)
  const [nonce, setNonce] = useState(0)
  const seq = useRef(0)

  useEffect(() => {
    if (path === null) {
      setLoading(false)
      return
    }
    const mine = ++seq.current
    setLoading(true)
    setError(null)

    api
      .get<T>(path)
      .then((result) => {
        if (mine !== seq.current) return
        setData(result)
        setLoading(false)
      })
      .catch((caught: unknown) => {
        if (mine !== seq.current) return
        setError(caught instanceof ApiError ? caught.message : 'Something went wrong')
        setLoading(false)
      })
  }, [path, nonce])

  const reload = useCallback(() => setNonce((n) => n + 1), [])
  return { data, error, loading, reload }
}

export interface Action {
  /** Runs `fn`, holding `busy` until it settles. Returns true on success. */
  run: (fn: () => Promise<unknown>) => Promise<boolean>
  busy: boolean
  error: string | null
  clear: () => void
}

/**
 * The write counterpart of `useApi`. Every button that changes something on
 * the server goes through this, so a failed POST shows a message instead of
 * silently doing nothing — which is what the stubbed handlers used to do.
 */
export function useAction(): Action {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
      return true
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Something went wrong')
      return false
    } finally {
      setBusy(false)
    }
  }, [])

  return { run, busy, error, clear: useCallback(() => setError(null), []) }
}
