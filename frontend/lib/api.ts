/**
 * The one place the frontend talks to FastAPI.
 *
 * Two things here are not boilerplate:
 *
 * 1. Refresh tokens are SINGLE-USE on the backend, and presenting one twice
 *    revokes every session for that user (see `rotate_refresh_token`). Three
 *    components mounting at once and all getting a 401 would fire three
 *    refreshes and sign the user out. So a refresh in flight is shared: the
 *    first 401 starts it, the rest await the same promise.
 *
 * 2. FastAPI serialises Decimal as a JSON *string*, so money and rates arrive
 *    as "81630.00", not 81630. `num()` is the only way amounts should be read.
 */

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1'

const ACCESS_KEY = 'caos.access'
const REFRESH_KEY = 'caos.refresh'

export class ApiError extends Error {
  status: number
  detail: unknown

  constructor(status: number, message: string, detail?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

/* localStorage throws in private mode and is absent during SSR, so every
 * access is guarded. A missing token is "signed out", never a crash. */
export const tokens = {
  access(): string | null {
    try {
      return localStorage.getItem(ACCESS_KEY)
    } catch {
      return null
    }
  },
  refresh(): string | null {
    try {
      return localStorage.getItem(REFRESH_KEY)
    } catch {
      return null
    }
  },
  save(access: string, refresh: string) {
    try {
      localStorage.setItem(ACCESS_KEY, access)
      localStorage.setItem(REFRESH_KEY, refresh)
    } catch {
      /* ignore — the session simply won't survive a reload */
    }
  },
  clear() {
    try {
      localStorage.removeItem(ACCESS_KEY)
      localStorage.removeItem(REFRESH_KEY)
    } catch {
      /* ignore */
    }
  },
}

/** Fires when a refresh fails, so the auth provider can drop to /login. */
type Listener = () => void
const signedOutListeners = new Set<Listener>()
export function onSignedOut(fn: Listener): () => void {
  signedOutListeners.add(fn)
  return () => {
    signedOutListeners.delete(fn)
  }
}

let refreshing: Promise<string | null> | null = null

async function runRefresh(): Promise<string | null> {
  const refresh_token = tokens.refresh()
  if (!refresh_token) return null

  const response = await fetch(`${BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token }),
  })
  if (!response.ok) {
    tokens.clear()
    signedOutListeners.forEach((fn) => fn())
    return null
  }
  const data = (await response.json()) as { access_token: string; refresh_token: string }
  tokens.save(data.access_token, data.refresh_token)
  return data.access_token
}

function refreshOnce(): Promise<string | null> {
  if (!refreshing) {
    refreshing = runRefresh().finally(() => {
      refreshing = null
    })
  }
  return refreshing
}

async function parseError(response: Response): Promise<ApiError> {
  let detail: unknown
  let message = `${response.status} ${response.statusText}`
  try {
    const body = await response.json()
    detail = body?.detail ?? body
    if (typeof detail === 'string') {
      message = detail
    } else if (Array.isArray(detail)) {
      // FastAPI 422: [{loc: [...], msg: "..."}]
      message = detail
        .map((d: { loc?: unknown[]; msg?: string }) =>
          [d.loc?.slice(1).join('.'), d.msg].filter(Boolean).join(': '),
        )
        .join('; ')
    } else if (detail && typeof detail === 'object' && 'message' in detail) {
      message = String((detail as { message: unknown }).message)
    }
  } catch {
    /* non-JSON body — keep the status line */
  }
  return new ApiError(response.status, message, detail)
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<T> {
  const headers = new Headers(init.headers)
  const access = tokens.access()
  if (access) headers.set('Authorization', `Bearer ${access}`)
  if (init.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  let response: Response
  try {
    response = await fetch(`${BASE}${path}`, { ...init, headers })
  } catch {
    // fetch only rejects on a network-level failure, which here almost always
    // means uvicorn isn't running. Say so, rather than "Failed to fetch".
    throw new ApiError(0, 'Cannot reach the API. Is the backend running on port 8000?')
  }

  if (response.status === 401 && retry && tokens.refresh()) {
    const fresh = await refreshOnce()
    if (fresh) return request<T>(path, init, false)
  }

  if (!response.ok) throw await parseError(response)
  if (response.status === 204) return undefined as T

  const type = response.headers.get('content-type') ?? ''
  if (!type.includes('application/json')) return (await response.blob()) as T
  return (await response.json()) as T
}

/** Drops undefined/null/'' so optional filters can be passed straight through. */
export function qs(params: Record<string, string | number | boolean | undefined | null>) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    search.set(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

export const api = {
  get: <T,>(path: string) => request<T>(path),
  post: <T,>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T,>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body === undefined ? undefined : JSON.stringify(body) }),
  put: <T,>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body === undefined ? undefined : JSON.stringify(body) }),
  del: <T,>(path: string) => request<T>(path, { method: 'DELETE' }),
  form: <T,>(path: string, data: FormData) => request<T>(path, { method: 'POST', body: data }),
}

/**
 * Save a protected file to disk.
 *
 * A plain `<a href>` cannot be used: every download endpoint needs the bearer
 * token, and a browser navigation sends no Authorization header. So the bytes
 * are fetched, wrapped in an object URL, and handed to a synthetic click.
 */
export async function download(path: string, fallbackName = 'download') {
  const blob = await request<Blob>(path)
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fallbackName
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  // Revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** Decimals arrive as strings. Never do arithmetic on the raw field. */
export function num(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export { BASE as API_BASE }
