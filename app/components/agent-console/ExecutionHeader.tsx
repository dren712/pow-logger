import Link from 'next/link'
import type { AgentReceipt, ExecutionAuditReport, VerificationResult } from '../../lib/agent/types'
import HashField from './HashField'
import StatusPill from './StatusPill'
import { formatUtc, sentenceCase, shortHash, type Tone } from './format'

interface ExecutionHeaderProps {
  receipt: AgentReceipt
  verification: VerificationResult
  audit: ExecutionAuditReport
  isLiveDbRecord: boolean
  onDownload: () => void
}

function statusTone(status: string): Tone {
  if (status === 'completed') return 'ok'
  if (status === 'failed') return 'bad'
  return 'warn'
}

export default function ExecutionHeader({ receipt, verification, audit, isLiveDbRecord, onDownload }: ExecutionHeaderProps) {
  const { execution } = receipt
  const agentName = receipt.events[0]?.payload?.agentName
  const failed = verification.failures?.length ?? 0

  const policyTone: Tone = audit.compliance === 'COMPLIANT' ? 'ok' : audit.compliance === 'VIOLATION' ? 'bad' : 'warn'
  const policyLabel = audit.compliance === 'COMPLIANT' ? 'Compliant' : audit.compliance === 'VIOLATION' ? 'Policy violation' : 'Policy warning'

  return (
    <header className="flex flex-col gap-6">
      <nav aria-label="Breadcrumb" className="pv-muted flex flex-wrap items-center gap-2 text-[13px]">
        <Link href="/agent-proof" className="pv-link pv-muted">Agent console</Link>
        <span aria-hidden="true" className="pv-faint">/</span>
        <span className="text-[#c3cad6]">Execution <span className="pv-mono">{execution.executionId.slice(0, 8)}</span></span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="pv-eyebrow">Agent execution</p>
          <h1 className="mt-2 text-[28px] font-bold leading-tight tracking-[-0.025em] text-white sm:text-[32px]">
            Execution <span className="pv-mono text-[0.8em] font-semibold text-[#c3cad6]">{execution.executionId.slice(0, 8)}</span>
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusPill tone={statusTone(execution.status)}>{sentenceCase(execution.status)}</StatusPill>
            <span className="pv-chip">{isLiveDbRecord ? 'Stored record' : 'Example data'}</span>
            {typeof agentName === 'string' && agentName ? <span className="pv-chip">{agentName}</span> : null}
            <span className="pv-chip">Protocol <span className="pv-mono">{receipt.version}</span></span>
          </div>
        </div>
        {isLiveDbRecord ? (
          <a href={`/api/agent/receipt/${execution.executionId}`} target="_blank" rel="noreferrer" className="pv-btn">
            Export receipt JSON
          </a>
        ) : (
          <button type="button" className="pv-btn" onClick={onDownload}>Download receipt JSON</button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="pv-card p-5" aria-label="Provenance verdict">
          <div className="flex items-center justify-between gap-3">
            <h2 className="pv-h2">Provenance</h2>
            <StatusPill tone={verification.verified ? 'ok' : 'bad'}>{verification.verified ? 'Valid' : 'Tamper detected'}</StatusPill>
          </div>
          <p className="pv-muted mt-2 text-[13.5px] leading-relaxed">
            Did this agent key sign these events, in this order?{' '}
            {verification.verified
              ? `${verification.eventsPassed} of ${verification.eventsChecked} events passed every check.`
              : `${failed} ${failed === 1 ? 'check' : 'checks'} failed across ${verification.eventsChecked} events.`}
          </p>
        </section>
        <section className="pv-card p-5" aria-label="Policy verdict">
          <div className="flex items-center justify-between gap-3">
            <h2 className="pv-h2">Policy audit</h2>
            <StatusPill tone={policyTone}>{policyLabel}</StatusPill>
          </div>
          <p className="pv-muted mt-2 text-[13.5px] leading-relaxed">
            Were the actions allowed under {audit.policyName}? Risk {sentenceCase(audit.overallRisk).toLowerCase()} ({audit.riskScore}/100),{' '}
            {audit.findings.length} {audit.findings.length === 1 ? 'finding' : 'findings'}.
          </p>
        </section>
      </div>

      <section className="pv-card grid gap-5 p-5 md:grid-cols-2" aria-label="Execution details">
        <HashField label="Execution ID" value={execution.executionId} />
        <HashField label="Agent public key" value={execution.agentPublicKey} />
        <dl className="grid grid-cols-2 gap-4 text-[13.5px] md:col-span-2 md:grid-cols-4">
          <div>
            <dt className="ac-label">Started</dt>
            <dd className="mt-1 text-[#c3cad6]">{formatUtc(execution.startedAt)}</dd>
          </div>
          <div>
            <dt className="ac-label">Completed</dt>
            <dd className="mt-1 text-[#c3cad6]">{execution.completedAt ? formatUtc(execution.completedAt) : 'Not completed'}</dd>
          </div>
          <div>
            <dt className="ac-label">Events</dt>
            <dd className="mt-1 text-[#c3cad6]">{receipt.events.length}</dd>
          </div>
          <div>
            <dt className="ac-label">Batch</dt>
            <dd className="pv-mono mt-1 text-[12.5px] text-[#c3cad6]">{receipt.batch?.batchId ? shortHash(receipt.batch.batchId, 8, 4) : 'None'}</dd>
          </div>
        </dl>
      </section>
    </header>
  )
}
