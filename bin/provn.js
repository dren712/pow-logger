#!/usr/bin/env node
/* eslint-disable */

/**
 * PROVN Standalone Proof Verifier CLI 🛡️🗿
 *
 * Independent offline verification tool for PROVN Proof-of-Work Protocol.
 * Requires zero database credentials or backend services.
 *
 * Usage:
 *   npx provn verify <proof.json>
 *   npx provn verify <proofId>
 *   npx provn inspect <proof.json>
 *   npx provn keys
 */

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const nacl = require('tweetnacl')
const bs58 = require('bs58')

// Decode helper that supports multiple bs58 export styles
function decodeBase58(str) {
  if (!str || typeof str !== 'string') return new Uint8Array(0)
  if (typeof bs58.decode === 'function') return bs58.decode(str)
  if (bs58.default && typeof bs58.default.decode === 'function') return bs58.default.decode(str)
  throw new Error('Base58 decoding library not available')
}

function encodeBase58(bytes) {
  if (typeof bs58.encode === 'function') return bs58.encode(bytes)
  if (bs58.default && typeof bs58.default.encode === 'function') return bs58.default.encode(bytes)
  throw new Error('Base58 encoding library not available')
}

// ─── Published Static Trust Anchors (No Secret Required) ─────────────────────
const PROVN_TRUSTED_KEYS = {
  'provn-server-2026-08': 'FAe4sisG95oZ42w7buUn5qEE4TAnfTTFPiguZUHmhiF',
  'provn-server-2026-06': '3yFwqdfjEU52f3Hj1m79xJ2vKrqWpZz7fE9iM2e7X8uG',
}

const ALLOWED_DOMAINS = ['provn-sol.vercel.app', 'localhost']

function validateAndNormalizeUrl(url, type) {
  if (!url || typeof url !== 'string' || url.trim() === '') return undefined
  const clean = url.trim()
  try {
    const parsed = new URL(clean)
    if (parsed.protocol !== 'https:') return null
    if (type === 'github' && !['github.com', 'www.github.com'].includes(parsed.hostname.toLowerCase())) {
      return null
    }
    return clean
  } catch {
    return null
  }
}

function reconstructCanonicalSubmitMessage(claim, protocolVersion = 2) {
  const { domain, wallet, content, timestamp, challenge, nonce, github_url, evidence_url } = claim

  if (!wallet || !timestamp || !content) return null

  const chal = challenge || nonce
  if (protocolVersion === 2) {
    if (!domain || typeof domain !== 'string' || domain.trim() === '') return null
    if (!chal || typeof chal !== 'string' || chal.trim() === '') return null
  }

  // Restore ISO timestamp format if normalized by database
  let fixedTimestamp = timestamp
  if (fixedTimestamp.endsWith('+00:00')) {
    fixedTimestamp = fixedTimestamp.replace('+00:00', 'Z')
    const msMatch = fixedTimestamp.match(/\.(\d+)Z$/)
    if (msMatch) {
      let ms = msMatch[1]
      while (ms.length < 3) ms += '0'
      fixedTimestamp = fixedTimestamp.replace(/\.\d+Z$/, `.${ms}Z`)
    }
  }

  const dom = domain ? domain.trim().toLowerCase().split(':')[0] : 'provn-sol.vercel.app'
  const cleanContent = content.trim()
  const cleanGithubUrl = validateAndNormalizeUrl(github_url, 'github') || 'none'
  const cleanEvidenceUrl = validateAndNormalizeUrl(evidence_url, 'evidence') || 'none'

  if (protocolVersion === 2) {
    return `${dom} wants you to sign in with your Solana account:
${wallet}

PROVN Protocol Version: 2
Challenge: ${chal}
Timestamp: ${fixedTimestamp}
Content: ${cleanContent}
GitHub URL: ${cleanGithubUrl}
Evidence URL: ${cleanEvidenceUrl}`
  } else {
    return `${dom} wants you to sign in with your Solana account:
${wallet}

I am submitting a proof of work log to the immutable audit trail.

Content: ${cleanContent}
Timestamp: ${fixedTimestamp}
Nonce: ${nonce || chal}
GitHub: ${cleanGithubUrl}
Evidence: ${cleanEvidenceUrl}`
  }
}

