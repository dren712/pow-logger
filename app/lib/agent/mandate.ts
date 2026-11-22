/**
 * PROVN Verify — mandates and independent receipt checks for paying agents.
 *
 * A mandate is what a principal allows an agent to do: which actions it may take and how much it may spend.
 * The SDK commits the mandate in the signed `agent.started` event, records every requested action with the
 * mandate decision, and records either the result or the rejection. The verifier below re-derives all of it
 * from the receipt alone: signatures, hashes, the mandate decision for each action, and each evidence hash.
 *
 * A hash committed on Solana proves the record has not changed since it was committed. It does not prove the
 * off-chain event (a tool call, an API response) happened as described.
 */

import { canonicalize } from './canonicalize'
import { sha256 } from './agentEvents'
import { verifyAgentReceipt } from './agentVerifier'
import type { AgentEvent, AgentReceipt, VerificationResult } from './types'

export const PROVN_VERIFY_VERSION = 'provn-verify/1' as const
const AMOUNT_DECIMALS = 6
const AMOUNT_PATTERN = /^\d+(\.\d{1,6})?$/

export interface AgentMandate {
  mandateId: string
  /** Who granted the mandate (wallet, org or user id). */
  principal: string
  /** Total the agent may spend across the execution. */
  spendLimit: { amount: string; currency: string }
  /** Tool or payment action names; a trailing `*` matches a prefix (e.g. `x402.*`). */
  allowedActions: string[]
  /** If set, payments may only go to these recipients. */
  allowedRecipients?: string[]
  /** ISO-8601 expiry; actions after it are rejected. */
  expiresAt?: string
}

export interface MandateActionRequest {
  kind: 'tool' | 'payment'
  action: string
  amount?: string
  currency?: string
  recipient?: string
  /** ISO-8601 time of the request (used for the expiry check). */
  at: string
}

export type MandateDecision = 'allow' | 'reject'

export interface MandateEvaluation {
  decision: MandateDecision
  reasons: string[]
  /** Spend counted before this action, in the mandate currency. */
  spentBefore: string
  /** Spend left after this action if it is allowed. */
  remainingAfter: string
}

export function parseAmount(amount: string): bigint {
  if (typeof amount !== 'string' || !AMOUNT_PATTERN.test(amount)) {
    throw new Error(`INVALID_AMOUNT: "${amount}" must be a non-negative decimal with at most ${AMOUNT_DECIMALS} decimals`)
  }
  const [whole, frac = ''] = amount.split('.')
  return BigInt(whole) * BigInt(10 ** AMOUNT_DECIMALS) + BigInt(frac.padEnd(AMOUNT_DECIMALS, '0'))
}

export function formatAmount(units: bigint): string {
  const negative = units < BigInt(0)
  const abs = negative ? -units : units
  const base = BigInt(10 ** AMOUNT_DECIMALS)
  const frac = (abs % base).toString().padStart(AMOUNT_DECIMALS, '0').replace(/0+$/, '').padEnd(2, '0')
  return `${negative ? '-' : ''}${(abs / base).toString()}.${frac}`
}

export function hashMandate(mandate: AgentMandate): string {
  return sha256(canonicalize(mandate))
}

export function hashEvidence(value: unknown): string {
  return sha256(canonicalize(value ?? null))
}

function actionAllowed(allowed: string[], action: string): boolean {
  return allowed.some((rule) => (rule.endsWith('*') ? action.startsWith(rule.slice(0, -1)) : rule === action))
}

/** Pure, deterministic mandate check. `spentBefore` is the amount already spent under this mandate. */
export function evaluateMandate(mandate: AgentMandate, request: MandateActionRequest, spentBefore = '0'): MandateEvaluation {
  const reasons: string[] = []
  const limit = parseAmount(mandate.spendLimit.amount)
  const spent = parseAmount(spentBefore)
  let cost = BigInt(0)

  if (!actionAllowed(mandate.allowedActions, request.action)) {
    reasons.push(`Action "${request.action}" is not in the mandate's allowed actions`)
  }
  if (mandate.expiresAt && Date.parse(request.at) > Date.parse(mandate.expiresAt)) {
    reasons.push(`Mandate expired at ${mandate.expiresAt}`)
  }
  if (request.kind === 'payment') {
    if (request.amount === undefined) {
      reasons.push('Payment has no amount')
    } else {
      try {
        cost = parseAmount(request.amount)
      } catch {
        reasons.push(`Payment amount "${request.amount}" is not a valid decimal`)
      }
    }
    if (request.currency !== mandate.spendLimit.currency) {
      reasons.push(`Currency ${request.currency ?? 'none'} does not match the mandate currency ${mandate.spendLimit.currency}`)
    }
    if (cost > limit - spent) {
      reasons.push(
        `Amount ${formatAmount(cost)} ${mandate.spendLimit.currency} exceeds the remaining spend limit of ${formatAmount(limit - spent)} ${mandate.spendLimit.currency}`
      )
    }
    if (mandate.allowedRecipients && (!request.recipient || !mandate.allowedRecipients.includes(request.recipient))) {
      reasons.push(`Recipient ${request.recipient ?? 'none'} is not in the mandate's allowed recipients`)
    }
  }

  const decision: MandateDecision = reasons.length === 0 ? 'allow' : 'reject'
  return {
    decision,
    reasons,
    spentBefore: formatAmount(spent),
    remainingAfter: formatAmount(limit - spent - (decision === 'allow' ? cost : BigInt(0))),
  }
}

