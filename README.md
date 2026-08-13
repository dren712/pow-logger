# PROVN — Solana-Native Cryptographic Builder Provenance Protocol 🗿🛡️

PROVN is a lightweight, cryptographically verifiable proof-of-work protocol for Solana developers. It turns wallet-signed work logs into timestamp-bound, tamper-evident attestations permanently archived on Arweave.

[![CI Test Suite](https://github.com/dren712/pow-logger/actions/workflows/test.yml/badge.svg)](https://github.com/dren712/pow-logger/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Solana](https://img.shields.io/badge/Solana-Mainnet%2FDevnet-00ff88?logo=solana)](https://solana.com)
[![Arweave](https://img.shields.io/badge/Storage-Arweave%20via%20Irys-00e5ff)](https://irys.xyz)
[![Protocol Tests](https://img.shields.io/badge/Tests-79%2F79%20Passed-brightgreen)](tests/protocol.test.ts)

- **Live Web App:** [provn-sol.vercel.app](https://provn-sol.vercel.app)
- **Live Builder Passport:** [provn-sol.vercel.app/u/AocAQAwVo8req1XQ9WfBmj5CLVrwic1xCiQrDKN2hF3p](https://provn-sol.vercel.app/u/AocAQAwVo8req1XQ9WfBmj5CLVrwic1xCiQrDKN2hF3p)
- **Developer API:** [provn-sol.vercel.app/docs/api](https://provn-sol.vercel.app/docs/api)
- **Grant Evidence Dashboard:** [provn-sol.vercel.app/admin/evidence](https://provn-sol.vercel.app/admin/evidence)
- **Technical Litepaper:** [`LITEPAPER.md`](LITEPAPER.md)
- **Roadmap:** [`ROADMAP.md`](ROADMAP.md)

---

## 1. What is PROVN?

In Web3, developer contributions are fragmented across GitHub repositories, pull requests, hackathons, and social posts. Traditional resumes and unauthenticated portfolios can be fabricated, backdated, or deleted.

PROVN gives developers a single, permanent record of their daily contributions:
1. **Sign**: The builder signs a canonical message containing their work summary, evidence links, timestamp, and unique nonce with their Solana wallet.
2. **Verify**: The server cryptographically validates the Ed25519 signature, checks the 15-minute anti-replay window, and indexes the attestation.
3. **Archive**: The signed envelope is permanently stored on Arweave via the Irys L1 gateway.
4. **Inspect**: Anyone can verify any proof record with zero trust using the public verification API or on-page cryptographic inspector.

---

## 2. What Does PROVN Cryptographically Prove?

| Claim | Cryptographic Guarantee |
|---|---|
| **Author Authenticity** | ✅ **Guaranteed** — The Ed25519 signature proves that the holder of the Solana private key authored the message. |
| **Content Integrity** | ✅ **Guaranteed** — Any change to the text, GitHub link, or evidence URL invalidates the signature payload. |
| **Timestamp Boundedness** | ✅ **Guaranteed** — Submissions are strictly verified against server clock within a ±15 minute window (`900,000ms`). |
| **Replay Defense** | ✅ **Guaranteed** — Database-level `UNIQUE INDEX` on signatures prevents re-submitting previously signed messages. |
| **Data Permanence** | ✅ **Guaranteed when archived** — Immutable Arweave storage via Irys receipts. |
| **Tag Classification** | ℹ️ **Heuristic** — Skill, protocol, and category tags are extracted via deterministic regex rules on signed text. |
| **GitHub Ownership** | 🔮 **Roadmap** — Self-attested PR/commit links; external OAuth/Oracle identity linking is planned for Phase 2. |

---

## 3. Core Architecture

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                            1. Client Attestation                            │
│   Solana Wallet ──► Signs Canonical SIWS-Inspired Proof Payload (Ed25519)   │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ POST /api/log-submit
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        2. Server Verification Engine                        │
│   • TweetNaCl Ed25519 Detached Signature Verification                       │
│   • Replay Protection (Anti-replay nonce & 15-min timestamp window)         │
│   • Domain-Binding & HTTPS URL Normalization                                │
│   • Deterministic Heuristic Classifier (Skills, Protocols, Categories)      │
│   • Indian Standard Time (Asia/Kolkata) Canonical Streak Engine             │
└──────────────────────┬──────────────────────────────┬───────────────────────┘
                       │                              │
                       ▼                              ▼
┌──────────────────────────────┐ ┌────────────────────────────────────────────┐
│ 3. Supabase PostgreSQL       │ │ 4. Arweave Permanent Archival              │
│ • Canonical `logs` table     │ │ • Standardized JSON Proof Envelope         │
│ • Public SELECT read-only    │ │ • Irys Gateway Node #1                     │
│ • service_role write-only    │ │ • Zero-fee free tier (<100KB)              │
│ • Unique Signature Index     │ │ • Multi-decade data availability           │
└──────────────────────────────┘ └────────────────────────────────────────────┘
```

---

## 4. Status Matrix: Shipped vs Experimental vs Roadmap

| Component | Status | Description |
|---|---|---|
| **Wallet Proof Signing** | ✅ **Shipped** | Browser-native Ed25519 signing of canonical proof payloads. |
| **Server Verification** | ✅ **Shipped** | TweetNaCl verification with domain and nonce validation (`/api/log-submit`). |
| **Public Proof Verifier** | ✅ **Shipped** | Standalone cryptographic verification inspector (`/proof/[id]`, `/api/verify/[wallet]`). |
| **Arweave Archival** | ✅ **Shipped** | Permanent decentralized storage via Irys gateway. |
| **Builder Passport** | ✅ **Shipped** | Verifiable builder profile with proof history (`/u/[wallet]`, `/api/passport/[wallet]`). |
| **Streak Engine** | ✅ **Shipped** | Parity-guaranteed daily streak calculation in canonical `Asia/Kolkata` timezone. |
| **Export Studio** | 🧪 **Labs** | Multi-format export: Markdown (`.md`), Verifiable JSON, CSV, and Printable A4 certificate. |
| **Card Material Customizer** | 🧪 **Labs** | Data-driven metallic UI customizer and SVG card generator (`/api/passport-card/[wallet]`). |
| **GitHub Readme Badge** | 🧪 **Labs** | Dynamic SVG builder summary badge for GitHub profile READMEs (`/api/badge/[wallet].svg`). |
| **TypeScript SDK (`@provn/sdk`)** | 🧪 **Labs** | Client library and local offline signature verifier in [`sdk/index.ts`](sdk/index.ts). |
| **CLI Prototype** | 🧪 **Labs** | Terminal utility for checking wallet reputation in [`cli/provn.mjs`](cli/provn.mjs). |
| **Bounty Gating Demo** | 🧪 **Labs** | Interactive demo illustrating programmatic reputation verification (`/demo/bounty`). |
| **On-Chain Compressed NFTs** | 🔮 **Roadmap** | Metaplex Bubblegum Merkle tree minting for earned achievements (Phase 3). |
| **GitHub OAuth / Commit Oracle**| 🔮 **Roadmap** | Automated repository ownership verification and commit attestation (Phase 2). |

---

## 5. Canonical Message Specification

Every proof submission requires the wallet to sign a human-readable, tamper-evident prompt:

```text
provn-sol.vercel.app wants you to sign in with your Solana account:
<WALLET_ADDRESS>

SIWS Schema Version: 1
Nonce: <RANDOM_BASE58_NONCE>
Timestamp: <ISO_8601_TIMESTAMP>
Content: <WORK_DESCRIPTION>
GitHub URL: <NORMALIZED_GITHUB_URL_OR_NONE>
Evidence URL: <NORMALIZED_EVIDENCE_URL_OR_NONE>
```

Modifying any character in the content, links, timestamp, or nonce breaks the Ed25519 signature, preventing client tampering or unauthorized modification.

---

## 6. Reputation & Achievements

Builder reputation is computed deterministically from verified logs:

### Builder Levels ([`app/lib/milestones.ts`](app/lib/milestones.ts))
- `LVL 1` 🔧 **Apprentice Builder** (0+ logs)
- `LVL 2` ⚒️ **Verified Craftsman** (7+ logs)
- `LVL 3` 🏗️ **Senior Architect** (30+ logs)
- `LVL 4` 💎 **Protocol Master** (100+ logs)
- `LVL 5` 👑 **Grand Legend** (365+ logs)

### Builder Achievements ([`app/lib/achievements.ts`](app/lib/achievements.ts))
- ⚡ **Genesis Proof**: Submit 1 verified proof log.
- 🔥 **7-Day Builder**: Maintain an active or historical 7-day streak.
- 🛡️ **30-Day Builder**: Maintain an active or historical 30-day streak.
- 👑 **100-Day Builder**: Maintain an active or historical 100-day streak.
- 🟣 **Solana Contributor**: Log 10+ proofs classified with Solana ecosystem protocols.
- 🐙 **Open Source Contributor**: Submit 5+ verified Pull Request / Commit links.
- 📦 **Permanent Provenance**: 10+ logs permanently archived on Arweave.
- 💎 **Protocol Master**: Log 365+ lifetime verified proofs.

---

## 7. Local Development & Testing

### Prerequisites
- Node.js >= 18.0.0
- npm >= 9.0.0

### Quick Start
```bash
# Clone repository
git clone https://github.com/dren712/pow-logger.git
cd pow-logger

# Install dependencies
npm install

# Run protocol verification test suite (73 assertions)
npm test

# Start local Next.js dev server
npm run dev
```

### Environment Configuration (`.env.local`)
```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
IRYS_PRIVATE_KEY=<optional-base58-or-json-keypair>
```

---

## 8. License & Attribution

- **Author**: Darshan Gaikwad ([@dren712](https://github.com/dren712))
- **Email**: darshangaikwad712@gmail.com
- **License**: [MIT](LICENSE)
