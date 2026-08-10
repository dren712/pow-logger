# PROVN — Proof-of-Work Logger 🗿

**PROVN turns a developer's work claim into a cryptographically attributable, timestamp-bound, and permanently verifiable proof-of-work record.**

[![Build Status](https://github.com/dren712/pow-logger/actions/workflows/test.yml/badge.svg)](https://github.com/dren712/pow-logger/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Solana](https://img.shields.io/badge/Solana-Devnet%2FMainnet-00ff88?logo=solana)](https://solana.com)
[![Arweave](https://img.shields.io/badge/Storage-Arweave%20via%20Irys-00e5ff)](https://irys.xyz)

- **Live Platform:** [provn-sol.vercel.app](https://provn-sol.vercel.app)
- **Live Proof Artifact:** [provn-sol.vercel.app/u/AocAQAwVo8req1XQ9WfBmj5CLVrwic1xCiQrDKN2hF3p](https://provn-sol.vercel.app/u/AocAQAwVo8req1XQ9WfBmj5CLVrwic1xCiQrDKN2hF3p)
- **Technical Litepaper:** [`LITEPAPER.md`](LITEPAPER.md)
- **Engineering Roadmap:** [`ROADMAP.md`](ROADMAP.md)

---

## 🔍 Verification Comparison

| Method | Can be backdated? | Can be faked by someone else? | Cryptographically tied to identity? |
| :--- | :--- | :--- | :--- |
| **GitHub commit graph** | Yes (`git commit --date`) | Yes (commit under any name/email) | No |
| **Twitter / Discord build-log** | Yes (post anytime) | Yes (anyone can type it) | No |
| **POAP / attendance badge** | N/A | Yes (transferable) | No |
| **PROVN log entry** | **No** — validated against server clock (±15 min) | **No** — requires wallet's private key | **Yes** — Ed25519 SIWS signature |

Bounty hosts currently vet submitter activity manually, with no verifiable signal beyond a linked GitHub profile that can be gamed. PROVN gives a host a single link that resolves to cryptographically signed activity history.

---

## 🔗 Live Proof Artifact

**See it working:** [`provn-sol.vercel.app/u/AocAQAwVo8req1XQ9WfBmj5CLVrwic1xCiQrDKN2hF3p`](https://provn-sol.vercel.app/u/AocAQAwVo8req1XQ9WfBmj5CLVrwic1xCiQrDKN2hF3p) — 24 verified, wallet-signed proof-of-work entries across multiple weeks. Every entry here carries an Ed25519 signature where the signed timestamp must be within a strict 15-minute window of submission, preventing post-hoc signature forgery.

---

## ❓ Why Not Just Use GitHub?

GitHub provides strong evidence of code contribution, but it isn't designed as a portable cryptographic proof-of-work protocol tied to a developer-controlled Solana identity. PROVN's entries are signed by the developer's Solana wallet — ensuring the identity making the claim and the identity building reputation are cryptographically identical, every time.

---

## ⚡ Live GitHub Profile Badge Embed

Developers can embed their real-time PROVN badge directly inside any GitHub `README.md`:

```markdown
[![PROVN Reputation](https://provn-sol.vercel.app/api/badge/AocAQAwVo8req1XQ9WfBmj5CLVrwic1xCiQrDKN2hF3p.svg?d=2026-08-09)](https://provn-sol.vercel.app/u/AocAQAwVo8req1XQ9WfBmj5CLVrwic1xCiQrDKN2hF3p)
```

![PROVN Live Badge](https://provn-sol.vercel.app/api/badge/AocAQAwVo8req1XQ9WfBmj5CLVrwic1xCiQrDKN2hF3p.svg?d=2026-08-09)

> **GitHub Proxy Note**: GitHub routes markdown images through GitHub Camo Proxy (`camo.githubusercontent.com`). Because Camo caches by exact URL, appending a date parameter (e.g. `?d=2026-08-09`) forces GitHub Camo to bypass proxy staleness and fetch the latest live badge SVG.

---

## 🌏 Timezone Standard & Protocol Day-Boundary Specification

PROVN implements a **Universal Timezone Engine**:
- **Protocol Default (API & Badge Server)**: By default, server APIs (`/api/badge/[wallet]`, `/api/verify/[wallet]`, `/api/log-submit`) evaluate streak day boundaries using **Indian Standard Time (IST, UTC+5:30)** — aligning with Superteam India & Solana India builder cohorts.
- **Client UI (Automatic Browser Locale)**: Client interfaces (`ProfileClient.tsx`) automatically detect the builder's local browser timezone via `Intl.DateTimeFormat().resolvedOptions().timeZone` (e.g. `Asia/Kolkata` for India, `America/New_York` for US, `Europe/London` for UK).
- **API Timezone Overrides**: API endpoints support custom timezone parameters via query string:
  ```markdown
  https://provn-sol.vercel.app/api/badge/AocAQAwVo8req1XQ9WfBmj5CLVrwic1xCiQrDKN2hF3p.svg?tz=Asia/Kolkata
  https://provn-sol.vercel.app/api/badge/AocAQAwVo8req1XQ9WfBmj5CLVrwic1xCiQrDKN2hF3p.svg?tz=UTC
  ```

---

## 🌟 Overview

PROVN binds daily work logs to wallet-signed **Sign-In-With-Solana (SIWS)** payloads.

### Core Verification Flow
1. **Cryptographic Signing**: The developer signs a canonical SIWS message containing work content, timestamp, nonce, and proof links using their Solana wallet (Ed25519 keypair).
2. **Server-Side Attestation**: The backend re-derives the SIWS payload and verifies the signature off-chain using TweetNaCl (`nacl.sign.detached.verify`).
3. **Decentralized Archival**: Verified logs are packaged into a JSON envelope and stored permanently on **Arweave** via Irys Node #1.
4. **Database Indexing & RLS**: Log metadata is indexed in Supabase PostgreSQL, strictly protected by Row-Level Security (RLS) policies.
5. **Multi-Pillar Reputation Engine**: Computes builder levels (Apprentice → Grand Legend), streak trophies (7d, 30d, 100d), and skill badges.

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

## ⚡ Live System vs Roadmap Status

| Subsystem / Feature | Live Status | Implementation File |
| :--- | :--- | :--- |
| **Sign-In-With-Solana (SIWS)** | 🟢 **LIVE & VERIFIED** | [`app/lib/canonicalMessage.ts`](app/lib/canonicalMessage.ts) |
| **Ed25519 Off-Chain Verification** | 🟢 **LIVE & VERIFIED** | [`app/api/log-submit/route.ts`](app/api/log-submit/route.ts#L80-L107) |
| **Arweave Permanent Storage** | 🟢 **LIVE & VERIFIED** | [`app/lib/irysUploader.ts`](app/lib/irysUploader.ts) |
| **Serverless Rate Limiter** | 🟢 **LIVE & VERIFIED** | [`app/lib/rateLimiter.ts`](app/lib/rateLimiter.ts) |
| **Host Header Spoof Protection** | 🟢 **LIVE & VERIFIED** | [`app/lib/canonicalMessage.ts`](app/lib/canonicalMessage.ts#L59-L80) |
| **Postgres RLS Database Security** | 🟢 **LIVE & VERIFIED** | [`supabase/migrations/20260803_provn_security_hardening.sql`](supabase/migrations/20260803_provn_security_hardening.sql) |
| **Dynamic GitHub SVG Badges** | 🟢 **LIVE & VERIFIED** | [`app/api/badge/[wallet]/route.ts`](app/api/badge/[wallet]/route.ts) |
| **Metaplex cNFT Minting** | 🟡 **PHASE 4 (OPT-IN)** | [`app/lib/cnft.ts`](app/lib/cnft.ts) *(Feature-flagged off until Mainnet Merkle Tree deployment)* |

---

## 🛡️ Security Implementation Details

- **Cryptographic Binding**: Work logs are signed using the wallet's private key (`nacl.sign.detached.verify`). Verified in [`app/api/log-submit/route.ts`](app/api/log-submit/route.ts#L100).
- **Serverless Rate Limiting**: Enforces 10 requests per 15 minutes per IP and per Wallet Address. Implemented in [`app/lib/rateLimiter.ts`](app/lib/rateLimiter.ts).
- **Host Header Spoof Mitigation**: Host headers validated against whitelisted domains via `getVerifiedDomain()`. Implemented in [`app/lib/canonicalMessage.ts`](app/lib/canonicalMessage.ts#L59-L80).
- **Replay Attack Defense**: Timestamps older than 15 minutes (`900,000ms`) are rejected.
- **Database Signature Uniqueness**: PostgreSQL enforces a `UNIQUE INDEX` on the `signature` column to prevent replaying valid signatures.
- **Row-Level Security (RLS)**: Anonymous clients only have `SELECT` access. All database writes require server-side execution via `service_role`.
- **Atomic Quota RPC**: Quotas (3 logs/day) checked via `get_daily_log_count` SECURITY DEFINER RPC. Implemented in [`supabase/migrations/20260803_provn_security_hardening.sql`](supabase/migrations/20260803_provn_security_hardening.sql#L35).

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
# Protocol test suite (17 assertions)
npm test

# TypeScript type check
npx tsc --noEmit

# Production build
npm run build
```

---

## ⚠️ Known Limitations & Technical Trade-Offs

1. **Independent Arweave Verification Envelopes**: Every JSON envelope uploaded to Arweave includes `nonce`, `domain`, `walletAddress`, `timestamp`, `content`, `signature`, `evidenceUrl`, `githubUrl`, `canonicalMessage`, and `classification`, enabling third parties to independently verify Ed25519 signatures directly from Arweave gateways.
2. **cNFT Minting Status**: cNFT metadata generation and integration scaffolding are implemented in [`app/lib/cnft.ts`](app/lib/cnft.ts); on-chain Concurrent Merkle Tree minting is feature-flagged off until Phase 2 mainnet deployment.
3. **Serverless Fixed-Window Rate Limiting**: The rate limiter uses a fixed-window counter (`app/lib/rateLimiter.ts`), enforcing per-serverless instance quotas. Distributed sliding-window rate limiting via Upstash Redis is scheduled for Phase 3.
4. **Timezone Day Boundaries**: Protocol server APIs default to Indian Standard Time (IST, UTC+5:30) for Solana India / Superteam India builders, while client UI auto-detects browser locale (`Intl.DateTimeFormat`), and API endpoints accept custom `?tz=` query overrides.

---

## 📄 Documentation Links

- [Litepaper (`LITEPAPER.md`)](LITEPAPER.md) — Technical whitepaper on SIWS, Arweave, and RLS architecture.
- [Roadmap (`ROADMAP.md`)](ROADMAP.md) — Engineering phases and upcoming features.
- [Database Schema (`supabase/migrations/20260803_provn_security_hardening.sql`)](supabase/migrations/20260803_provn_security_hardening.sql) — PostgreSQL RLS policies & RPC functions.

---

## 📜 License

Distributed under the MIT License. See [`LICENSE`](LICENSE) for details.
