#!/usr/bin/env node

/**
 * PROVN Command Line Interface ($0 Free-Tier)
 *
 * Usage:
 *   node cli/provn.mjs passport <wallet>
 *   node cli/provn.mjs reputation <wallet>
 *   node cli/provn.mjs packet <wallet>
 *   node cli/provn.mjs verify <proofId>
 *   node cli/provn.mjs eligibility <wallet> [--policy <file.json>]
 */

import fs from 'fs'

const BASE_URL = process.env.PROVN_URL || 'https://provn-sol.vercel.app'

async function main() {
  const args = process.argv.slice(2)
  const command = args[0]
  const target = args[1]

  if (!command || !target) {
    console.log(`
PROVN CLI 🗿 — Cryptographic Provenance Protocol on Solana

Usage:
  provn passport <wallet>                 Fetch full Builder Passport JSON
  provn reputation <wallet>               Display reputation summary & active streak
  provn packet <wallet>                   Generate and print portable Proof Packet
  provn inspect <proofId>                 Inspect full 5-link cryptographic provenance chain
  provn anchor <proofId> <wallet>         Compute and display Solana On-Chain Anchor PDA
  provn verify <proofId>                  Fetch and inspect an individual proof
  provn eligibility <wallet> [options]    Evaluate wallet against community evidence policy

Options:
  --policy <path>                         Path to local JSON policy file
  --url <url>                             Custom PROVN endpoint (default: https://provn-sol.vercel.app)
`)
    process.exit(1)
  }

  try {
    if (command === 'profile' || command === 'passport') {
      console.log(`\nFetching Builder Passport for: ${target}...\n`)
      const res = await fetch(`${BASE_URL}/api/passport/${target}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      const data = await res.json()
      console.log(JSON.stringify(data, null, 2))
    } else if (command === 'reputation') {
      console.log(`\nCalculating Builder Reputation for: ${target}...\n`)
      const res = await fetch(`${BASE_URL}/api/passport/${target}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      const data = await res.json()
      const rep = data.reputation
      console.log('======================================================')
      console.log(` PROVN BUILDER REPUTATION: ${target}`)
      console.log('======================================================')
      console.log(` Level:           ${rep.builderLevel.emoji} Level ${rep.builderLevel.level} (${rep.builderLevel.title})`)
      console.log(` Verified Proofs: ${rep.verifiedProofs} (Total Records: ${rep.totalRecords})`)
      console.log(` 30-Day Activity: ${rep.recentVerifiedProofs} verified proofs`)
      console.log(` Active Streak:   🔥 ${rep.currentStreak} Days (Longest: ${rep.longestStreak}d)`)
      console.log(` Archival Rate:   📦 ${rep.archivalSuccessRate}% on Arweave (${rep.archivedVerifiedProofs} archived)`)
      console.log(` GitHub Evidence: 🐙 ${rep.proofsWithGithubEvidence} verified proofs`)
      console.log(` Top Skills:      ${rep.skills.map((s) => '#' + s.name).join(', ') || 'None'}`)
      console.log(` Protocols:       ${rep.protocols.map((p) => '⚡ ' + p.name).join(', ') || 'None'}`)
      console.log('======================================================\n')
    } else if (command === 'packet') {
      console.log(`\nGenerating Proof Packet for: ${target}...\n`)
      const res = await fetch(`${BASE_URL}/api/passport/${target}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      const passport = await res.json()

      const verified = passport.proofs.filter((p) => p.isCryptographicallyVerified)
      console.log('======================================================')
      console.log(` 📦 PROVN PROOF PACKET — ${target}`)
      console.log(` Verification: https://provn-sol.vercel.app/u/${target}`)
      console.log('======================================================')
      console.log(` Verified Proofs: ${passport.reputation.verifiedProofs}`)
      console.log(` Top Skills:      ${passport.reputation.skills.map((s) => s.name).slice(0, 5).join(', ')}`)
      console.log('------------------------------------------------------')
      console.log(' TOP VERIFIED EVIDENCE RECORDS:')
      verified.slice(0, 5).forEach((p, idx) => {
        console.log(`\n [${idx + 1}] Proof #${p.id} — ${new Date(p.createdAt).toLocaleDateString()}`)
        console.log(`     Claim:    ${p.content}`)
        if (p.githubUrl) console.log(`     GitHub:   ${p.githubUrl}`)
        if (p.evidenceUrl) console.log(`     Evidence: ${p.evidenceUrl}`)
        console.log(`     Signer:   ${p.walletAddress} (Ed25519 Verified ✓)`)
        console.log(`     Inspect:  https://provn-sol.vercel.app/proof/${p.id}`)
      })
      console.log('\n======================================================\n')
    } else if (command === 'inspect') {
      console.log(`\nInspecting 5-Link Provenance Chain for Proof #${target}...\n`)
      const res = await fetch(`${BASE_URL}/api/proof/${target}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      const p = await res.json()

      console.log('======================================================')
      console.log(` ⛓️ PROVN 5-LINK PROVENANCE CHAIN — PROOF #${p.id}`)
      console.log('======================================================')
      console.log(` [1] Solana Wallet:   ${p.walletAddress} (${p.signatureVerified ? '✅ VERIFIED' : '❌ FAILED'})`)
      console.log(` [2] Protocol Epoch:  ${p.nonce || 'v2'} (${p.protocolVerified ? '✅ VERIFIED' : '⏳ PENDING'})`)
      console.log(` [3] Source Evidence: ${p.provenanceLevel || 'self_attested'} (${p.githubUrl || 'None'})`)
      console.log(` [4] Solana Anchor:   PDA: ${p.solanaAnchorPda || 'Calculated on Request'}`)
      console.log(`     Program ID:      ${p.solanaProgramId || 'FZomvFyB1R2CQZwoTKhU8f2i1hVd1NS3TYUaFrwijmZx'}`)
      console.log(` [5] Irys Storage:    ${p.irysTxId ? '✅ https://gateway.irys.xyz/' + p.irysTxId : '⏳ QUEUED (Automatic)'}`)
      console.log('------------------------------------------------------')
      console.log(` Work Claim: "${p.content}"`)
      console.log(` Created At: ${p.createdAt}`)
      console.log('======================================================\n')
    } else if (command === 'anchor') {
      const wallet = args[2] || target
      const proofId = parseInt(target, 10)
      console.log(`\nCalculating Solana Proof Anchor PDA for Proof #${proofId}...`)
      console.log(`Authority Wallet: ${wallet}\n`)

      const { PublicKey } = await import('@solana/web3.js')
      const proofIdBuf = Buffer.alloc(8)
      proofIdBuf.writeBigUInt64LE(BigInt(proofId))
      const programId = new PublicKey('FZomvFyB1R2CQZwoTKhU8f2i1hVd1NS3TYUaFrwijmZx')
      const authorityPubkey = new PublicKey(wallet)

      const [pda, bump] = PublicKey.findProgramAddressSync(
        [Buffer.from('proof'), authorityPubkey.toBuffer(), proofIdBuf],
        programId
      )

      console.log('======================================================')
      console.log(' ⚓ SOLANA ON-CHAIN PROOF ANCHOR')
      console.log('======================================================')
      console.log(` Proof ID:     ${proofId}`)
      console.log(` Authority:    ${authorityPubkey.toBase58()}`)
      console.log(` Program ID:   ${programId.toBase58()}`)
      console.log(` Derived PDA:  ${pda.toBase58()}`)
      console.log(` Bump Seed:    ${bump}`)
      console.log(' Seeds:        [b"proof", authority, proof_id.to_le_bytes(8)]')
      console.log('======================================================\n')
    } else if (command === 'verify') {
      console.log(`\nFetching Proof #${target}...\n`)
      const res = await fetch(`${BASE_URL}/api/proof/${target}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      const data = await res.json()
      console.log(JSON.stringify(data, null, 2))
    } else if (command === 'eligibility') {
      let policy = {
        name: 'Superteam Bounty Default Policy',
        minVerifiedProofs: 3,
        minRecentProofs: 1,
        minStreak: 3,
        requiredProtocols: ['Solana'],
        requireGithubEvidence: true,
      }

      const policyFlagIdx = args.indexOf('--policy')
      if (policyFlagIdx !== -1 && args[policyFlagIdx + 1]) {
        const policyPath = args[policyFlagIdx + 1]
        const rawPolicy = fs.readFileSync(policyPath, 'utf-8')
        policy = JSON.parse(rawPolicy)
      }

      console.log(`\nEvaluating Policy "${policy.name}" for: ${target}...\n`)
      const res = await fetch(`${BASE_URL}/api/eligibility`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: target, policy }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      const result = await res.json()

      console.log('======================================================')
      console.log(` PROVN POLICY ELIGIBILITY: ${result.eligible ? '✅ ELIGIBLE' : '❌ NOT ELIGIBLE'}`)
      console.log(` Policy: ${result.policyName}`)
      console.log('======================================================')
      result.checks.forEach((c) => {
        const icon = c.passed ? '✓' : '✗'
        console.log(` [${icon}] ${c.label}`)
        console.log(`     Required: ${JSON.stringify(c.required)}`)
        console.log(`     Actual:   ${JSON.stringify(c.actual)}`)
      })
      console.log('======================================================\n')
    } else {
      console.error(`Unknown command: ${command}`)
      process.exit(1)
    }
  } catch (err) {
    console.error('PROVN CLI Error:', err.message)
    process.exit(1)
  }
}

main()
