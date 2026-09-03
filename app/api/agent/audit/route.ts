import { NextRequest, NextResponse } from 'next/server'
import {
  evaluateExecutionPolicy,
  STANDARD_POLICY_PRESETS,
  SECURE_CODING_AGENT_POLICY,
} from '@/app/lib/agent/agentPolicyEngine'
import type { AgentReceipt, ExecutionPolicy } from '@/app/lib/agent/types'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { receipt, policy, policyPreset } = body

    if (!receipt || !receipt.events || !receipt.execution) {
      return NextResponse.json(
        { error: 'Valid receipt object with execution and events is required' },
        { status: 400 }
      )
    }

    // Determine policy to evaluate against
    let policyToUse: ExecutionPolicy = SECURE_CODING_AGENT_POLICY
    if (policy) {
      policyToUse = policy as ExecutionPolicy
    } else if (policyPreset && STANDARD_POLICY_PRESETS[policyPreset]) {
      policyToUse = STANDARD_POLICY_PRESETS[policyPreset]
    }

    const report = evaluateExecutionPolicy(receipt as AgentReceipt, policyToUse)
    return NextResponse.json(report)
  } catch (err: unknown) {
    console.error('Agent Audit API Error:', err)
    return NextResponse.json(
      { error: (err as Error).message || 'Policy evaluation failed' },
      { status: 500 }
    )
  }
}
