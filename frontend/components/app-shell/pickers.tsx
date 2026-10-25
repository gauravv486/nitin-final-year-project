'use client'

import { useEffect, useState } from 'react'
import { useApi } from '@/lib/use-api'
import { Select } from '@/components/ui/async'

export interface ClientRef {
  id: string
  name: string
}

interface ClientList {
  data: { id: string; name: string }[]
}

/**
 * Every per-client screen needs the same list, and most need a default
 * selection so the page shows something on arrival rather than an empty
 * dropdown. `selected` is set once, when the list first lands.
 */
export function useClientPicker() {
  const query = useApi<ClientList>('/clients?page_size=100')
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    if (!selected && query.data?.data?.length) setSelected(query.data.data[0].id)
  }, [query.data, selected])

  return {
    clients: query.data?.data ?? [],
    selected,
    setSelected,
    loading: query.loading,
    error: query.error,
  }
}

export function ClientPicker({
  clients,
  value,
  onChange,
  label = 'Client',
}: {
  clients: ClientRef[]
  value: string | null
  onChange: (id: string) => void
  label?: string
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="label shrink-0">{label}</span>
      <Select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={clients.length === 0}
      >
        {clients.length === 0 && <option value="">No clients</option>}
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>
    </label>
  )
}

/** The last 18 months, newest first, as the `YYYY-MM` the API expects. */
export function recentPeriods(count = 18): string[] {
  const now = new Date()
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
}

export function periodLabel(period: string) {
  const [year, month] = period.split('-').map(Number)
  if (!year || !month) return period
  return new Date(year, month - 1, 1).toLocaleDateString('en-IN', {
    month: 'short',
    year: 'numeric',
  })
}

export function PeriodPicker({
  value,
  onChange,
  label = 'Period',
}: {
  value: string
  onChange: (period: string) => void
  label?: string
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="label shrink-0">{label}</span>
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        {recentPeriods().map((p) => (
          <option key={p} value={p}>
            {periodLabel(p)}
          </option>
        ))}
      </Select>
    </label>
  )
}

/** Financial year as the backend writes it: "2026-27" for 1 Apr 26–31 Mar 27. */
export function currentFinancialYear(today = new Date()) {
  const startYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`
}
