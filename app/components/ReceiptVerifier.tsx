'use client'

import React, { useCallback, useEffect, useState } from 'react'
import StatusPill from './agent-console/StatusPill'
import { shortHash, type Tone } from './agent-console/format'
import { verifyProvnVerifyReceipt, type CheckStatus, type ProvnVerifyReport } from '@/app/lib/agent/mandate'
import type { AgentReceipt } from '@/app/lib/agent/types'

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const CHECKS: { key: keyof ProvnVerifyReport['checks']; label: string; detail: string }[] = [
  { key: 'signatures', label: 'Agent signatures', detail: 'Every event carries a valid Ed25519 signature from the agent key.' },
  { key: 'eventHashes', label: 'Event and payload hashes', detail: 'Each event hash is recomputed from its canonical payload.' },
  { key: 'hashChain', label: 'Hash chain', detail: 'Each event commits to the one before it; nothing was removed or reordered.' },
  { key: 'merkleRoot', label: 'Merkle root', detail: 'The batch root is rebuilt from the event hashes and matches the receipt.' },
  { key: 'mandate', label: 'Mandate', detail: 'Every recorded decision is replayed against the signed mandate and spend so far.' },
  { key: 'evidence', label: 'Evidence hashes', detail: 'Each result binds the mandate, the signed request and the outcome.' },
]

function tone(s: CheckStatus): Tone {
  return s === 'pass' ? 'ok' : s === 'fail' ? 'bad' : 'neutral'
}
function label(s: CheckStatus): string {
  return s === 'pass' ? 'Pass' : s === 'fail' ? 'Fail' : 'Not in receipt'
}

function tamper(json: string): string {
  const r = JSON.parse(json) as AgentReceipt
  const started = r.events.find((e) => e.eventType === 'agent.started')
  const pv = (started?.payload as { metadata?: { provnVerify?: { mandate: { spendLimit: { amount: string } } } } })?.metadata?.provnVerify
  if (pv) pv.mandate.spendLimit.amount = '5000.00'
  return JSON.stringify(r, null, 2)
}

