import type { AgentReceipt, VerificationLayerStatus, VerificationResult } from '../../lib/agent/types'
import StatusPill from './StatusPill'
import { shortHash, type Tone } from './format'

interface Step {
  title: string
  body: string
  value: string
  tone: Tone
  status: string
}

function layer(...statuses: VerificationLayerStatus[]): { tone: Tone; status: string } {
  if (statuses.includes('INVALID')) return { tone: 'bad', status: 'Failed' }
  if (statuses.every((s) => s === 'VALID')) return { tone: 'ok', status: 'Passed' }
  return { tone: 'neutral', status: 'Not checked' }
}

function buildSteps(receipt: AgentReceipt, verification: VerificationResult): Step[] {
  const l = verification.layers
  const last = Math.max(receipt.events.length - 1, 0)

  const anchor: { tone: Tone; status: string } = !receipt.solana
    ? { tone: 'warn', status: 'Pending' }
    : l.solanaAnchor === 'FOUND'
      ? { tone: 'ok', status: 'Found on-chain' }
      : l.solanaAnchor === 'MISMATCH' || l.solanaAnchor === 'NOT_FOUND'
        ? { tone: 'bad', status: l.solanaAnchor === 'MISMATCH' ? 'Mismatch' : 'Not found' }
        : { tone: 'neutral', status: 'Reference recorded' }

  const archive: { tone: Tone; status: string } = !receipt.irys
    ? { tone: 'warn', status: 'Pending' }
    : l.irysArchive === 'AVAILABLE'
      ? { tone: 'ok', status: 'Available' }
      : l.irysArchive === 'UNAVAILABLE' || l.irysArchive === 'CONTENT_MISMATCH'
        ? { tone: 'bad', status: l.irysArchive === 'UNAVAILABLE' ? 'Unavailable' : 'Mismatch' }
        : { tone: 'neutral', status: 'Reference recorded' }

  return [
    {
      title: 'Agent signatures',
      body: 'Every event carries an Ed25519 signature made with the agent key.',
      value: shortHash(receipt.execution.agentPublicKey),
      ...layer(l.agentSignature),
    },
    {
      title: 'Event and payload hashes',
      body: 'The SHA-256 hash of each canonical event matches the recorded hash.',
      value: `${verification.eventsChecked} events checked`,
      ...layer(l.eventHash),
    },
    {
      title: 'Hash chain',
      body: 'Each event includes the hash of the event before it, so order cannot change.',
      value: `Sequence 0 to ${last}`,
      ...layer(l.hashChain),
    },
    {
      title: 'Merkle tree',
      body: 'All event hashes roll up into one root, and each event has an inclusion proof.',
      value: shortHash(receipt.merkle.root),
      ...layer(l.merkleRoot, l.merkleInclusion),
    },
    {
      title: 'Solana anchor',
      body: 'The Merkle root is committed to a program account on Solana.',
      value: receipt.solana ? shortHash(receipt.solana.pda) : 'No anchor yet',
      ...anchor,
    },
    {
      title: 'Irys archive',
      body: 'The full evidence envelope is stored on Irys for later retrieval.',
      value: receipt.irys ? shortHash(receipt.irys.txId) : 'No archive yet',
      ...archive,
    },
  ]
}

export default function VerificationSteps({ receipt, verification }: { receipt: AgentReceipt; verification: VerificationResult }) {
  const steps = buildSteps(receipt, verification)
  const offline = verification.layers.solanaAnchor === 'NOT_CHECKED' || verification.layers.irysArchive === 'NOT_CHECKED'

  return (
    <section aria-labelledby="ac-steps-title">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="pv-eyebrow">Verification</p>
          <h2 id="ac-steps-title" className="mt-2 text-[20px] font-semibold tracking-tight text-white">How this execution is verified</h2>
        </div>
        <p className="pv-faint text-[13px]">Six checks, in order</p>
      </div>
      <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.title} className={`pv-card flex flex-col gap-3 p-5 ${s.tone === 'bad' ? '!border-[rgba(255,122,122,0.4)]' : ''}`}>
            <div className="flex items-center justify-between gap-3">
              <span className="pv-mono flex h-7 w-7 items-center justify-center rounded-lg border border-[#1c222c] bg-[#11151c] text-[12px] font-semibold text-[#2ee59d]">{i + 1}</span>
              <StatusPill tone={s.tone}>{s.status}</StatusPill>
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-white">{s.title}</h3>
              <p className="pv-muted mt-1 text-[13px] leading-relaxed">{s.body}</p>
            </div>
            <p className="pv-mono pv-faint mt-auto text-[12px]">{s.value}</p>
          </li>
        ))}
      </ol>
      {offline ? (
        <p className="pv-faint mt-3 text-[12.5px] leading-relaxed">
          &ldquo;Reference recorded&rdquo; means the receipt names a Solana account or Irys transaction. This page verifies signatures, hashes and the
          Merkle tree; it does not look the reference up on the network.
        </p>
      ) : null}
    </section>
  )
}
