# PROVN — Solana-Native Cryptographic Proof-of-Work Protocol 🗿🛡️

**PROVN turns wallet-signed developer work logs into cryptographically attributable, timestamp-bound, and permanently archived proof-of-work credentials.**

[![CI Test Suite](https://github.com/dren712/pow-logger/actions/workflows/test.yml/badge.svg)](https://github.com/dren712/pow-logger/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Solana](https://img.shields.io/badge/Solana-Devnet%2FMainnet-00ff88?logo=solana)](https://solana.com)
[![Arweave](https://img.shields.io/badge/Storage-Arweave%20via%20Irys-00e5ff)](https://irys.xyz)
[![Quality Gate](https://img.shields.io/badge/Tests-58%2F58%20Passed-brightgreen)](tests/protocol.test.ts)

- **Live Protocol Web App:** [provn-sol.vercel.app](https://provn-sol.vercel.app)
- **Live Builder Passport:** [provn-sol.vercel.app/u/AocAQAwVo8req1XQ9WfBmj5CLVrwic1xCiQrDKN2hF3p](https://provn-sol.vercel.app/u/AocAQAwVo8req1XQ9WfBmj5CLVrwic1xCiQrDKN2hF3p)
- **Interactive Developer API Docs:** [provn-sol.vercel.app/docs/api](https://provn-sol.vercel.app/docs/api)
- **Superteam Earn Bounty Gating Demo:** [provn-sol.vercel.app/demo/bounty](https://provn-sol.vercel.app/demo/bounty)
- **Grant Evidence Dashboard:** [provn-sol.vercel.app/admin/evidence](https://provn-sol.vercel.app/admin/evidence)
- **Technical Litepaper:** [`LITEPAPER.md`](LITEPAPER.md)
- **Engineering Roadmap:** [`ROADMAP.md`](ROADMAP.md)

---

## 🔍 Verification Comparison

| Feature / Attack Vector | GitHub Commit Graph | Twitter / Social Build-Log | Traditional POAP / Badge | PROVN Protocol |
| :--- | :--- | :--- | :--- | :--- |
| **Can be backdated?** | ❌ Yes (`git commit --date`) | ❌ Yes (post anytime) | N/A | ✅ **No** — Signed timestamp constrained to ±15 min submission window |
| **Can be forged by an imposter?** | ❌ Yes (commit under any email) | ❌ Yes (anyone can post text) | ❌ Yes (transferable / bought) | ✅ **No** — Requires private key of the Solana wallet |
| **Cryptographically bound to identity?** | ❌ No | ❌ No | ❌ No | ✅ **Yes** — Ed25519 canonical proof message signature |
| **Permanent & Decentralized?** | ❌ Centralized (Microsoft/GitHub) | ❌ Centralized (X/Twitter) | ⚠️ Variable | ✅ **Yes** — Immutable Arweave storage via Irys L1 gateway |
| **Tamper-Evident Verification?** | ❌ Commit hashes can be rebased | ❌ Posts can be edited/deleted | ❌ Metadata mutable | ✅ **Yes** — Re-verifiable in browser, SDK, and CLI with 0 trust |

Bounty platforms and grant programs often rely on self-reported links and unverified resumes. PROVN provides a single verifiable identity link that resolves to cryptographically authentic, timestamped developer history.

---

## 🏛️ Core System Architecture

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                            User Browser (Client)                            │
│   Solana Wallet ──► Sign Canonical SIWS (Ed25519 Prompt)                    │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ POST /api/log-submit
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Next.js API Engine Server                           │
│   • Replay Protection (Anti-replay nonce & 15-minute strict timestamp)     │
│   • Domain-Binding Validation (Anti-host spoofing)                          │
│   • Off-Chain Ed25519 Signature Verification (TweetNaCl)                    │
│   • Automated Classifier (16 skill tags, 15 protocols, 10 work categories)   │
│   • Pure Deterministic Reputation Engine (Calculate levels & streaks)       │
└──────────────────────┬──────────────────────────────┬───────────────────────┘
                       │                              │
                       ▼                              ▼
┌──────────────────────────────┐ ┌────────────────────────────────────────────┐
│  ① Supabase PostgreSQL DB    │ │  ② Irys Gateway (Arweave Permanent)        │
│  • Public Read SELECT        │ │  • Permanent Immutable Storage             │
│  • Writes Restricted (RLS)   │ │  • Complete Proof Envelope with Sig        │
│  • Signature Unique Index    │ │  • Zero Fee (<100KB Free Tier)              │
└──────────────────────────────┘ └────────────────────────────────────────────┘
```

---

## ⚙️ The Metallic Customizable Card System

PROVN introduces a physical-feeling digital metal credential system inspired by aerospace hardware, laboratory instruments, and precision machinery.

```text
Solana Wallet + Proof History + Reputation + Skills + Achievements = Digital Metal Credential
```

### 1. 10 Data-Driven Material Themes ([`app/lib/cardThemes.ts`](app/lib/cardThemes.ts))
- **01 — Raw Steel**: Cold-brushed industrial steel with machined bevels.
- **02 — Aerospace Titanium**: Micro-machined titanium alloy with ambient sheen.
- **03 — Black Obsidian**: Deep non-reflective stealth metal with micro-edges.
- **04 — Mirror Chrome**: High-contrast polished chrome with specular reflections.
- **05 — Noble Platinum**: Prestige noble platinum with ultra-clean grain.
- **06 — Forged Carbon**: Motorsport-grade forged carbon fiber matrix.
- **07 — Sub-Zero Reactor**: Dark tactical hardware with cryo-luminescent channels.
- **08 — Solar Forge**: Heavy brushed brass & tempered gold alloy.
- **09 — Deep Space Orbital**: Astronautics satellite hull composite with indigo markings.
- **10 — Hardware Prototype**: Experimental unmachined foundry billet with raw serial engravings.

### 2. Interactive Features:
- **3D Perspective Tilt**: 60fps buttery-smooth physical tilt reacting to pointer coordinates.
- **Dynamic Specular Light**: Dynamic glint highlights shifting across procedural metal grain.
- **Dual-Sided Flip**: Interactive flip button to inspect reverse magnetic stripe and telemetry.
- **Metal Studio Customizer**: Real-time theme customizer modal with 1-click URL sharing and SVG export.
- **Collectible Achievement Cards**: Individual physical-feeling cards for Genesis Proof, 7-Day Ironclad, 30-Day Titan, etc.

---

## 🏆 Reputation & Achievement Engine

PROVN implements an **objective, deterministic reputation system** with 100% test coverage:

- **Evolving Builder Levels**:
  - `LVL 1` 🔧 **Apprentice Builder** (1+ proofs)
  - `LVL 2` ⚒️ **Verified Craftsman** (5+ proofs)
  - `LVL 3` 🏗️ **Senior Architect** (15+ proofs)
  - `LVL 4` ⚡ **Protocol Master** (30+ proofs)
  - `LVL 5` 🗿 **Grand Legend** (60+ proofs)
- **Active & Longest Streaks**: Evaluated using the canonical Indian Standard Time (`Asia/Kolkata`) protocol timezone to guarantee absolute parity across all international viewers.
- **Deterministic Off-Chain Achievements Registry**:
  - 🚀 **Genesis Proof**: First verified SIWS work record.
  - 🛡️ **7-Day Ironclad**: 7 consecutive daily proofs.
  - ⚔️ **30-Day Titan**: 30 consecutive daily proofs.
  - 💯 **Century Legend**: 100+ lifetime verified proofs.
  - ⚡ **Solana Specialist**: 5+ Solana-specific smart contract / Anchor logs.
  - 🐙 **Open Source Vanguard**: 5+ Pull-request evidence logs.
  - 📦 **Permanent Provenance**: 10+ Arweave-archived transactions.
  - 🗿 **Grand Legend**: Level 5 protocol mastery.
- **cNFT Metaplex Standard Metadata Generation**: Ready for on-chain compressed NFT minting upon grant milestone execution.

---

## 🧰 Developer Tools & SDK

PROVN provides a complete developer suite for integrating cryptographic builder reputation into Solana dApps, bounty platforms, and CI/CD pipelines:

### 1. TypeScript SDK (`@provn/sdk`)
Zero-dependency client for reading reputation and verifying signatures locally:

```typescript
import { ProvnClient } from './sdk'

const client = new ProvnClient({ baseUrl: 'https://provn-sol.vercel.app' })

// Fetch full machine-readable passport
const passport = await client.getPassport('AocAQAwVo8req1XQ9WfBmj5CLVrwic1xCiQrDKN2hF3p')
console.log(`Builder Level: ${passport.reputation.builderLevel.title}`)

// Check bounty eligibility (e.g. requires 7-day streak and #Solana skill)
const eligibility = await client.checkBountyEligibility('AocAQAwVo8req1XQ9WfBmj5CLVrwic1xCiQrDKN2hF3p', {
  minProofs: 5,
  minStreak: 7,
  requiredSkills: ['Solana'],
})
console.log('Eligible for Bounty:', eligibility.eligible)

// Verify proof signature locally (zero network calls)
const isValid = ProvnClient.verifyProofLocally({
  walletAddress: 'AocAQAwVo8req1XQ9WfBmj5CLVrwic1xCiQrDKN2hF3p',
  signature: '...',
  nonce: '...',
  timestamp: '2026-08-14T00:00:00.000Z',
  content: 'Implemented cryptographic proof layer',
  githubUrl: 'https://github.com/dren712/pow-logger/pull/1',
  evidenceUrl: 'https://provn-sol.vercel.app',
})
```

### 2. PROVN CLI Tool (`cli/provn.mjs`)
Inspect profiles and verify proofs directly from the terminal:

```bash
# View builder profile & stats
node cli/provn.mjs profile AocAQAwVo8req1XQ9WfBmj5CLVrwic1xCiQrDKN2hF3p

# Check builder reputation & unlocked achievements
node cli/provn.mjs reputation AocAQAwVo8req1XQ9WfBmj5CLVrwic1xCiQrDKN2hF3p

# Cryptographically verify a proof record
node cli/provn.mjs verify 1
```

### 3. GitHub Action (`.github/actions/provn/action.yml`)
Embed PROVN verification into GitHub CI/CD workflows:

```yaml
- name: Verify PROVN Builder Proof
  uses: ./pow-logger/.github/actions/provn
  with:
    proof-id: '1'
```

---

## 📡 REST API Reference

| Endpoint | Method | Description | Example |
| :--- | :--- | :--- | :--- |
| `/api/passport/:wallet` | `GET` | Machine-readable JSON passport export with reputation and achievements | [`/api/passport/AocA...`](https://provn-sol.vercel.app/api/passport/AocAQAwVo8req1XQ9WfBmj5CLVrwic1xCiQrDKN2hF3p) |
| `/api/passport-card/:wallet` | `GET` | Dynamic 1200×630 SVG social preview card (supports `?theme=titanium\|obsidian\|etc.`) | [`/api/passport-card/AocA...`](https://provn-sol.vercel.app/api/passport-card/AocAQAwVo8req1XQ9WfBmj5CLVrwic1xCiQrDKN2hF3p?theme=titanium) |
| `/api/proof/:id` | `GET` | Single canonical proof record with Ed25519 verification data | [`/api/proof/1`](https://provn-sol.vercel.app/api/proof/1) |
| `/api/badge/:wallet` | `GET` | Live dynamic SVG markdown badge for GitHub READMEs | [`/api/badge/AocA...`](https://provn-sol.vercel.app/api/badge/AocAQAwVo8req1XQ9WfBmj5CLVrwic1xCiQrDKN2hF3p.svg) |
| `/api/log-submit` | `POST` | Submit a new wallet-signed proof of work entry | Internal SIWS handler |
| `/api/archival-retry` | `POST` | Authorized SIWS retry handler for pending Arweave transactions | Internal SIWS handler |
| `/api/feedback` | `POST` | Capture builder feedback and bug reports | Internal handler |

---

## ⚡ Live GitHub Profile Badge Embed

Embed your real-time PROVN reputation badge in any GitHub profile or repository `README.md`:

```markdown
[![PROVN Reputation](https://provn-sol.vercel.app/api/badge/AocAQAwVo8req1XQ9WfBmj5CLVrwic1xCiQrDKN2hF3p.svg?d=2026-08-14)](https://provn-sol.vercel.app/u/AocAQAwVo8req1XQ9WfBmj5CLVrwic1xCiQrDKN2hF3p)
```

![PROVN Live Badge](https://provn-sol.vercel.app/api/badge/AocAQAwVo8req1XQ9WfBmj5CLVrwic1xCiQrDKN2hF3p.svg?d=2026-08-14)

---

## 🧪 Automated Protocol Quality Gate

PROVN enforces a strict zero-regression quality gate. All 58 test assertions pass locally and on CI:

```bash
$ npm test

===================================================================
   PROVN PRODUCTION SECURITY & PROTOCOL TEST SUITE 🛡️🗿
===================================================================

► SUITE 1: Canonical Proof Message Construction & URL Normalization (12/12 PASS)
► SUITE 2: Serverless Fixed-Window Rate Limiting (3/3 PASS)
► SUITE 3: Ed25519 Cryptographic Proof Signature Tamper Protection (4/4 PASS)
► SUITE 4: Supabase Database Row-Level Security Policies (PASS)
► SUITE 5: Authorized Archival Retry Proof Verification (2/2 PASS)
► SUITE 6: Persisted Proof Reconstruction & Multi-Field Tamper Validation (4/4 PASS)
► SUITE 7: Deterministic Reputation Engine & Off-Chain Achievement System (7/7 PASS)
► SUITE 8: Metallic Customizable Card System & Material Themes (14/14 PASS)

===================================================================
   PRODUCTION SUITE COMPLETE: 58 PASSED, 0 FAILED
===================================================================
```

---

## 💻 Local Development Setup

### Prerequisites
- Node.js 20+
- npm

### Installation & Execution

```bash
# Clone the repository
git clone https://github.com/dren712/pow-logger.git
cd pow-logger

# Install dependencies
npm install

# Set up local environment
cp .env.example .env.local

# Run test suite
npm test

# Start Next.js development server
npm run dev

# Open http://localhost:3000 in your browser
```

---

## 📜 Canonical Proof Message Specification (SIWS-Inspired)

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

## 📄 License & Attribution

- **Author**: Darshan Gaikwad ([@dren712](https://github.com/dren712))
- **Email**: `darshangaikwad712@gmail.com`
- **License**: Distributed under the [MIT License](LICENSE).
