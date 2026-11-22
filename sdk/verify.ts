/**
 * PROVN Verify SDK helper.
 *
 * Wraps agent tool calls (plain functions or MCP `tools/call`) and x402-style Solana devnet payments in a
 * mandate check and a signed PROVN receipt. Rejected actions are not run, but they are still receipted.
 *
 *   const pv = await ProvnVerify.start({ intent: 'Buy a dataset', mandate })
 *   const quote = await pv.tool('dataset.quote', { id: 'sol-tx' }, getQuote)
 *   await pv.pay({ resource, payTo, amount: '700.00', asset: 'USDC' }, payFn) // rejected: over the $500 mandate
 *   const receipt = await pv.complete()
 *   verifyProvnVerifyReceipt(receipt).verified // true
 */

import { Provn, ProvnExecution, type ProvnClientConfig } from '../app/lib/agent/provnClient'
import { generateId } from '../app/lib/agent/agentEvents'
import {
  PROVN_VERIFY_VERSION,
  computeEvidenceHash,
  evaluateMandate,
  formatAmount,
  hashEvidence,
  parseAmount,
  hashMandate,
  type AgentMandate,
  type MandateActionRequest,
  type MandateDecision,
  type MandateEvaluation,
  type RequestCommitment,
} from '../app/lib/agent/mandate'
import type { AgentReceipt } from '../app/lib/agent/types'

export const X402_DEVNET_NETWORK = 'solana-devnet' as const

/** x402-style payment requirements (the body of an HTTP 402 response), restricted to Solana devnet. */
export interface X402PaymentRequirements {
  scheme?: 'exact'
  network?: typeof X402_DEVNET_NETWORK
  /** URL or name of the paid resource. */
  resource: string
  /** Recipient wallet. */
  payTo: string
  /** Decimal amount in `asset` units, e.g. '0.31'. */
  amount: string
  /** Asset symbol; must match the mandate currency. */
  asset: string
  description?: string
}

export interface X402Settlement {
  /** Devnet transaction signature. */
  txSignature: string
  network?: typeof X402_DEVNET_NETWORK
  [key: string]: unknown
}

/** Minimal MCP client surface: anything with `callTool({ name, arguments })` (e.g. @modelcontextprotocol/sdk Client). */
export interface McpToolCaller {
  callTool(params: { name: string; arguments?: Record<string, unknown> }): Promise<unknown>
}

export interface ActionOutcome<T> {
  actionId: string
  decision: MandateDecision
  reasons: string[]
  /** The tool result or payment settlement; undefined when rejected. */
  result?: T
  evidenceHash: string
}

export interface ProvnVerifyStartParams {
  intent: string
  mandate: AgentMandate
  agent?: string
  metadata?: Record<string, unknown>
  /** Gateway options. Pass `gatewayUrl: ''` to stay fully offline; pass `apiKey` to sync to the PROVN API. */
  client?: ProvnClientConfig
}

export class ProvnVerify {
  readonly mandate: AgentMandate
  readonly mandateHash: string
  private spent = '0'

  private constructor(private readonly execution: ProvnExecution, mandate: AgentMandate, mandateHash: string) {
    this.mandate = mandate
    this.mandateHash = mandateHash
  }

  get executionId(): string {
    return this.execution.executionId
  }

  /** Spend already committed under the mandate. */
  get spentSoFar(): string {
    return this.spent
  }

  static async start(params: ProvnVerifyStartParams): Promise<ProvnVerify> {
    const mandateHash = hashMandate(params.mandate)
    const provn = new Provn(params.client ?? {})
    const execution = await provn.start({
      agent: params.agent,
      intent: params.intent,
      metadata: {
        ...(params.metadata ?? {}),
        provnVerify: { version: PROVN_VERIFY_VERSION, mandate: params.mandate, mandateHash },
      },
    })
    return new ProvnVerify(execution, params.mandate, mandateHash)
  }

  private requestLock: Promise<unknown> = Promise.resolve()

  /** Evaluates and records one request at a time, so every decision sees only reservations backed by a recorded intent. */
  private request(
    request: MandateActionRequest,
    eventType: 'tool' | 'payment.intent',
    extra: Record<string, unknown>
  ): Promise<{ actionId: string; evaluation: MandateEvaluation; payloadHash: string }> {
    const run = this.requestLock.then(() => this.evaluateAndRecord(request, eventType, extra))
    this.requestLock = run.catch(() => undefined)
    return run
  }

  private async evaluateAndRecord(
    request: MandateActionRequest,
    eventType: 'tool' | 'payment.intent',
    extra: Record<string, unknown>
  ): Promise<{ actionId: string; evaluation: MandateEvaluation; payloadHash: string }> {
    const actionId = generateId()
    const evaluation = evaluateMandate(this.mandate, request, this.spent)
    // Reserve the amount at approval so overlapping pay() calls cannot share the same budget.
    if (evaluation.decision === 'allow' && request.kind === 'payment' && request.amount) {
      this.spent = formatAmount(parseAmount(this.spent) + parseAmount(request.amount))
    }
    const commitment: RequestCommitment = {
      actionId,
      mandateHash: this.mandateHash,
      request,
      decision: evaluation.decision,
      reasons: evaluation.reasons,
      spentBefore: evaluation.spentBefore,
    }
    let event
    try {
      event = await this.execution.action({
        type: eventType,
        ...(request.kind === 'tool' ? { tool: request.action } : {}),
        metadata: { ...extra, provnVerify: commitment },
      })
    } catch (err) {
      if (evaluation.decision === 'allow' && request.kind === 'payment' && request.amount) {
        this.spent = formatAmount(parseAmount(this.spent) - parseAmount(request.amount))
      }
      throw err
    }
    return { actionId, evaluation, payloadHash: event.payloadHash }
  }

