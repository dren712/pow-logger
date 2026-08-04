# PROVN — Proof-of-Work Logger

Verifiable, wallet-attested build logs for Solana developers.

[![Build Status](https://github.com/dren712/pow-logger/actions/workflows/test.yml/badge.svg)](https://github.com/dren712/pow-logger/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

- **Live Application:** [provn-sol.vercel.app](https://provn-sol.vercel.app)
- **Repository:** [github.com/dren712/pow-logger](https://github.com/dren712/pow-logger)

---

## Overview

PROVN is a lightweight reputation protocol for Solana builders. It provides a tamper-evident record of daily development activity by binding each work log to a wallet-signed **Sign-In-With-Solana (SIWS)** payload.

### Core Flow
1. **Sign Prompt**: The user signs a canonical SIWS message containing their work description, timestamp, nonce, and evidence links.
2. **Server Verification**: The backend verifies the Ed25519 signature off-chain using TweetNaCl.
3. **Decentralized Archival**: Verified logs are packaged into a JSON envelope and archived permanently on Arweave via Irys Node #1.
4. **Database Indexing**: The log and Arweave receipt ID are stored in Supabase PostgreSQL, protected by Row-Level Security (RLS).

---

## System Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                    User Browser (Client)                    │
│   Solana Wallet ──► Sign Canonical SIWS (Ed25519 Prompt)    │
└──────────────────────────────┬──────────────────────────────┘
                               │ POST /api/log-submit
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Next.js API Engine Server                   │
│   • Rate Limiting (10 req/hr per IP & Wallet)               │
│   • Replay Protection (15-min timestamp window)             │
│   • Off-chain Ed25519 Signature Verification (TweetNaCl)    │
│   • URL Normalization & Sanitization                        │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
               ▼                              ▼
┌──────────────────────────────┐ ┌──────────────────────────┐
│  ① Supabase PostgreSQL DB    │ │ ② Irys Node #1 (Arweave) │
│  • Public SELECT Access      │ │ Permanent Decentralized  │
│  • Direct Writes Denied RLS  │ │ Immutable JSON Envelope  │
│  • Signature Unique Index    │ │ Archival Storage         │
└──────────────────────────────┘ └──────────────────────────┘
```

---

## Security Model

PROVN implements several layers of verification to protect log authenticity:

- **Cryptographic Attestation**: Work logs are signed using the wallet's private key (`nacl.sign.detached.verify`). Any modification to the text, timestamp, nonce, or evidence URLs invalidates the signature.
- **Replay Attack Mitigation**: Payloads older than 15 minutes (`Math.abs(now - ts) > 900,000ms`) are rejected.
- **Signature Uniqueness**: PostgreSQL enforces a `UNIQUE` index on the `signature` column to prevent reusing valid signatures.
- **Row-Level Security (RLS)**: Public clients only have `SELECT` access to the Supabase database. All database writes are processed through server-side API routes.
- **Rate Limiting**: Requests are rate-limited to 10 submissions per hour per IP and wallet address.

---

## Canonical SIWS Format

Log submissions use a structured SIWS message format defined in [`app/lib/canonicalMessage.ts`](app/lib/canonicalMessage.ts):

```text
provn-sol.vercel.app wants you to sign in with your Solana account:
<wallet_address>

SIWS Schema Version: 1
Nonce: <unique_base58_nonce>
Timestamp: <iso_timestamp>
Content: <work_log_text>
GitHub URL: <normalized_github_url_or_none>
Evidence URL: <normalized_evidence_url_or_none>
```

---

## API Reference

### 1. Submit Log (`POST /api/log-submit`)

**Request Payload:**
```json
{
  "content": "Implemented Ed25519 SIWS signature verification logic",
  "walletAddress": "5K...wallet_public_key",
  "timestamp": "2026-08-04T02:00:00.000Z",
  "nonce": "k9x2mP7qL1wN4vR8",
  "signature": "3Z...base58_signature",
  "githubUrl": "https://github.com/dren712/pow-logger/pull/1",
  "evidenceUrl": "https://provn-sol.vercel.app"
}
```

**Response (`200 OK`):**
```json
{
  "success": true,
  "log": {
    "id": 44,
    "content": "Implemented Ed25519 SIWS signature verification logic",
    "wallet_address": "5K...",
    "irys_tx_id": "6cY1LUHZY4nqMUrKo74ku7pc7EtZZmqK8JGdQ2mFxoTP",
    "created_at": "2026-08-04T02:00:00.000Z"
  },
  "irysTxId": "6cY1LUHZY4nqMUrKo74ku7pc7EtZZmqK8JGdQ2mFxoTP",
  "gatewayUrl": "https://gateway.irys.xyz/6cY1LUHZY4nqMUrKo74ku7pc7EtZZmqK8JGdQ2mFxoTP"
}
```

### 2. Verify Builder Profile (`GET /api/verify/[wallet]`)

Returns public profile statistics, activity heatmap data, and verified Arweave gateway links for a given wallet address.

---

## Database Migration

The Supabase schema and RLS policies are located in [`supabase/migrations/20260803_provn_security_hardening.sql`](supabase/migrations/20260803_provn_security_hardening.sql).

Key database constraints:
- RLS policy: Public `SELECT` allowed; direct `INSERT`/`UPDATE`/`DELETE` denied.
- Unique signature index: `CREATE UNIQUE INDEX idx_logs_signature_unique ON public.logs (signature);`
- Daily quota function: `get_daily_log_count(p_wallet, p_start_time)`

---

## Development & Testing

### Prerequisites
- Node.js 20+
- npm

### Setup

```bash
# Clone the repository
git clone https://github.com/dren712/pow-logger.git
cd pow-logger

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Run development server
npm run dev
```

### Testing & Verification

```bash
# Run protocol test suite
npm test

# Run TypeScript type check
npx tsc --noEmit

# Run linter
npm run lint

# Production build
npm run build
```

---

## Project Status

- **Live & Production Ready**: Ed25519 SIWS signature verification, Supabase RLS database indexing, and Irys/Arweave permanent archival.
- **Future Roadmap**: Metaplex Bubblegum compressed NFT (cNFT) proof credentials (minting logic built, reserved for future Merkle tree deployment).

---

## License

Distributed under the MIT License. See [`LICENSE`](LICENSE) for more information.

