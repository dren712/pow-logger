# PROVN — Solana-Native Cryptographic Builder Evidence Protocol 🗿🛡️

PROVN is a portable, cryptographically verifiable builder evidence protocol for Solana developers. It turns wallet-signed work logs into timestamp-bound, tamper-evident attestations permanently archived on Arweave, with programmatic policy evaluation for DAOs, bounties, and grants ($0/month free-tier architecture).

[![CI Test Suite](https://github.com/dren712/pow-logger/actions/workflows/test.yml/badge.svg)](https://github.com/dren712/pow-logger/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Solana](https://img.shields.io/badge/Solana-Mainnet%2FDevnet-00ff88?logo=solana)](https://solana.com)
[![Arweave](https://img.shields.io/badge/Storage-Arweave%20via%20Irys-00e5ff)](https://irys.xyz)
[![Protocol Tests](https://img.shields.io/badge/Tests-102%2F102%20Passed-brightgreen)](tests/protocol.test.ts)

- **Live Web App:** [provn-sol.vercel.app](https://provn-sol.vercel.app)
- **Live Builder Passport:** [provn-sol.vercel.app/u/AocAQAwVo8req1XQ9WfBmj5CLVrwic1xCiQrDKN2hF3p](https://provn-sol.vercel.app/u/AocAQAwVo8req1XQ9WfBmj5CLVrwic1xCiQrDKN2hF3p)
- **Policy Engine Demo:** [provn-sol.vercel.app/demo/bounty](https://provn-sol.vercel.app/demo/bounty)
- **Developer API:** [provn-sol.vercel.app/docs/api](https://provn-sol.vercel.app/docs/api)
- **Grant Evidence Dashboard:** [provn-sol.vercel.app/admin/evidence](https://provn-sol.vercel.app/admin/evidence)
- **Technical Litepaper:** [`LITEPAPER.md`](LITEPAPER.md)
- **Roadmap:** [`ROADMAP.md`](ROADMAP.md)

---

## 1. Problem & Solution

### The Problem
In Web3, developer contributions are fragmented across GitHub repositories, pull requests, hackathons, and Discord messages. Traditional resumes and unauthenticated portfolios can be fabricated, backdated, or deleted, lacking cryptographic attribution.

### The Solution
PROVN creates wallet-authenticated proof records that allow builders to prove that a Solana wallet signed a specific contribution record:
1. **Sign**: The builder signs a canonical message containing their work summary, evidence links, timestamp, and unique nonce with their Solana wallet.
2. **Verify**: The server cryptographically validates the Ed25519 signature, checks the 15-minute anti-replay window, and indexes the attestation.
3. **Archive**: The signed envelope is permanently stored on Arweave via the Irys L1 gateway.
4. **Share**: The builder exports or links their portable Proof Packet for DAOs, bounties, and grants.

---

## 2. What PROVN Proves vs What PROVN Does NOT Prove

### What PROVN Cryptographically Proves
| Guarantee | Verification Mechanism |
|---|---|
| **Author Authenticity** | ✅ **Guaranteed** — The Ed25519 signature proves that the holder of the Solana private key authored the message. |
| **Content Integrity** | ✅ **Guaranteed** — Any change to the text, GitHub link, or evidence URL invalidates the signature payload. |
| **Timestamp Boundedness** | ✅ **Guaranteed** — Submissions are strictly verified against server clock within a ±15 minute window (`900,000ms`). |
| **Replay Defense** | ✅ **Guaranteed** — Database-level `UNIQUE INDEX` on signatures prevents re-submitting previously signed messages. |
| **Data Permanence** | ✅ **Guaranteed when archived** — Immutable Arweave storage via Irys receipts. |

### What PROVN Does NOT Prove (Protocol Boundaries)
- **Code Quality**: PROVN does not evaluate whether the underlying code is bug-free, efficient, or well-written.
- **External Acceptance**: PROVN does not prove that a pull request was merged upstream (until Phase 2 Oracle integration).
- **Sole Authorship**: PROVN proves wallet attestation of a statement; it does not replace multi-signature code commit signing.

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

## 4. Status Matrix: Shipped vs Labs vs Roadmap

| Component | Status | Description |
|---|---|---|
| **Wallet Proof Signing** | ✅ **Shipped** | Browser-native Ed25519 signing of canonical proof payloads with Draft-Review-Sign preview modal. |
| **Proof Templates** | ✅ **Shipped** | 8 preconfigured contribution templates (Shipped Code, Bug Fix, RFC, OSS, Release, Hackathon, etc.). |
| **Server Verification** | ✅ **Shipped** | TweetNaCl verification with exact domain and Base58 nonce validation (`/api/log-submit`). |
| **Public Proof Verifier** | ✅ **Shipped** | Standalone cryptographic verification inspector (`/proof/[id]`, `/api/verify/[wallet]`). |
| **Arweave Archival** | ✅ **Shipped** | Permanent decentralized storage via Irys gateway. |
| **Builder Passport** | ✅ **Shipped** | Evidence-first verifiable builder profile (`/u/[wallet]`, `/api/passport/[wallet]`). |
| **Proof Packet Studio** | ✅ **Shipped** | Curated portable evidence bundle export in JSON & Markdown (`/components/ProofPacketModal`). |
| **Policy Evaluation Engine** | ✅ **Shipped** | Programmatic reputation and evidence gating API for DAOs and bounties (`/api/eligibility`). |
| **Streak Engine** | ✅ **Shipped** | Parity-guaranteed daily streak calculation in canonical `Asia/Kolkata` timezone. |
| **Export Studio** | 🧪 **Labs** | Multi-format export: Markdown (`.md`), Verifiable JSON, CSV, and Printable A4 certificate. |
| **Card Material Customizer** | 🧪 **Labs** | Data-driven metallic UI customizer and SVG card generator (`/api/passport-card/[wallet]`). |
| **GitHub Readme Badge** | 🧪 **Labs** | Dynamic SVG builder summary badge for GitHub profile READMEs (`/api/badge/[wallet].svg`). |
| **TypeScript SDK (`@provn/sdk`)** | 🧪 **Labs** | Client library, local offline verifier, and policy checker in [`sdk/index.ts`](sdk/index.ts). |
| **CLI Utility** | 🧪 **Labs** | Terminal utility for passports, proofs, packets, and policy evaluation in [`cli/provn.mjs`](cli/provn.mjs). |
| **Bounty Policy Demo** | 🧪 **Labs** | Interactive reference demo illustrating programmatic policy gating (`/demo/bounty`). |
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

---

## 6. Local Development & Testing

### Quick Start
```bash
# Clone repository
git clone https://github.com/dren712/pow-logger.git
cd pow-logger

# Install dependencies
npm install

# Run protocol verification test suite (102 assertions)
npm test

# Start local Next.js dev server
npm run dev
```

---

## 7. License & Attribution

- **Author**: Darshan Gaikwad ([@dren712](https://github.com/dren712))
- **Email**: darshangaikwad712@gmail.com
- **License**: [MIT](LICENSE)
