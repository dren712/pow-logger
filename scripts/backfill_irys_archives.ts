import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

try {
  const envContent = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf-8')
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([^=]+)=(.*)$/)
    if (match) {
      const key = match[1].trim()
      let val = match[2].trim()
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1)
      process.env[key] = val
    }
  }
} catch (e) {
  console.warn('Could not read .env.local:', e)
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function backfillIrysArchives() {
  console.log('===================================================================')
  console.log('   PROVN AUTOMATED IRYS ARCHIVAL BACKFILL SCRIPT 🗿')
  console.log('===================================================================\n')

  const privateKey = process.env.IRYS_PRIVATE_KEY
  if (!privateKey) {
    console.error('❌ Error: IRYS_PRIVATE_KEY is missing in process.env!')
    process.exit(1)
  }

  // 1. Fetch all database logs
  const { data: logs, error: fetchErr } = await supabase
    .from('logs')
    .select('*')
    .order('id', { ascending: true })

  if (fetchErr) {
    console.error('❌ Supabase fetch error:', fetchErr.message)
    process.exit(1)
  }

  if (!logs || logs.length === 0) {
    console.log('✨ No database entries found.')
    return
  }

  // Filter logs needing archival (irys_tx_id is null or starts with powl_)
  const unarchivedLogs = logs.filter(
    (l) => (!l.irys_tx_id || l.irys_tx_id.startsWith('powl_')) && l.content
  )

  if (unarchivedLogs.length === 0) {
    console.log('✨ All database logs are ALREADY permanently archived on Irys! Zero un-archived entries found.')
    return
  }

  console.log(`Found ${unarchivedLogs.length} un-archived database entries (out of ${logs.length} total logs). Initializing Irys Node #1 uploader...\n`)

  // 2. Initialize Irys uploader
  const { Uploader } = await import('@irys/upload')
  const { Solana } = await import('@irys/upload-solana')

  let rawKey = privateKey.trim()
  if (rawKey.startsWith('"') && rawKey.endsWith('"')) rawKey = rawKey.slice(1, -1)
  let walletKey: string | Uint8Array = rawKey
  try {
    const parsedKey = JSON.parse(rawKey)
    if (Array.isArray(parsedKey)) walletKey = new Uint8Array(parsedKey)
  } catch {}

  const uploader = await (Uploader(Solana) as unknown as { withWallet: (key: string | Uint8Array) => Promise<{ upload: (data: string, opts?: unknown) => Promise<{ id: string }> }> }).withWallet(walletKey)

  let successCount = 0
  let failCount = 0

  // 3. Process each un-archived log
  for (const log of unarchivedLogs) {
    const contentText = (log.content || '').trim()
    const walletAddr = log.wallet_address || 'unknown_wallet'
    console.log(`[Log #${log.id}] Archiving content: "${contentText.slice(0, 35)}..." (Wallet: ${walletAddr.slice(0, 6)}...)`)

    try {
      const structuredEnvelope = JSON.stringify({
        app: 'PROVN',
        version: 1,
        backfilled: true,
        logId: log.id,
        walletAddress: walletAddr,
        timestamp: log.created_at || new Date().toISOString(),
        content: contentText,
        signature: log.signature || null,
        evidenceUrl: log.evidence_url || null,
        githubUrl: log.github_url || null,
      }, null, 2)

      const tags = [
        { name: 'App-Name', value: 'PROVN' },
        { name: 'Content-Type', value: 'application/json' },
        { name: 'Builder-Address', value: walletAddr },
        { name: 'Proof-Type', value: 'Ed25519-Signed-Log' },
        { name: 'Timestamp', value: log.created_at || new Date().toISOString() },
        { name: 'Backfill-Job', value: 'True' },
      ]

      if (log.category) tags.push({ name: 'Category', value: log.category })
      if (log.evidence_url) tags.push({ name: 'Evidence-URL', value: log.evidence_url })
      if (log.github_url) tags.push({ name: 'GitHub-URL', value: log.github_url })

      const uploadReceipt = await uploader.upload(structuredEnvelope, { tags })

      if (uploadReceipt && uploadReceipt.id) {
        const irysTxId = uploadReceipt.id

        // Try updating full schema first
        let updateRes = await supabase
          .from('logs')
          .update({
            irys_tx_id: irysTxId,
            archival_state: 'receipt_obtained',
          })
          .eq('id', log.id)

        // Fallback: If archival_state column does not exist on live DB, update irys_tx_id only
        if (updateRes.error) {
          updateRes = await supabase
            .from('logs')
            .update({
              irys_tx_id: irysTxId,
            })
            .eq('id', log.id)
        }

        if (updateRes.error) {
          console.error(`  ❌ DB update error for log #${log.id}:`, updateRes.error.message)
          failCount++
        } else {
          console.log(`  ✓ SUCCESS! Archived to Arweave: https://gateway.irys.xyz/${irysTxId}`)
          successCount++
        }
      } else {
        console.error(`  ❌ Empty receipt returned for log #${log.id}`)
        failCount++
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err)
      console.error(`  ❌ Upload error for log #${log.id}:`, errMsg)
      failCount++
    }
  }

  console.log('\n===================================================================')
  console.log(`   BACKFILL COMPLETE: ${successCount} ARCHIVED TO IRYS, ${failCount} FAILED`)
  console.log('===================================================================')
}

backfillIrysArchives()
