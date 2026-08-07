# PROVN — Proof-of-Work Logger 🗿

**Verifiable, wallet-attested build logs and reputation foundry for Solana developers.**

[![Build Status](https://github.com/dren712/pow-logger/actions/workflows/test.yml/badge.svg)](https://github.com/dren712/pow-logger/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Solana](https://img.shields.io/badge/Solana-Devnet%2FMainnet-00ff88?logo=solana)](https://solana.com)
[![Arweave](https://img.shields.io/badge/Storage-Arweave%20via%20Irys-00e5ff)](https://irys.xyz)

- **Live Platform:** [provn-sol.vercel.app](https://provn-sol.vercel.app)
- **Technical Litepaper:** [`LITEPAPER.md`](LITEPAPER.md)
- **Engineering Roadmap:** [`ROADMAP.md`](ROADMAP.md)

---

## ⚡ Live GitHub Profile Badge Embed

Developers can embed their real-time PROVN reputation badge directly inside any GitHub `README.md`:

```markdown
[![PROVN Reputation](https://provn-sol.vercel.app/api/badge/YOUR_SOLANA_WALLET_ADDRESS.svg)](https://provn-sol.vercel.app/u/YOUR_SOLANA_WALLET_ADDRESS)
```

**Live SVG Output Example:**

![PROVN Live Badge](https://provn-sol.vercel.app/api/badge/FqDWkZazJro7sQ4c5omrbyqzuWipC7QEPdjgCEp3ucAs.svg)

---

## 🌟 Overview

PROVN is a decentralized reputation protocol for Solana builders. It provides a tamper-evident, permanent record of daily development activity by binding each work log to a wallet-signed **Sign-In-With-Solana (SIWS)** payload.

### Core Verification Flow
1. **Cryptographic Signing**: The developer signs a canonical SIWS message containing work content, timestamp, nonce, and proof links using their Solana wallet (Ed25519 keypair).
2. **Server-Side Attestation**: The backend re-derives the SIWS payload and verifies the signature off-chain using TweetNaCl (`nacl.sign.detached.verify`).
3. **Decentralized Archival**: Verified logs are packaged into a JSON envelope and stored permanently on **Arweave** via Irys Node #1.
4. **Database Indexing & RLS**: Log metadata is indexed in Supabase PostgreSQL, strictly protected by Row-Level Security (RLS) policies.
5. **Multi-Pillar Reputation Engine**: Computes builder levels (Apprentice → Grand Legend), streak trophies (7d, 30d, 100d), and LeetCode/Codeforces-style skill badges.

---

## 🏗️ System Architecture

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                            User Browser (Client)                            │
│   Solana Wallet ──► Sign Canonical SIWS (Ed25519 Prompt)                    │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ POST /api/log-submit
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Next.js API Engine Server                           │
│   • Daily Quota Enforcement (3 logs/day via get_daily_log_count RPC)        │
│   • Replay Protection (15-minute strict timestamp window)                   │
│   • Off-chain Ed25519 Signature Verification (TweetNaCl)                    │
│   • Automated Skill & Category Classifier (16 regex categories)             │
└──────────────────────┬──────────────────────────────┬───────────────────────┘
                       │                              │
                       ▼                              ▼
┌──────────────────────────────┐ ┌────────────────────────────────────────────┐
│  ① Supabase PostgreSQL DB    │ │  ② Irys Node #1 (Arweave Gateway)          │
│  • Public Read SELECT        │ │  • Permanent Immutable Storage             │
│  • Writes Restricted (RLS)   │ │  • 2KB JSON Log Envelope                   │
│  • Signature Unique Index    │ │  • Zero Fee (<100KB Free Tier)              │
└──────────────────────────────┘ └────────────────────────────────────────────┘
```

---

## 🏆 Reputation & Badge System

PROVN implements a 3-tier reputation model:

- **Tier 1: Dynamic Evolving Builder Levels** (Apprentice → Verified Craftsman → Senior Architect → Protocol Master → Grand Legend).
- **Tier 2: Streak Milestone Trophies** (Earned at 7, 14, 30, 60, 100, and 365 consecutive daily logs).
- **Tier 3: LeetCode / Codeforces Skill Badges**:
  - ⚓ **Anchor Specialist**: 3+ Solana / Anchor smart contract logs.
  - 🛡️ **Security Auditor**: 2+ Security or Auth work logs.
  - 🐙 **Open Source Builder**: 3+ Verified GitHub PR/Commit links.
  - 📜 **Arweave Archivist**: 5+ Permanent Arweave archived logs.
  - 💯 **Century Club**: 100+ Total verified proof logs.

---

## 🛡️ Security Model

- **Cryptographic Binding**: Work logs are signed using the wallet's private key (`nacl.sign.detached.verify`). Any alteration to content, URLs, timestamp, or nonce breaks verification.
- **Replay Attack Defense**: Timestamps older than 15 minutes (`900,000ms`) are rejected.
- **Database Signature Uniqueness**: PostgreSQL enforces a `UNIQUE INDEX` on the `signature` column to prevent replaying valid signatures.
- **Row-Level Security (RLS)**: Anonymous clients only have `SELECT` access. All database writes require server-side execution via `service_role`.
- **Atomic Quota RPC**: Quotas (3 logs/day) checked via `get_daily_log_count` SECURITY DEFINER RPC.

---

## 📖 Canonical SIWS Specification

Log submissions use a canonical SIWS message format defined in [`app/lib/canonicalMessage.ts`](app/lib/canonicalMessage.ts):

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

## 📡 API Reference

### 1. Submit Verified Log (`POST /api/log-submit`)

**Request Payload:**
```json
{
  "content": "Implemented Ed25519 SIWS verification logic",
  "walletAddress": "FqDW...wallet_address",
  "timestamp": "2026-08-08T02:00:00.000Z",
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
  "log": { "id": 44, "content": "...", "irys_tx_id": "6cY1..." },
  "streak": 7,
  "builderLevel": { "level": 2, "title": "Verified Craftsman", "emoji": "⚒️" },
  "newMilestone": { "days": 7, "title": "7-Day Streak", "emoji": "🔥" },
  "gatewayUrl": "https://gateway.irys.xyz/6cY1..."
}
```

### 2. Live GitHub SVG Badge API (`GET /api/badge/[wallet].svg`)
Returns a dynamic, cached SVG badge for embedding in markdown documents.

### 3. Builder Profile API (`GET /api/verify/[wallet]`)
Returns complete builder profile statistics, level status, earned badges, and recent Arweave receipts.

---

## 💻 Local Development & Setup

### Prerequisites
- Node.js 20+
- npm

### Installation

```bash
# Clone repository
git clone https://github.com/dren712/pow-logger.git
cd pow-logger

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Start development server
npm run dev
```

### Testing & Verification

```bash
# Protocol test suite (13 tests)
npm test

# TypeScript type check
npx tsc --noEmit

# Production build
npm run build
```

---

## 📄 Documentation Links

- [Litepaper (`LITEPAPER.md`)](LITEPAPER.md) — Technical whitepaper on SIWS, Arweave, and RLS architecture.
- [Roadmap (`ROADMAP.md`)](ROADMAP.md) — Engineering phases and upcoming features.
- [Database Schema (`supabase/migrations/20260803_provn_security_hardening.sql`)](supabase/migrations/20260803_provn_security_hardening.sql) — PostgreSQL RLS policies & RPC functions.

---

## 📜 License

Distributed under the MIT License. See [`LICENSE`](LICENSE) for details.
