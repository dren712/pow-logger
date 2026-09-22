import { NextRequest, NextResponse } from 'next/server'
import { verifyAgentReceipt } from '@/app/lib/agent/agentVerifier'
import { verifyAgentReceiptNetwork } from '@/app/lib/agent/networkVerifier'
import { Connection, clusterApiUrl } from '@solana/web3.js'
import type { AgentReceipt } from '@/app/lib/agent/types'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { receipt, checkNetwork = false } = body

    if (!receipt || !receipt.events || !receipt.execution) {
      return NextResponse.json({ error: 'Valid receipt object is required' }, { status: 400 })
    }

    if (checkNetwork && receipt.solana) {
      const cluster = (process.env.SOLANA_CLUSTER as 'devnet' | 'mainnet-beta' | 'localnet') || 'devnet'
      const rpcUrl = process.env.SOLANA_RPC_URL || clusterApiUrl(cluster === 'localnet' ? 'devnet' : cluster)
      const connection = new Connection(rpcUrl, 'confirmed')
      const networkResult = await verifyAgentReceiptNetwork(receipt as AgentReceipt, connection)
      return NextResponse.json(networkResult)
    }

    const result = verifyAgentReceipt(receipt as AgentReceipt)
    return NextResponse.json(result)
  } catch (err: unknown) {
    console.error('Agent Verify API Error:', err)
    return NextResponse.json({ error: (err as Error).message || 'Verification failed' }, { status: 500 })
  }
}
