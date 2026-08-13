#!/usr/bin/env node

/**
 * PROVN Command Line Interface ($0 Free-Tier)
 *
 * Usage:
 *   node cli/provn.mjs profile <wallet>
 *   node cli/provn.mjs reputation <wallet>
 *   node cli/provn.mjs verify <proofId>
 */

const BASE_URL = process.env.PROVN_URL || 'https://provn-sol.vercel.app'

async function main() {
  const args = process.argv.slice(2)
  const command = args[0]
  const target = args[1]

  if (!command || !target) {
    console.log(`
PROVN CLI 🗿 — Verifiable Proof-of-Work on Solana

Usage:
  provn profile <wallet>       Fetch full Builder Passport
  provn reputation <wallet>    Display reputation summary & active streak
  provn verify <proofId>       Fetch and inspect an individual proof

Options:
  --url <url>                  Custom PROVN endpoint (default: https://provn-sol.vercel.app)
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
      console.log(` Verified Proofs: ${rep.totalProofs}`)
      console.log(` Active Streak:   🔥 ${rep.currentStreak} Days (Longest: ${rep.longestStreak}d)`)
      console.log(` Archival Rate:   📦 ${rep.archivalSuccessRate}% on Arweave`)
      console.log(` Top Skills:      ${rep.skills.map((s) => '#' + s.name).join(', ') || 'None'}`)
      console.log(` Protocols:       ${rep.protocols.map((p) => '⚡ ' + p.name).join(', ') || 'None'}`)
      console.log(` Achievements:    ${rep.achievements.filter((a) => a.earned).length} earned`)
      console.log('======================================================\n')
    } else if (command === 'verify') {
      console.log(`\nFetching Proof #${target}...\n`)
      const res = await fetch(`${BASE_URL}/api/proof/${target}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      const data = await res.json()
      console.log(JSON.stringify(data, null, 2))
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
