import { STANDARD_POLICY_PRESETS } from '../../lib/agent/agentPolicyEngine'
import type { ExecutionAuditReport, ExecutionPolicy } from '../../lib/agent/types'
import StatusPill from './StatusPill'
import { sentenceCase, seq, type Tone } from './format'

interface AuditPanelProps {
  audit: ExecutionAuditReport
  activePolicy: ExecutionPolicy
  selectedPolicyKey: string
  onSelectPolicy: (key: string) => void
  onInspectEvent: (eventSequence: number) => void
}

function riskTone(risk: string): Tone {
  return risk === 'CRITICAL' || risk === 'HIGH' ? 'bad' : risk === 'MEDIUM' ? 'warn' : 'ok'
}

function severityTone(severity: string): Tone {
  return severity === 'CRITICAL' || severity === 'VIOLATION' ? 'bad' : severity === 'WARNING' ? 'warn' : 'neutral'
}

function RuleList({ title, items, empty }: { title: string; items?: string[]; empty: string }) {
  return (
    <div className="rounded-xl border border-[#1c222c] bg-[#11151c] p-4">
      <h3 className="ac-label">{title}</h3>
      {items && items.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {items.map((item) => (
            <li key={item} className="pv-chip pv-mono ac-break !rounded-md !text-[11.5px]">{item}</li>
          ))}
        </ul>
      ) : (
        <p className="pv-faint mt-3 text-[13px]">{empty}</p>
      )}
    </div>
  )
}

export default function AuditPanel({ audit, activePolicy, selectedPolicyKey, onSelectPolicy, onInspectEvent }: AuditPanelProps) {
  const compliant = audit.compliance === 'COMPLIANT'
  const metrics: { label: string; value: string; tone?: Tone }[] = [
    {
      label: 'Verdict',
      value: compliant ? 'Compliant' : audit.compliance === 'VIOLATION' ? 'Policy violation' : 'Warning',
      tone: compliant ? 'ok' : audit.compliance === 'VIOLATION' ? 'bad' : 'warn',
    },
    { label: 'Risk score', value: `${audit.riskScore}/100 · ${sentenceCase(audit.overallRisk)}`, tone: riskTone(audit.overallRisk) },
    { label: 'Violations', value: String(audit.summary.violationsCount), tone: audit.summary.violationsCount > 0 ? 'bad' : undefined },
    { label: 'Warnings', value: String(audit.summary.warningsCount), tone: audit.summary.warningsCount > 0 ? 'warn' : undefined },
    { label: 'Events evaluated', value: String(audit.summary.totalEventsEvaluated) },
  ]
  const toneColor: Record<Tone, string> = { ok: '#2ee59d', bad: '#ff7a7a', warn: '#f5c451', neutral: '#e8ecf2' }

  return (
    <div className="flex flex-col gap-4">
      <section className="pv-card p-5 sm:p-6" aria-labelledby="ac-policy-title">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl">
            <p className="ac-label">Active policy</p>
            <h2 id="ac-policy-title" className="mt-1 text-[18px] font-semibold text-white">{activePolicy.policyName}</h2>
            <p className="pv-muted mt-1 text-[13.5px] leading-relaxed">{activePolicy.description}</p>
          </div>
          <div role="group" aria-label="Choose a policy" className="flex flex-wrap gap-2">
            {Object.keys(STANDARD_POLICY_PRESETS).map((key) => (
              <button key={key} type="button" className="ac-seg" aria-pressed={selectedPolicyKey === key} onClick={() => onSelectPolicy(key)}>
                {sentenceCase(key)}
              </button>
            ))}
          </div>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
          {metrics.map((m) => (
            <div key={m.label} className="rounded-xl border border-[#1c222c] bg-[#11151c] p-4">
              <dt className="ac-label">{m.label}</dt>
              <dd className="mt-1.5 text-[15px] font-semibold" style={{ color: toneColor[m.tone ?? 'neutral'] }}>{m.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="pv-card p-5 sm:p-6" aria-labelledby="ac-findings-title">
        <h2 id="ac-findings-title" className="pv-h2">
          Findings <span className="pv-faint font-normal">({audit.findings.length})</span>
        </h2>
        {audit.findings.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-[#272e3a] px-5 py-8 text-center">
            <p className="text-[15px] font-semibold text-white">No policy findings</p>
            <p className="pv-muted mx-auto mt-1 max-w-md text-[13.5px] leading-relaxed">
              Every action in this execution is allowed under {activePolicy.policyName}. Choose another policy above to evaluate it against
              different rules.
            </p>
          </div>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {audit.findings.map((fnd) => (
              <li key={fnd.id} className="rounded-xl border border-[#1c222c] bg-[#11151c] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill tone={severityTone(fnd.severity)}>{sentenceCase(fnd.severity)}</StatusPill>
                      <span className="pv-mono pv-faint ac-break text-[11.5px]">{fnd.ruleId}</span>
                      <span className="pv-mono pv-muted text-[11.5px]">Event {seq(fnd.eventSequence)}</span>
                    </div>
                    <h3 className="mt-2 text-[15px] font-semibold text-white">{fnd.title}</h3>
                  </div>
                  <button type="button" className="pv-btn-ghost ac-btn-sm" onClick={() => onInspectEvent(fnd.eventSequence)}>
                    Inspect event
                  </button>
                </div>
                <p className="mt-2 text-[13.5px] leading-relaxed text-[#c3cad6]">{fnd.message}</p>
                {fnd.matchedPattern ? (
                  <p className="pv-muted mt-2 text-[12.5px]">
                    Matched pattern <code className="pv-mono ac-break rounded bg-[#080a0e] px-1.5 py-0.5 text-[12px] text-[#f5c451]">{fnd.matchedPattern}</code>
                  </p>
                ) : null}
                {fnd.remediation ? (
                  <p className="pv-muted mt-3 border-t border-[#1c222c] pt-3 text-[13px] leading-relaxed">
                    <span className="font-semibold text-[#c3cad6]">Remediation: </span>
                    {fnd.remediation}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="pv-card p-5 sm:p-6" aria-labelledby="ac-rules-title">
        <h2 id="ac-rules-title" className="pv-h2">Policy rules</h2>
        <p className="pv-muted mt-1 text-[13px]">What {activePolicy.policyName} allows and forbids.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <RuleList title="Allowed event types" items={activePolicy.allowedEventTypes} empty="All event types are allowed." />
          <RuleList title="Forbidden file patterns" items={activePolicy.forbiddenFilePatterns} empty="No file patterns are forbidden." />
          <RuleList title="Forbidden commands" items={activePolicy.forbiddenCommands} empty="No commands are forbidden." />
          <RuleList title="Forbidden tools" items={activePolicy.forbiddenTools} empty="No tools are forbidden." />
        </div>
      </section>
    </div>
  )
}