  private async settle<T>(
    actionId: string,
    evaluation: MandateEvaluation,
    requestPayloadHash: string,
    eventType: 'tool.response' | 'payment.executed' | 'outcome.attestation',
    resultHash: string | null,
    extra: Record<string, unknown>,
    result?: T
  ): Promise<ActionOutcome<T>> {
    const evidenceHash = computeEvidenceHash({
      actionId,
      mandateHash: this.mandateHash,
      requestPayloadHash,
      decision: evaluation.decision,
      resultHash,
    })
    await this.execution.action({
      type: eventType,
      metadata: { ...extra, provnVerify: { actionId, resultHash, evidenceHash } },
    })
    return { actionId, decision: evaluation.decision, reasons: evaluation.reasons, result, evidenceHash }
  }

  private async reject<T>(actionId: string, evaluation: MandateEvaluation, payloadHash: string, action: string) {
    return this.settle<T>(actionId, evaluation, payloadHash, 'outcome.attestation', null, {
      outcomeType: 'mandate.rejected',
      success: false,
      summary: `Rejected ${action}: ${evaluation.reasons.join('; ')}`,
    })
  }

  /** Wraps a generic tool call. The function only runs if the mandate allows the tool. */
  async tool<A, T>(name: string, args: A, fn: (args: A) => Promise<T> | T): Promise<ActionOutcome<T>> {
    const request: MandateActionRequest = { kind: 'tool', action: name, at: new Date().toISOString() }
    const { actionId, evaluation, payloadHash } = await this.request(request, 'tool', { inputHash: hashEvidence(args) })
    if (evaluation.decision === 'reject') return this.reject<T>(actionId, evaluation, payloadHash, name)

    let output: T
    try {
      output = await fn(args)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      await this.settle(actionId, evaluation, payloadHash, 'tool.response', hashEvidence({ error: message }), {
        tool: name,
        success: false,
        errorMessage: message.slice(0, 200),
      })
      throw err
    }
    return this.settle(actionId, evaluation, payloadHash, 'tool.response', hashEvidence(output), { tool: name, success: true }, output)
  }

  /** Wraps an MCP `tools/call`. The mandate action is `mcp:<tool name>`. */
  async mcp<T = unknown>(client: McpToolCaller, name: string, args: Record<string, unknown> = {}): Promise<ActionOutcome<T>> {
    return this.tool(`mcp:${name}`, args, (a) => client.callTool({ name, arguments: a }) as Promise<T>)
  }

  /**
   * Wraps an x402-style payment on Solana devnet. The mandate action is `x402.pay`. `payer` is only called
   * if the payment fits the mandate (action, currency, recipient, remaining spend); it returns the devnet settlement.
   */
  async pay(requirements: X402PaymentRequirements, payer: (req: X402PaymentRequirements) => Promise<X402Settlement>): Promise<ActionOutcome<X402Settlement>> {
    const network = requirements.network ?? X402_DEVNET_NETWORK
    if (network !== X402_DEVNET_NETWORK) {
      throw new Error(`UNSUPPORTED_NETWORK: PROVN Verify only records ${X402_DEVNET_NETWORK} payments (got ${network})`)
    }
    const request: MandateActionRequest = {
      kind: 'payment',
      action: 'x402.pay',
      amount: requirements.amount,
      currency: requirements.asset,
      recipient: requirements.payTo,
      at: new Date().toISOString(),
    }
    const { actionId, evaluation, payloadHash } = await this.request(request, 'payment.intent', {
      protocol: 'x402',
      scheme: requirements.scheme ?? 'exact',
      network,
      resource: requirements.resource,
      recipient: requirements.payTo,
      amount: requirements.amount,
      asset: requirements.asset,
    })
    if (evaluation.decision === 'reject') return this.reject<X402Settlement>(actionId, evaluation, payloadHash, `x402.pay ${requirements.amount} ${requirements.asset}`)

    let settlement: X402Settlement
    try {
      settlement = await payer({ ...requirements, network })
      if (settlement.network && settlement.network !== X402_DEVNET_NETWORK) {
        throw new Error(`UNSUPPORTED_NETWORK: settlement reported ${settlement.network}`)
      }
    } catch (err) {
      // The approved budget is released and the failure is receipted so the run still verifies.
      this.spent = formatAmount(parseAmount(this.spent) - parseAmount(requirements.amount))
      const message = err instanceof Error ? err.message : String(err)
      await this.settle(actionId, evaluation, payloadHash, 'outcome.attestation', hashEvidence({ error: message }), {
        outcomeType: 'payment.failed',
        success: false,
        // The payer's error text stays out of the receipt (it may trip the secret scan); only its hash is committed.
        summary: 'Payment not completed by the payer',
      })
      throw err
    }
    return this.settle(
      actionId,
      evaluation,
      payloadHash,
      'payment.executed',
      hashEvidence(settlement),
      { recipient: requirements.payTo, amount: requirements.amount, asset: requirements.asset, chain: 'solana', network, txSignature: settlement.txSignature },
      settlement
    )
  }

  /** Seals the execution and returns the signed receipt (synced to the gateway when one is configured). */
  async complete(summary?: string): Promise<AgentReceipt & { proofUrl: string }> {
    return this.execution.complete(summary)
  }
}