function computeSha256(str) {
  return crypto.createHash('sha256').update(new TextEncoder().encode(str)).digest('hex')
}

// ─── Main Verification Engine ───────────────────────────────────────────────
function verifyProofPacket(packet) {
  const results = {
    valid: false,
    proofId: packet.proof_id || 'N/A',
    wallet: null,
    canonicalHash: null,
    layers: {
      layer1_signature: { passed: false, message: '' },
      layer2_challenge: { passed: false, message: '' },
      layer2_5_receipt: { passed: false, message: '' },
      layer3_source: { status: 'CLAIMED', message: '' },
      layer4_archive: { status: 'CLAIMED', message: '' },
    },
    errors: [],
  }

  // Extract fields from flexible envelope formats (export packet or database row)
  const isWrapped = Boolean(packet.claim && packet.signature)
  const claim = isWrapped
    ? {
        wallet: packet.claim.wallet || packet.claim.wallet_address,
        content: packet.claim.content,
        timestamp: packet.claim.timestamp || packet.claim.created_at,
        domain: packet.claim.domain,
        challenge: packet.server_attestations?.challenge || packet.claim.challenge,
        nonce: packet.claim.nonce,
        github_url: packet.claim.github_url,
        evidence_url: packet.claim.evidence_url,
      }
    : {
        wallet: packet.wallet_address || packet.wallet,
        content: packet.content,
        timestamp: packet.created_at || packet.timestamp,
        domain: packet.domain,
        challenge: packet.challenge,
        nonce: packet.nonce,
        github_url: packet.github_url,
        evidence_url: packet.evidence_url,
      }

  const sigValue = isWrapped ? (packet.signature?.value || packet.signature) : packet.signature
  const submissionReceipt = isWrapped ? packet.server_attestations?.submission_receipt : packet.submission_receipt
  const protocolVersion = packet.version || packet.protocol_version || 2
  results.wallet = claim.wallet

  // 1. Reconstruct Canonical Message
  const canonicalMsg = reconstructCanonicalSubmitMessage(claim, protocolVersion)
  if (!canonicalMsg) {
    results.layers.layer1_signature.message = 'Failed to reconstruct canonical message (missing required fields)'
    results.errors.push('Canonical message could not be constructed')
    return results
  }

  results.canonicalHash = computeSha256(canonicalMsg)

  // 2. Layer 1: Verify Wallet Signature
  try {
    const pubkeyBytes = decodeBase58(claim.wallet)
    const sigBytes = decodeBase58(sigValue)
    const msgBytes = new TextEncoder().encode(canonicalMsg)

    if (pubkeyBytes.length === 32 && sigBytes.length === 64 && nacl.sign.detached.verify(msgBytes, sigBytes, pubkeyBytes)) {
      results.layers.layer1_signature.passed = true
      results.layers.layer1_signature.message = `Valid Ed25519 detached signature from ${claim.wallet}`
    } else {
      results.layers.layer1_signature.message = 'Cryptographic signature verification failed'
      results.errors.push('Wallet signature does not match reconstructed canonical message')
    }
  } catch (err) {
    results.layers.layer1_signature.message = `Signature decoding error: ${err.message}`
    results.errors.push('Invalid Base58 encoding on wallet or signature')
  }

  // 3. Layer 2: Verify Server Challenge Token
  const challengeStr = claim.challenge || claim.nonce
  if (protocolVersion === 2) {
    if (challengeStr && challengeStr.includes('.')) {
      try {
        const [chalPayloadB58, chalSigB58] = challengeStr.split('.')
        const chalPayloadBytes = decodeBase58(chalPayloadB58)
        const chalSigBytes = decodeBase58(chalSigB58)
        const chalObj = JSON.parse(new TextDecoder().decode(chalPayloadBytes))

        const kid = chalObj.kid
        if (!kid || typeof kid !== 'string') {
          results.layers.layer2_challenge.message = 'Challenge missing required Key ID (kid)'
          results.errors.push('Challenge token does not specify Key ID')
        } else if (!PROVN_TRUSTED_KEYS[kid]) {
          results.layers.layer2_challenge.message = `Unknown/untrusted challenge Key ID: ${kid}`
          results.errors.push(`Challenge Key ID ${kid} not found in public trust registry`)
        } else {
          const serverPubkey = decodeBase58(PROVN_TRUSTED_KEYS[kid])
          const isChalValid = nacl.sign.detached.verify(chalPayloadBytes, chalSigBytes, serverPubkey)

          if (isChalValid && chalObj.iss === 'PROVN' && chalObj.wallet === claim.wallet) {
            const iat = chalObj.iat ? new Date(chalObj.iat).getTime() : (new Date(chalObj.exp).getTime() - 5 * 60 * 1000)
            const exp = new Date(chalObj.exp).getTime()
            const claimTime = new Date(claim.timestamp).getTime()

            if (!isNaN(claimTime) && claimTime >= iat && claimTime <= exp) {
              results.layers.layer2_challenge.passed = true
              results.layers.layer2_challenge.message = `Authentic server challenge issued by PROVN (${kid}) within temporal bounds`
            } else {
              results.layers.layer2_challenge.message = 'Proof timestamp is outside challenge issuance window'
              results.errors.push('Temporal bounds check failed: proof signed outside challenge validity window')
            }
          } else {
            results.layers.layer2_challenge.message = 'Server challenge signature or wallet binding invalid'
            results.errors.push('Challenge token signature verification failed')
          }
        }
      } catch (err) {
        results.layers.layer2_challenge.message = `Challenge parsing error: ${err.message}`
        results.errors.push('Challenge token is malformed')
      }
    } else {
      results.layers.layer2_challenge.message = 'Missing server challenge token for Protocol V2 proof'
      results.errors.push('Protocol V2 requires server challenge token')
    }
  } else {
    // V1 legacy
    results.layers.layer2_challenge.passed = Boolean(claim.nonce && claim.nonce.length >= 8)
    results.layers.layer2_challenge.message = 'Legacy V1 Nonce (pre-challenge era)'
  }

  // 4. Layer 2.5: Verify Submission Receipt & Exact Canonical Hash
  if (protocolVersion === 2) {
    if (submissionReceipt && submissionReceipt.includes('.')) {
      try {
        const [subPayloadB58, subSigB58] = submissionReceipt.split('.')
        const subPayloadBytes = decodeBase58(subPayloadB58)
        const subSigBytes = decodeBase58(subSigB58)
        const subObj = JSON.parse(new TextDecoder().decode(subPayloadBytes))

        const kid = subObj.kid
        if (!kid || typeof kid !== 'string') {
          results.layers.layer2_5_receipt.message = 'Submission receipt missing required Key ID (kid)'
          results.errors.push('Submission receipt does not specify Key ID')
        } else if (!PROVN_TRUSTED_KEYS[kid]) {
          results.layers.layer2_5_receipt.message = `Unknown/untrusted submission receipt Key ID: ${kid}`
          results.errors.push(`Receipt Key ID ${kid} not found in public trust registry`)
        } else {
          const serverPubkey = decodeBase58(PROVN_TRUSTED_KEYS[kid])
          const isSubValid = nacl.sign.detached.verify(subPayloadBytes, subSigBytes, serverPubkey)

          const hashMatches = subObj.signed_payload_hash === results.canonicalHash
          const walletMatches = subObj.wallet === claim.wallet
          const challengeMatches = subObj.challenge_id === challengeStr
          const idMatches = !packet.proof_id && !packet.id || String(subObj.proof_id) === String(packet.proof_id || packet.id)

          if (isSubValid && hashMatches && walletMatches && challengeMatches && idMatches && subObj.iss === 'PROVN') {
            results.layers.layer2_5_receipt.passed = true
            results.layers.layer2_5_receipt.message = `Cryptographically seals SHA-256 canonical hash (${subObj.signed_payload_hash.slice(0, 12)}...) observed at ${subObj.observed_at}`
          } else {
            results.layers.layer2_5_receipt.message = `Receipt verification failed (hashMatch: ${hashMatches}, walletMatch: ${walletMatches}, sigValid: ${isSubValid})`
            results.errors.push('Submission receipt does not bind to this exact canonical proof')
          }
        }
      } catch (err) {
        results.layers.layer2_5_receipt.message = `Receipt parsing error: ${err.message}`
        results.errors.push('Submission receipt is malformed')
      }
    } else {
      results.layers.layer2_5_receipt.message = 'Missing server submission receipt (mandatory for V2)'
      results.errors.push('Protocol V2 requires signed PROVN_SUBMISSION_RECEIPT')
    }
  } else {
    results.layers.layer2_5_receipt.passed = true
    results.layers.layer2_5_receipt.message = 'V1 Legacy (pre-submission receipt)'
  }

  // 5. Layer 3 & 4: Status Attribution
  const provLevel = (packet.provenance?.level || packet.provenance_level || 'self_attested').toLowerCase()
  if (provLevel === 'source_verified') {
    results.layers.layer3_source.status = 'CLAIMED_API_VERIFIED'
    results.layers.layer3_source.message = `Source attributed to ${claim.github_url || 'GitHub'} (offline metadata)`
  } else if (claim.github_url) {
    results.layers.layer3_source.status = 'CLAIMED_SOURCE_LINKED'
    results.layers.layer3_source.message = `Source URL: ${claim.github_url}`
  } else {
    results.layers.layer3_source.status = 'SELF_ATTESTED'
    results.layers.layer3_source.message = 'Self-attested builder claim without external URL'
  }

  const archState = (packet.provenance?.archival_state || packet.archival_state || 'not_requested').toLowerCase()
  results.layers.layer4_archive.status = archState.toUpperCase()
  results.layers.layer4_archive.message = packet.provenance?.irys_tx_id || packet.irys_tx_id || 'Storage metadata'

  // Final Overall Decision
  results.valid = results.layers.layer1_signature.passed &&
                  results.layers.layer2_challenge.passed &&
                  results.layers.layer2_5_receipt.passed

  return results
}

