'use client'

import { useEffect, useRef, useState } from 'react'

export default function CopyButton({ value, label }: { value: string; label: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  const copy = async () => {
    let next: 'copied' | 'failed' = 'copied'
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      next = 'failed'
    }
    setState(next)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setState('idle'), 2000)
  }

  return (
    <button type="button" className="ac-copy" onClick={copy} aria-label={`Copy ${label}`}>
      <span aria-live="polite">{state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : 'Copy'}</span>
    </button>
  )
}
