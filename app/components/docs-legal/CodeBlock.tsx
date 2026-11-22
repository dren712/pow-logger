'use client'

import { useEffect, useRef, useState } from 'react'

export default function CodeBlock({ code, label }: { code: string; label: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
      setState('copied')
    } catch {
      setState('failed')
    }
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setState('idle'), 2000)
  }

  return (
    <div className="dl-code">
      <div className="dl-code-head">
        <span>{label}</span>
        <button type="button" className="dl-copy no-print" onClick={copy} aria-label={`Copy ${label} code`}>
          <span aria-live="polite">{state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : 'Copy'}</span>
        </button>
      </div>
      <pre tabIndex={0}><code>{code}</code></pre>
    </div>
  )
}