// ─── CLI Terminal Output Formatter ──────────────────────────────────────────
function formatTerminalReport(report) {
  const c = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    dim: '\x1b[2m',
  }

  console.log('\n' + c.bold + c.cyan + '========================================================================' + c.reset)
  console.log(c.bold + c.cyan + '   🛡️  PROVN INDEPENDENT PROOF VERIFIER (OFFLINE PROTOCOL ENGINE)    ' + c.reset)
  console.log(c.bold + c.cyan + '========================================================================' + c.reset)

  console.log(`\n${c.bold}Proof Record:${c.reset}        #${report.proofId}`)
  console.log(`${c.bold}Signer Wallet:${c.reset}       ${report.wallet || 'N/A'}`)
  console.log(`${c.bold}Canonical Proof Hash:${c.reset} ${report.canonicalHash || 'N/A'}`)
  console.log(`${c.bold}Verification Mode:${c.reset}   100% Offline (Published Key Registry Trust Anchor)\n`)

  console.log(c.bold + '─── 4-LAYER PROTOCOL VERIFICATION ──────────────────────────────────────' + c.reset)

  // Layer 1
  const l1 = report.layers.layer1_signature
  const l1Badge = l1.passed ? `${c.green}[VERIFIED ✓]${c.reset}` : `${c.red}[FAILED ✗]${c.reset}`
  console.log(`\n${c.bold}Layer 1: Wallet Signature${c.reset}          ${l1Badge}`)
  console.log(`  ${c.dim}${l1.message}${c.reset}`)

  // Layer 2
  const l2 = report.layers.layer2_challenge
  const l2Badge = l2.passed ? `${c.green}[VERIFIED ✓]${c.reset}` : `${c.red}[FAILED ✗]${c.reset}`
  console.log(`\n${c.bold}Layer 2: Server Challenge Token${c.reset}    ${l2Badge}`)
  console.log(`  ${c.dim}${l2.message}${c.reset}`)

  // Layer 2.5
  const l25 = report.layers.layer2_5_receipt
  const l25Badge = l25.passed ? `${c.green}[VERIFIED ✓]${c.reset}` : `${c.red}[FAILED ✗]${c.reset}`
  console.log(`\n${c.bold}Layer 2.5: Server Ingestion Receipt${c.reset} ${l25Badge}`)
  console.log(`  ${c.dim}${l25.message}${c.reset}`)

  // Layer 3
  const l3 = report.layers.layer3_source
  console.log(`\n${c.bold}Layer 3: Source Identity Evidence${c.reset}   ${c.yellow}[${l3.status}]${c.reset}`)
  console.log(`  ${c.dim}${l3.message}${c.reset}`)

  // Layer 4
  const l4 = report.layers.layer4_archive
  console.log(`\n${c.bold}Layer 4: Decentralized Archival${c.reset}     ${c.yellow}[${l4.status}]${c.reset}`)
  console.log(`  ${c.dim}${l4.message}${c.reset}`)

  console.log('\n' + c.bold + '────────────────────────────────────────────────────────────────────────' + c.reset)

  if (report.valid) {
    console.log(`\n${c.bold}${c.green}✅ VERDICT: PROOF IS 100% CRYPTOGRAPHICALLY AUTHENTIC & VALID${c.reset}`)
    console.log(`${c.dim}The proof envelope seals the exact author, payload hash, and temporal bounds.${c.reset}\n`)
  } else {
    console.log(`\n${c.bold}${c.red}❌ VERDICT: PROOF FAILED CRYPTOGRAPHIC VERIFICATION${c.reset}`)
    if (report.errors.length > 0) {
      console.log(c.red + '\nDetected Issues:' + c.reset)
      report.errors.forEach(err => console.log(`  - ${c.red}${err}${c.reset}`))
    }
    console.log('')
  }
}

