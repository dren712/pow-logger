import type { AgentEvent } from '../../lib/agent/types'

export type Tone = 'ok' | 'bad' | 'warn' | 'neutral'

export function shortHash(value: string, head = 10, tail = 6): string {
  if (!value) return ''
  return value.length <= head + tail + 1 ? value : `${value.slice(0, head)}…${value.slice(-tail)}`
}

export function seq(n: number): string {
  return `#${String(n).padStart(2, '0')}`
}

const DATE_FORMAT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC',
})

/** Fixed locale and time zone so server and client render the same text. */
export function formatUtc(iso: string | null | undefined): string {
  if (!iso) return 'Unknown'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? 'Unknown' : `${DATE_FORMAT.format(d)} UTC`
}

export function eventSummary(ev: AgentEvent): string {
  const p = ev.payload
  return String(
    p?.path || p?.tool || p?.command || p?.commitHash || p?.summary || p?.operation || p?.taskDescription || 'No description',
  )
}

export function sentenceCase(value: string): string {
  const s = value.replace(/_/g, ' ').toLowerCase()
  return s.charAt(0).toUpperCase() + s.slice(1)
}
