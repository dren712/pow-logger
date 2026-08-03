import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

export async function POST(req: NextRequest) {
  try {
    const { logId, walletAddress } = await req.json()

    if (!logId || typeof logId !== 'number') {
      return NextResponse.json({ error: 'Valid numeric logId is required' }, { status: 400 })
    }

    if (!walletAddress || typeof walletAddress !== 'string') {
      return NextResponse.json({ error: 'Valid Base58 walletAddress is required' }, { status: 400 })
    }

    // 1. Fetch log record from database
    const { data: logRow, error: fetchErr } = await supabase
      .from('logs')
      .select('*')
      .eq('id', logId)
      .eq('wallet_address', walletAddress)
      .maybeSingle()

    if (fetchErr || !logRow) {
      return NextResponse.json({ error: 'Log entry not found or unauthorized' }, { status: 404 })
    }

    if (logRow.archival_state === 'archived' && logRow.irys_tx_id) {
      return NextResponse.json({
        success: true,
        message: 'Log entry is already archived on Irys',
        irysTxId: logRow.irys_tx_id,
        archivalState: 'archived',
        gatewayUrl: `https://gateway.irys.xyz/${logRow.irys_tx_id}`,
      })
    }

    // 2. Retry upload to Irys Node #1
    const privateKey = process.env.IRYS_PRIVATE_KEY
    if (!privateKey) {
      return NextResponse.json({ error: 'Irys node authority keypair not configured' }, { status: 503 })
    }

    const { Uploader } = await import('@irys/upload')
    const { Solana } = await import('@irys/upload-solana')

    let walletKey: string | Uint8Array = privateKey
    try {
      const parsedKey = JSON.parse(privateKey)
      if (Array.isArray(parsedKey)) {
        walletKey = new Uint8Array(parsedKey)
      }
    } catch {
      // Plain key string
    }

    const uploader = await (Uploader(Solana) as unknown as { withWallet: (key: string | Uint8Array) => Promise<{ upload: (data: string, opts?: unknown) => Promise<{ id: string }> }> }).withWallet(walletKey)

    const tags = [
      { name: 'App-Name', value: 'PROVN' },
      { name: 'Content-Type', value: 'text/plain' },
      { name: 'Builder-Address', value: walletAddress },
      { name: 'Proof-Type', value: 'Ed25519-Signed-Log' },
      { name: 'Timestamp', value: logRow.created_at },
      { name: 'Retry-Attempt', value: 'True' },
    ]

    if (logRow.category) tags.push({ name: 'Category', value: logRow.category })
    if (logRow.evidence_url) tags.push({ name: 'Evidence-URL', value: logRow.evidence_url })
    if (logRow.github_url) tags.push({ name: 'GitHub-URL', value: logRow.github_url })

    const uploadReceipt = await uploader.upload(logRow.content.trim(), { tags })

    if (!uploadReceipt || !uploadReceipt.id) {
      await supabase
        .from('logs')
        .update({ archival_state: 'failed' })
        .eq('id', logId)

      return NextResponse.json({ error: 'Archival retry failed: Irys node returned empty receipt' }, { status: 502 })
    }

    const irysTxId = uploadReceipt.id
    const { error: updateErr } = await supabase
      .from('logs')
      .update({
        irys_tx_id: irysTxId,
        archival_state: 'archived',
      })
      .eq('id', logId)

    if (updateErr) {
      console.error('Supabase retry update error:', updateErr.message)
    }

    return NextResponse.json({
      success: true,
      archivalState: 'archived',
      irysTxId,
      gatewayUrl: `https://gateway.irys.xyz/${irysTxId}`,
    })
  } catch (error: unknown) {
    console.error('Archival retry API error:', error)
    const detail = error instanceof Error ? error.message : 'Failed to execute archival retry'
    return NextResponse.json({ error: detail }, { status: 500 })
  }
}
