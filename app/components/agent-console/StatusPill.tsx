import type { ReactNode } from 'react'
import type { Tone } from './format'

export default function StatusPill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`ac-pill ac-${tone}`}>{children}</span>
}
