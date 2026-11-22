import type { AgentEvent, VerificationFailureList } from './types'
import CopyButton from './CopyButton'
import HashField from './HashField'
import StatusPill from './StatusPill'
import { formatUtc, seq, shortHash } from './format'

interface EventInspectorProps {
  event: AgentEvent
  merkleRoot: string
  merkleValid: boolean
  failures: VerificationFailureList
}

export default function EventInspector({ event, merkleRoot, merkleValid, failures }: EventInspectorProps) {
  const canonical = `PROVN-AGENT-EVENT-V1
execution:${event.executionId}
sequence:${event.sequence}
agent:${event.agentPublicKey}
event_type:${event.eventType}
timestamp:${event.timestamp}
parent_event:${event.parentEventId || 'none'}
previous_event_hash:${event.previousEventHash || 'none'}
payload_hash:${event.payloadHash}`
  const payload = JSON.stringify(event.payload ?? {}, null, 2)

  return (
    <section className="pv-card min-w-0 p-5 sm:p-6" aria-labelledby="ac-inspector-title" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="ac-inspector-title" className="pv-h2">
          Event <span className="pv-mono">{seq(event.sequence)}</span>
        </h2>
        <span className="pv-chip pv-mono !text-[11.5px]">{event.eventType}</span>
      </div>
      <p className="pv-faint mt-1 text-[12.5px]">{formatUtc(event.timestamp)}</p>

      {failures.length > 0 ? (
        <div role="alert" className="ac-notice ac-notice-bad mt-4">
          <p className="font-semibold text-white">This event failed verification</p>
          <ul className="mt-1 list-disc pl-5">
            {failures.map((f, i) => (
              <li key={`${f.type}-${i}`}>{f.message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-5 flex flex-col gap-5">
        <div className="min-w-0">
          <div className="flex items-center justify-between gap-3">
            <span className="ac-label">Canonical event text</span>
            <CopyButton value={canonical} label="canonical event text" />
          </div>
          <pre className="ac-code ac-break mt-1.5 whitespace-pre-wrap px-3 py-2.5">{canonical}</pre>
          <p className="pv-faint mt-1.5 text-[12px]">The event hash is the SHA-256 of this text. The agent signs that hash.</p>
        </div>

        <HashField label="Event hash (SHA-256)" value={event.eventHash} />
        <HashField label="Previous event hash" value={event.previousEventHash} empty="None. This is the first event in the chain." />
        <HashField label="Ed25519 signature" value={event.signature} />

        <div className="min-w-0">
          <div className="flex items-center justify-between gap-3">
            <span className="ac-label">Payload</span>
            <CopyButton value={payload} label="payload" />
          </div>
          <pre tabIndex={0} className="ac-code ac-scroll mt-1.5 max-h-56 overflow-auto px-3 py-2.5">{payload}</pre>
        </div>

        <div className="min-w-0">
          <div className="flex items-center justify-between gap-3">
            <span className="ac-label">Merkle inclusion</span>
            <StatusPill tone={merkleValid ? 'ok' : 'bad'}>{merkleValid ? 'Included' : 'Failed'}</StatusPill>
          </div>
          <p className="pv-mono mt-1.5 text-[12px] text-[#c3cad6]">
            <span className="pv-faint">leaf</span> {shortHash(event.eventHash, 12, 6)} <span className="pv-faint" aria-hidden="true">→</span>{' '}
            <span className="pv-faint">root</span> {shortHash(merkleRoot, 12, 6)}
          </p>
          <p className="pv-faint mt-1.5 text-[12px] leading-relaxed">
            The event hash is a leaf of the batch Merkle tree. Its proof path is included in the receipt JSON.
          </p>
        </div>
      </div>
    </section>
  )
}