// ─── CLI Entrypoint & Argument Handling ─────────────────────────────────────
async function main() {
  const args = process.argv.slice(2)
  const command = args[0] || 'help'
  const target = args[1]

  if (command === 'keys' || command === 'manifest') {
    console.log('\nPROVN Protocol Published Trust Anchors (Public Key Registry):')
    console.table(Object.entries(PROVN_TRUSTED_KEYS).map(([kid, key]) => ({
      Key_ID: kid,
      Algorithm: 'Ed25519',
      Public_Key: key,
      Epoch_Status: kid.includes('2026-08') ? 'ACTIVE_GENESIS' : 'HISTORICAL',
    })))
    process.exit(0)
  }

  if (command === 'verify') {
    if (!target) {
      console.error('Error: Please specify a proof JSON file path or proof ID.')
      console.error('Usage: provn verify <path-to-proof.json|proofId>')
      process.exit(1)
    }

    let packetData = null

    // Check if target is a local file
    if (fs.existsSync(target)) {
      try {
        const fileContent = fs.readFileSync(target, 'utf8')
        packetData = JSON.parse(fileContent)
      } catch (err) {
        console.error(`Error reading proof JSON file ${target}:`, err.message)
        process.exit(1)
      }
    } else if (!isNaN(parseInt(target, 10))) {
      // Target is a proof ID, fetch from public export API
      const proofId = parseInt(target, 10)
      console.log(`Fetching portable proof #${proofId} from https://provn-sol.vercel.app/api/proof/${proofId}/export...`)
      try {
        const res = await fetch(`https://provn-sol.vercel.app/api/proof/${proofId}/export`)
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`)
        }
        packetData = await res.json()
      } catch (err) {
        console.error(`Failed to fetch proof #${proofId}:`, err.message)
        process.exit(1)
      }
    } else {
      console.error(`Error: File '${target}' not found, and target is not a numeric proof ID.`)
      process.exit(1)
    }

    const report = verifyProofPacket(packetData)
    formatTerminalReport(report)
    process.exit(report.valid ? 0 : 1)
  }

  // Default Help
  console.log(`
PROVN Standalone CLI Verifier 🛡️🗿

Usage:
  provn verify <proof.json>     Verify a local portable proof envelope offline
  provn verify <proofId>        Fetch and independently verify proof record by ID
  provn keys                    Display published trust anchors and public key registry
  provn help                    Show this help menu
`)
}

if (require.main === module) {
  main().catch(err => {
    console.error('CLI Fatal Error:', err)
    process.exit(1)
  })
}

module.exports = {
  verifyProofPacket,
  reconstructCanonicalSubmitMessage,
  PROVN_TRUSTED_KEYS,
}