/** Binds the mandate, the signed request and the result (or the rejection) into one hash. */
export function computeEvidenceHash(params: {
  actionId: string
  mandateHash: string
  requestPayloadHash: string
  decision: MandateDecision
  resultHash: string | null
}): string {
  return sha256(
    canonicalize({
      domain: 'PROVN-VERIFY-EVIDENCE-V1',
      actionId: params.actionId,
      mandateHash: params.mandateHash,
      requestPayloadHash: params.requestPayloadHash,
      decision: params.decision,
      resultHash: params.resultHash,
    })
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Payload shapes committed by the SDK
// ─────────────────────────────────────────────────────────────────────────────

export interface MandateCommitment {
  version: typeof PROVN_VERIFY_VERSION
  mandate: AgentMandate
  mandateHash: string
}

export interface RequestCommitment {
  actionId: string
  mandateHash: string
  request: MandateActionRequest
  decision: MandateDecision
  reasons: string[]
  spentBefore: string
}

export interface ResultCommitment {
  actionId: string
  resultHash: string | null
  evidenceHash: string
}

const RESULT_EVENT_TYPES = new Set(['tool.response', 'payment.executed'])

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

export function extractMandateCommitment(receipt: AgentReceipt): MandateCommitment | null {
  const started = receipt.events?.find((e) => e.eventType === 'agent.started')
  const meta = asRecord(asRecord(started?.payload)?.metadata)
  const pv = asRecord(meta?.provnVerify)
  if (!pv || pv.version !== PROVN_VERIFY_VERSION || !asRecord(pv.mandate)) return null
  return pv as unknown as MandateCommitment
}

function requestOf(e: AgentEvent): RequestCommitment | null {
  const pv = asRecord(asRecord(e.payload)?.provnVerify)
  return pv && asRecord(pv.request) && typeof pv.decision === 'string' ? (pv as unknown as RequestCommitment) : null
}

function resultOf(e: AgentEvent): ResultCommitment | null {
  const pv = asRecord(asRecord(e.payload)?.provnVerify)
  return pv && typeof pv.evidenceHash === 'string' && !asRecord(pv.request) ? (pv as unknown as ResultCommitment) : null
}

// ─────────────────────────────────────────────────────────────────────────────
// Independent verification
// ─────────────────────────────────────────────────────────────────────────────

export type CheckStatus = 'pass' | 'fail' | 'absent'

export interface VerifiedAction {
  actionId: string
  kind: 'tool' | 'payment'
  action: string
  amount?: string
  currency?: string
  recipient?: string
  requestSequence: number
  resultSequence: number | null
  recordedDecision: MandateDecision
  recomputedDecision: MandateDecision | null
  reasons: string[]
  executed: boolean
  evidenceHash: string | null
  evidenceHashValid: boolean
  problems: string[]
}

export interface AnchorLink {
  network: string
  pda: string
  signature: string | null
  accountUrl: string
  txUrl: string | null
}

export interface ProvnVerifyReport {
  verified: boolean
  checks: {
    signatures: CheckStatus
    eventHashes: CheckStatus
    hashChain: CheckStatus
    merkleRoot: CheckStatus
    mandate: CheckStatus
    evidence: CheckStatus
  }
  integrity: VerificationResult
  mandate: AgentMandate | null
  mandateHash: string | null
  actions: VerifiedAction[]
  totalSpent: string | null
  anchor: AnchorLink | null
  problems: string[]
}

function layer(status: string): CheckStatus {
  return status === 'VALID' ? 'pass' : 'fail'
}

export function buildAnchorLink(receipt: AgentReceipt): AnchorLink | null {
  const ref = receipt?.solana
  if (!ref || typeof ref.pda !== 'string') return null
  const cluster = ref.network === 'mainnet-beta' ? '' : `?cluster=${ref.network === 'localnet' ? 'custom' : 'devnet'}`
  return {
    network: ref.network,
    pda: ref.pda,
    signature: ref.signature ?? null,
    accountUrl: `https://explorer.solana.com/address/${encodeURIComponent(ref.pda)}${cluster}`,
    txUrl: ref.signature ? `https://explorer.solana.com/tx/${encodeURIComponent(ref.signature)}${cluster}` : null,
  }
}

/**
 * Verifies a PROVN Verify receipt offline: the existing agent checks (signatures, event hashes, hash chain,
 * Merkle) plus a replay of every mandate decision and evidence hash. Needs nothing but the receipt.
 */
export function verifyProvnVerifyReceipt(receipt: AgentReceipt): ProvnVerifyReport {
  const integrity = verifyAgentReceipt(receipt, { skipSolana: true, skipIrys: true })
  const problems: string[] = integrity.failures.map((f) => f.message)
  const actions: VerifiedAction[] = []
  const events = Array.isArray(receipt?.events) ? [...receipt.events].sort((a, b) => a.sequence - b.sequence) : []

  const commitment = receipt && typeof receipt === 'object' ? extractMandateCommitment(receipt) : null
  let mandateStatus: CheckStatus = 'absent'
  let evidenceStatus: CheckStatus = 'absent'
  let mandateHash: string | null = null
  let spent = BigInt(0)

  if (commitment) {
    mandateStatus = 'pass'
    mandateHash = hashMandate(commitment.mandate)
    if (mandateHash !== commitment.mandateHash) {
      mandateStatus = 'fail'
      problems.push('The committed mandate hash does not match the mandate in the receipt')
    }

    const results = new Map<string, AgentEvent>()
    for (const e of events) {
      const r = resultOf(e)
      if (r) results.set(r.actionId, e)
    }
    const requestIds = new Set<string>()

    for (const e of events) {
      const req = requestOf(e)
      if (!req) continue
      requestIds.add(req.actionId)
      const actionProblems: string[] = []
      if (req.mandateHash !== mandateHash) actionProblems.push('Request references a different mandate')

      let recomputed: MandateEvaluation | null = null
      try {
        recomputed = evaluateMandate(commitment.mandate, req.request, formatAmount(spent))
      } catch (err) {
        actionProblems.push(`Mandate could not be evaluated: ${(err as Error).message}`)
      }
      if (recomputed && recomputed.decision !== req.decision) {
        actionProblems.push(`Recorded decision "${req.decision}" but the mandate gives "${recomputed.decision}"`)
      }

      const resultEvent = results.get(req.actionId) ?? null
      const executed = Boolean(resultEvent && RESULT_EVENT_TYPES.has(resultEvent.eventType))
      if (executed && (req.decision === 'reject' || recomputed?.decision === 'reject')) {
        actionProblems.push('A rejected action was executed anyway')
      }
      if (!resultEvent) actionProblems.push('No result or rejection was recorded for this request')

      let evidenceHash: string | null = null
      let evidenceHashValid = false
      if (resultEvent) {
        const res = resultOf(resultEvent)!
        evidenceHash = res.evidenceHash
        const expected = computeEvidenceHash({
          actionId: req.actionId,
          mandateHash: req.mandateHash,
          requestPayloadHash: e.payloadHash,
          decision: req.decision,
          resultHash: res.resultHash ?? null,
        })
        evidenceHashValid = expected === res.evidenceHash
        if (!evidenceHashValid) actionProblems.push('Evidence hash does not match the request and result')
        if (resultEvent.sequence < e.sequence) actionProblems.push('Result was recorded before its request')
      }

      if (executed && req.request.kind === 'payment' && req.request.amount && recomputed?.decision === 'allow') {
        spent += parseAmount(req.request.amount)
      }

      actions.push({
        actionId: req.actionId,
        kind: req.request.kind,
        action: req.request.action,
        amount: req.request.amount,
        currency: req.request.currency,
        recipient: req.request.recipient,
        requestSequence: e.sequence,
        resultSequence: resultEvent ? resultEvent.sequence : null,
        recordedDecision: req.decision,
        recomputedDecision: recomputed ? recomputed.decision : null,
        reasons: recomputed ? recomputed.reasons : req.reasons,
        executed,
        evidenceHash,
        evidenceHashValid,
        problems: actionProblems,
      })
      for (const p of actionProblems) problems.push(`Action ${req.request.action} (event #${e.sequence}): ${p}`)
    }

    for (const e of events) {
      if (e.eventType === 'payment.executed') {
        const r = resultOf(e)
        if (!r || !requestIds.has(r.actionId)) {
          mandateStatus = 'fail'
          problems.push(`Payment at event #${e.sequence} has no mandate-checked request`)
        }
      }
    }

    if (actions.some((a) => a.problems.some((p) => !p.startsWith('Evidence')))) mandateStatus = 'fail'
    if (actions.length > 0) evidenceStatus = actions.every((a) => a.evidenceHashValid) ? 'pass' : 'fail'
  }

  const checks = {
    signatures: layer(integrity.layers.agentSignature),
    eventHashes: layer(integrity.layers.eventHash),
    hashChain: layer(integrity.layers.hashChain),
    merkleRoot: integrity.layers.merkleRoot === 'VALID' && integrity.layers.merkleInclusion === 'VALID' ? 'pass' as const : 'fail' as const,
    mandate: mandateStatus,
    evidence: evidenceStatus,
  }

  return {
    verified: Object.values(checks).every((s) => s !== 'fail') && integrity.verified && problems.length === 0,
    checks,
    integrity,
    mandate: commitment ? commitment.mandate : null,
    mandateHash,
    actions,
    totalSpent: commitment ? formatAmount(spent) : null,
    anchor: receipt && typeof receipt === 'object' ? buildAnchorLink(receipt) : null,
    problems,
  }
}