export default function ReceiptVerifier({ sampleJson, initialId }: { sampleJson: string; initialId?: string }) {
  const [input, setInput] = useState('')
  const [report, setReport] = useState<ProvnVerifyReport | null>(null)
  const [receipt, setReceipt] = useState<AgentReceipt | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [source, setSource] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const verifyJson = useCallback((json: string, from: string) => {
    let parsed: AgentReceipt
    try {
      parsed = JSON.parse(json)
    } catch {
      setError('That is not valid JSON. Paste a full receipt, or a receipt ID.')
      setReport(null)
      return
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      setError('A receipt is a JSON object with execution, events and merkle fields.')
      setReport(null)
      return
    }
    setError(null)
    setReceipt(parsed)
    setReport(verifyProvnVerifyReceipt(parsed))
    setSource(from)
  }, [])

  const verifyId = useCallback(async (id: string) => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/agent/receipt/${encodeURIComponent(id)}`)
      const body = await res.json().catch(() => null)
      if (!res.ok || !body) {
        setReport(null)
        setError(res.status === 404 ? `No receipt found for ${id}.` : `The receipt could not be loaded (HTTP ${res.status}).`)
        return
      }
      // Only the receipt is fetched from PROVN; every check below runs in this browser.
      const json = JSON.stringify(body, null, 2)
      setInput(json)
      verifyJson(json, `Fetched from /api/agent/receipt/${id}, verified in your browser`)
    } catch {
      setError('The receipt could not be loaded. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }, [verifyJson])

  useEffect(() => {
    if (initialId && ID_PATTERN.test(initialId)) {
      setInput(initialId)
      void verifyId(initialId)
    }
  }, [initialId, verifyId])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const value = input.trim()
    if (!value) return setError('Paste a receipt JSON or a receipt ID first.')
    if (ID_PATTERN.test(value)) return void verifyId(value)
    verifyJson(value, 'Pasted receipt, verified in your browser')
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={submit} className="pv-card flex flex-col gap-4 p-5" aria-label="Verify a receipt">
        <label htmlFor="pv-receipt" className="text-[15px] font-semibold text-white">
          Receipt JSON or receipt ID
        </label>
        <textarea
          id="pv-receipt"
          className="pv-input pv-mono min-h-[180px] text-[12.5px] leading-relaxed"
          style={{ paddingLeft: 14 }}
          spellCheck={false}
          placeholder='{"protocol":"PROVN","version":"agent/1", ...}  or  3f2b8c1e-…'
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" className="pv-btn" disabled={busy}>{busy ? 'Loading…' : 'Verify'}</button>
          <button type="button" className="pv-btn-ghost" onClick={() => { setInput(sampleJson); verifyJson(sampleJson, 'Sample receipt, verified in your browser') }}>
            Load the $500 mandate sample
          </button>
          <button type="button" className="pv-btn-ghost" onClick={() => { const t = tamper(sampleJson); setInput(t); verifyJson(t, 'Tampered sample (limit raised to $5,000), verified in your browser') }}>
            Load a tampered sample
          </button>
        </div>
        <p className="pv-faint text-[12.5px] leading-relaxed">
          Checks run in this browser with SHA-256 and Ed25519. A pasted receipt never leaves the page; an ID only fetches the receipt.
        </p>
      </form>

      {error ? <div className="ac-notice ac-notice-bad" role="alert">{error}</div> : null}

      {report && receipt ? (
        <section aria-labelledby="pv-result" aria-live="polite" className="flex flex-col gap-4">
          <div className={`ac-notice ${report.verified ? 'ac-notice-info' : 'ac-notice-bad'}`}>
            <h2 id="pv-result" className="text-[17px] font-semibold text-white">
              {report.verified ? 'Receipt verified' : 'Receipt failed verification'}
            </h2>
            <p className="mt-1">{source}.</p>
          </div>

          <ul className="grid gap-3 sm:grid-cols-2">
            {CHECKS.map((c) => (
              <li key={c.key} className="pv-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-[14.5px] font-semibold text-white">{c.label}</h3>
                  <StatusPill tone={tone(report.checks[c.key])}>{label(report.checks[c.key])}</StatusPill>
                </div>
                <p className="pv-muted mt-1.5 text-[13px] leading-relaxed">{c.detail}</p>
              </li>
            ))}
          </ul>

          {report.mandate ? (
            <div className="pv-card p-5">
              <h3 className="text-[15px] font-semibold text-white">Mandate</h3>
              <dl className="mt-3 grid gap-x-6 gap-y-2 text-[13.5px] sm:grid-cols-[160px_1fr]">
                <dt className="pv-faint">Spend limit</dt>
                <dd className="text-white">{report.mandate.spendLimit.amount} {report.mandate.spendLimit.currency} (spent {report.totalSpent})</dd>
                <dt className="pv-faint">Allowed actions</dt>
                <dd className="pv-mono ac-break text-[12.5px] text-[#c3cad6]">{report.mandate.allowedActions.join(', ')}</dd>
                <dt className="pv-faint">Granted by</dt>
                <dd className="ac-break text-[#c3cad6]">{report.mandate.principal}</dd>
                <dt className="pv-faint">Mandate hash</dt>
                <dd className="pv-mono ac-break text-[12.5px] text-[#c3cad6]">{report.mandateHash}</dd>
              </dl>
              <div className="ac-scroll mt-4 overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-[13px]">
                  <thead className="pv-faint">
                    <tr><th className="py-2 pr-3 font-medium">#</th><th className="py-2 pr-3 font-medium">Requested action</th><th className="py-2 pr-3 font-medium">Decision</th><th className="py-2 pr-3 font-medium">Result</th><th className="py-2 font-medium">Evidence hash</th></tr>
                  </thead>
                  <tbody className="divide-y divide-[#1c222c]">
                    {report.actions.map((a) => (
                      <tr key={a.actionId} className="align-top">
                        <td className="pv-mono py-2 pr-3 text-[#8b95a5]">{a.requestSequence}</td>
                        <td className="py-2 pr-3 text-white">
                          <span className="pv-mono text-[12.5px]">{a.action}</span>
                          {a.amount ? <span className="pv-muted"> · {a.amount} {a.currency}</span> : null}
                          {a.reasons.length > 0 ? <span className="pv-muted mt-1 block text-[12.5px]">{a.reasons.join('; ')}</span> : null}
                        </td>
                        <td className="py-2 pr-3"><StatusPill tone={a.recomputedDecision === 'allow' ? 'ok' : 'warn'}>{a.recomputedDecision === 'allow' ? 'Allowed' : 'Rejected'}</StatusPill></td>
                        <td className="py-2 pr-3 text-[#c3cad6]">{a.executed ? 'Executed' : 'Not executed, receipted'}</td>
                        <td className="pv-mono py-2 text-[12px]" title={a.evidenceHash ?? undefined}>
                          <span className={a.evidenceHashValid ? 'text-[#2ee59d]' : 'text-[#ff7a7a]'}>{a.evidenceHash ? shortHash(a.evidenceHash, 8, 4) : 'missing'}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="ac-notice ac-notice-warn">This receipt has no PROVN Verify mandate, so only its signatures and hashes were checked.</div>
          )}

          <div className="pv-card p-5">
            <h3 className="text-[15px] font-semibold text-white">Solana devnet anchor</h3>
            {report.anchor ? (
              report.anchor.network === 'devnet' ? (
                <div className="mt-2 text-[13.5px] leading-relaxed">
                  <p className="pv-muted">
                    Open the anchor account on Solana Explorer and check that it holds Merkle root{' '}
                    <span className="pv-mono ac-break text-[12.5px] text-white">{receipt.merkle?.root}</span>.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a className="pv-btn-ghost pv-btn-sm" href={report.anchor.accountUrl} target="_blank" rel="noreferrer">Anchor account on devnet ↗</a>
                    {report.anchor.txUrl ? <a className="pv-btn-ghost pv-btn-sm" href={report.anchor.txUrl} target="_blank" rel="noreferrer">Anchor transaction ↗</a> : null}
                  </div>
                </div>
              ) : (
                <p className="ac-notice ac-notice-warn mt-2">This receipt points at Solana {report.anchor.network}. PROVN Verify only links devnet anchors.</p>
              )
            ) : (
              <p className="pv-muted mt-2 text-[13.5px] leading-relaxed">
                Not anchored yet. Receipts sent through the PROVN API get a devnet anchor from the outbox worker; this one has no Solana reference.
              </p>
            )}
            <p className="pv-faint mt-3 text-[12.5px] leading-relaxed">
              An anchor proves the record has not changed since it was committed. It does not prove the off-chain tool call or payment happened as described.
            </p>
          </div>

          {report.problems.length > 0 ? (
            <div className="ac-notice ac-notice-bad">
              <h3 className="font-semibold text-white">What failed</h3>
              <ul className="mt-1 list-disc pl-5">
                {report.problems.slice(0, 12).map((p, i) => <li key={i} className="ac-break">{p}</li>)}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}
