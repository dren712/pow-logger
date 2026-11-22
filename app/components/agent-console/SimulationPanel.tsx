import type { AgentReceipt, ExecutionAuditReport, VerificationResult } from '../../lib/agent/types'
import StatusPill from './StatusPill'
import { shortHash } from './format'

interface SimulationPanelProps {
  receipt: AgentReceipt
  verification: VerificationResult
  audit: ExecutionAuditReport
  isTampered: boolean
  isHostileSimulated: boolean
  isVerifying: boolean
  verifyError: string | null
  onToggleTamper: () => void
  onToggleHostile: () => void
}

export default function SimulationPanel({
  receipt,
  verification,
  audit,
  isTampered,
  isHostileSimulated,
  isVerifying,
  verifyError,
  onToggleTamper,
  onToggleHostile,
}: SimulationPanelProps) {
  const active = isTampered || isHostileSimulated

  return (
    <section className="pv-card p-5 sm:p-6" aria-labelledby="ac-sim-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="ac-sim-title" className="pv-h2">Test a failure case</h2>
            {active ? <StatusPill tone="warn">Simulation active</StatusPill> : null}
          </div>
          <p className="pv-muted mt-2 text-[13.5px] leading-relaxed">
            Provenance answers &ldquo;what happened?&rdquo;. The policy audit answers &ldquo;was it allowed?&rdquo;. Each simulation breaks one of the
            two so you can see how it is reported. Simulations run in this page only and change no stored data.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="pv-btn-ghost" onClick={onToggleTamper} disabled={isVerifying} aria-pressed={isTampered}>
            {isTampered ? 'Reset tampered record' : 'Simulate a tampered record'}
          </button>
          <button type="button" className="pv-btn-ghost" onClick={onToggleHostile} disabled={isVerifying} aria-pressed={isHostileSimulated}>
            {isHostileSimulated ? 'Reset hostile agent' : 'Simulate a hostile agent'}
          </button>
        </div>
      </div>

      <div aria-live="polite">
        {isVerifying ? <p className="pv-muted mt-4 text-[13px]">Verifying the receipt…</p> : null}
        {verifyError ? (
          <p role="alert" className="ac-notice ac-notice-bad mt-4">
            {verifyError}
          </p>
        ) : null}
      </div>

      {isTampered ? (
        <div className="mt-5 border-t border-[#1c222c] pt-5">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-[rgba(255,122,122,0.32)] bg-[rgba(255,122,122,0.05)] p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-[14px] font-semibold text-white">Edited record</h3>
                <StatusPill tone="bad">Invalid</StatusPill>
              </div>
              <p className="pv-muted mt-2 text-[13px] leading-relaxed">
                The commit event was changed after it was signed: the commit hash and author were replaced.
              </p>
              <p className="pv-faint mt-2 text-[12px]">
                Recomputed hash{' '}
                <code className="pv-mono text-[#ff9c9c]">
                  {verification.failures?.[0]?.computed ? shortHash(verification.failures[0].computed, 14, 6) : 'does not match'}
                </code>
              </p>
            </div>
            <div className="rounded-xl border border-[rgba(46,229,157,0.28)] bg-[rgba(46,229,157,0.04)] p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-[14px] font-semibold text-white">Committed Merkle root</h3>
                <StatusPill tone="ok">Unchanged</StatusPill>
              </div>
              <p className="pv-muted mt-2 text-[13px] leading-relaxed">
                The root committed for this batch was computed from the original events and cannot be edited afterwards.
              </p>
              <p className="pv-faint mt-2 text-[12px]">
                Root <code className="pv-mono text-[#2ee59d]">{shortHash(receipt.merkle.root, 14, 6)}</code>
              </p>
            </div>
          </div>
          <p className="mt-4 text-[13.5px] font-medium text-[#ff9c9c]">
            The edited record no longer matches the committed provenance, so verification fails.
          </p>
        </div>
      ) : null}

      {isHostileSimulated ? (
        <div className="mt-5 border-t border-[#1c222c] pt-5">
          <h3 className="text-[15px] font-semibold text-white">Valid provenance does not mean the action was safe</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-[#1c222c] bg-[#11151c] p-4">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-[14px] font-semibold text-white">Provenance</h4>
                <StatusPill tone={verification.verified ? 'ok' : 'bad'}>{verification.verified ? 'Valid' : 'Invalid'}</StatusPill>
              </div>
              <p className="pv-muted mt-2 text-[13px] leading-relaxed">
                The agent key signed every action, including <code className="pv-mono text-[12px] text-[#c3cad6]">rm -rf /</code>, and the hash chain is intact.
              </p>
            </div>
            <div className="rounded-xl border border-[#1c222c] bg-[#11151c] p-4">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-[14px] font-semibold text-white">Policy audit</h4>
                <StatusPill tone={audit.compliance === 'COMPLIANT' ? 'ok' : 'bad'}>
                  {audit.compliance === 'COMPLIANT' ? 'Compliant' : `Risk ${audit.riskScore}/100`}
                </StatusPill>
              </div>
              <p className="pv-muted mt-2 text-[13px] leading-relaxed">
                The policy rules flag the destructive shell command and the read of{' '}
                <code className="pv-mono text-[12px] text-[#c3cad6]">.env.production</code>. See the Policy audit tab for each finding.
              </p>
            </div>
          </div>
          <p className="pv-muted mt-4 text-[13.5px] leading-relaxed">
            PROVN does not say the action was good. It proves which agent key committed it, so the action cannot be denied later.
          </p>
        </div>
      ) : null}
    </section>
  )
}
