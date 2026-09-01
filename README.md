# PROVN — Solana-Native Cryptographic Builder Evidence Protocol 🗿🛡️

PROVN is a portable, cryptographically verifiable provenance protocol for software actions. It turns wallet-authenticated attestations into timestamp-bounded, tamper-evident evidence envelopes with graduated source provenance and decentralized Arweave archival ($0/month free-tier architecture). Designed to extend seamlessly from human developer attestations to autonomous AI-agent execution audit trails.

[![CI Test Suite](https://github.com/dren712/pow-logger/actions/workflows/test.yml/badge.svg)](https://github.com/dren712/pow-logger/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Solana](https://img.shields.io/badge/Solana-Mainnet%2FDevnet-00ff88?logo=solana)](https://solana.com)
[![Arweave](https://img.shields.io/badge/Storage-Arweave%20via%20Irys-00e5ff)](https://irys.xyz)
[![Protocol Tests](https://img.shields.io/badge/Protocol%20Tests-286%20Offline%20%7C%20296%20Total%20Passing-brightgreen)](tests/protocol.test.ts)

- **Live Web App:** [provn-sol.vercel.app](https://provn-sol.vercel.app)
- **Live Builder Passport:** [provn-sol.vercel.app/u/AocAQAwVo8req1XQ9WfBmj5CLVrwic1xCiQrDKN2hF3p](https://provn-sol.vercel.app/u/AocAQAwVo8req1XQ9WfBmj5CLVrwic1xCiQrDKN2hF3p)
- **Policy Engine Demo:** [provn-sol.vercel.app/demo/bounty](https://provn-sol.vercel.app/demo/bounty)
- **Developer API:** [provn-sol.vercel.app/docs/api](https://provn-sol.vercel.app/docs/api)
- **Grant Evidence Dashboard:** [provn-sol.vercel.app/admin/evidence](https://provn-sol.vercel.app/admin/evidence)
- **Technical Litepaper:** [`LITEPAPER.md`](LITEPAPER.md)
- **Roadmap:** [`ROADMAP.md`](ROADMAP.md)

---

## 1. What is PROVN?

> [!IMPORTANT]
> **What PROVN Proves vs. What it Doesn't**
> PROVN cryptographically proves that a specific Solana wallet signed a specific canonical statement (content + timestamp + challenge + optional links) at a specific time. When archival is requested and confirmed, the resulting envelope is also backed by a verifiable Irys/Arweave transaction receipt (`receipt_obtained`). It **does NOT** independently prove that the underlying work was actually performed or anything about work quality. It is a tamper-evident cryptographic wrapper around a claim.
> 
> **Note on Author Identity Verification**: PROVN enforces strict cryptographic binding between a `github_id` and a `wallet_address` via SIWS (Sign-In-With-Solana) OAuth, granting logs a `source_verified` provenance level when the author matches the repository commit author.

In Web3, developer contributions are fragmented across GitHub repositories, pull requests, hackathons, and social posts. Traditional resumes and unauthenticated portfolios can be fabricated, backdated, or deleted.

PROVN gives developers a single, tamper-evident cryptographic record of their daily self-attested contributions:
1. **Sign**: The builder signs a canonical message containing their work summary, evidence links, timestamp, and server-issued challenge with their Solana wallet.
2. **Verify**: The server cryptographically validates the Ed25519 signature, checks the 15-minute anti-replay observation window, and indexes the attestation.
3. **Archive**: The signed envelope is durably archived on Arweave via the Irys L1 gateway upon request.
4. **Inspect**: Anyone can verify any proof record across 4 independent verification layers using the public verification API or on-page verifier inspector.

---

## 2. What Does PROVN Cryptographically Prove?

PROVN evaluates proof validity across four independent, non-fungible layers:

| Layer | Claim | Cryptographic Guarantee |
|---|---|---|
| **Signature** | **Author Authenticity** | ✅ **Guaranteed** — The Ed25519 signature proves that the holder of the Solana private key authored the canonical payload. |
| **Protocol** | **Server-Bounded Timestamp & Challenge** | ✅ **Guaranteed** — Signed timestamp is bounded within ±15 min observation window (`900,000ms`) of server clock, with single-use transactional challenge consumption. |
| **Protocol** | **Proof Submission Replay Defense** | ✅ **Guaranteed** — Single-use transactional challenge consumption (`atomic_insert_log`) and database-level `UNIQUE INDEX` on signatures. |
| **Protocol** | **Private Auth Replay Defense** | ✅ **Guaranteed** — One-time 128-bit server-issued nonces atomically consumed in PostgreSQL (`consume_private_auth_nonce`). |
| **Source** | **Author Identity Verification** | ✅ **Guaranteed (if linked)** — Strict cryptographic binding of `github_id` to `wallet_address` via SIWS OAuth, verifying commit author identity matches wallet owner. |
| **Archive** | **Archival Availability** | ✅ **Confirmed when archived** — Decentralized Arweave storage via confirmed Irys receipts (`receipt_obtained`). |
| **Inference** | **Tag Classification** | ℹ️ **Heuristic** — Skill, protocol, and category tags are extracted via deterministic regex rules on signed text. |

### Adversarial Attack & Tampering Matrix (286 Offline / 296 Total Tests)

The protocol test suite rigorously verifies resistance against active attacks across every layer:

> [!NOTE]
> **Offline vs. Live Suite Breakdown**:
> - **286 Offline Tests**: Fully air-gapped cryptographic verification, tampering matrices, SIWS auth, rate limiters, policy evaluation, key-epoch boundaries, and server ↔ standalone CLI differential tests run without network or database credentials.
> - **10 Live Integration Tests**: Live Supabase database constraint, RLS policy, and provenance persistence checks run when connected to a configured database instance, totaling **296 passed tests**.

| Attack Scenario | Threat Description | Protocol Defense & Verification Result |
|---|---|---|
| **Content Tampering** | Adversary alters 1 byte of signed work text | ❌ Rejected — Ed25519 signature verification fails |
| **Evidence URL Injection** | Adversary adds or modifies PR/demo URL | ❌ Rejected — Reconstructed canonical hash mismatch |
| **Signature Replay** | Re-submitting an authentic historic proof | ❌ Rejected — Single-use challenge token & signature `UNIQUE INDEX` |
| **Private Auth Replay** | Replaying a intercepted private proof bearer token | ❌ Rejected — One-time SIWS nonce atomically consumed on verification |
| **Timestamp Backdating** | Claiming work was signed hours earlier | ❌ Rejected — Challenge `iat`/`exp` window strictly bounds timestamp |
| **Server Receipt Forgery** | Fabricating ingestion receipt without key | ❌ Rejected — Ed25519 verification against published trust manifest |
| **Key Epoch Expiry** | Signing with an expired/retired server key | ❌ Rejected — `resolveTrustedKey` enforces `valid_until` temporal bounds |
| **Untrusted Domain** | Submitting proof on unauthorized origin | ❌ Rejected — Domain checked against `protocol/trust-manifest.json` |
| **Unknown KID Injection** | Specifying arbitrary Key ID in challenge | ❌ Rejected — Key not found in published trust registry |
| **Identity Impersonation** | Claiming another author's commit | ❌ Rejected — SIWS OAuth numeric GitHub ID mismatch (`source_verified` denied) |

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
│   • Replay Protection (Anti-replay server challenge & 15-min timestamp)     │
│   • Domain-Binding & HTTPS URL Normalization                                │
│   • Deterministic Heuristic Classifier (Skills, Protocols, Categories)      │
│   • Indian Standard Time (Asia/Kolkata) Canonical Streak Engine             │
└──────────────────────┬──────────────────────────────┬───────────────────────┘
                       │                              │
                       ▼                              ▼
┌──────────────────────────────┐ ┌────────────────────────────────────────────┐
│ 3. Supabase PostgreSQL       │ │ 4. Arweave Permanent Archival              │
│ • Canonical `logs` table     │ │ • Standardized JSON Proof Envelope (v2)    │
│ • Public SELECT read-only    │ │ • Irys Gateway Node #1                     │
│ • service_role write-only    │ │ • Zero-fee free tier (<100KB)              │
│ • Unique Signature Index     │ │ • Multi-decade data availability           │
└──────────────────────────────┘ └────────────────────────────────────────────┘
```

---

## 4. Status Matrix: Shipped vs Experimental vs Roadmap

| Component | Status | Description |
|---|---|---|
| **Wallet Proof Signing** | ✅ **Shipped** | Browser-native Ed25519 signing of canonical proof payloads with Draft-Review-Sign preview modal. |
| **Proof Templates** | ✅ **Shipped** | 8 preconfigured contribution templates (Shipped Code, Bug Fix, RFC, OSS, Release, Hackathon, etc.). |
| **Server Verification** | ✅ **Shipped** | TweetNaCl verification with exact domain and server-issued challenge validation (`/api/log-submit`). |
| **Public Proof Verifier** | ✅ **Shipped** | Standalone cryptographic verification inspector (`/proof/[id]`, `/api/verify/[wallet]`). |
| **Arweave Archival** | ✅ **Shipped** | Permanent decentralized storage via Irys gateway. |
| **Builder Passport** | ✅ **Shipped** | Evidence-first verifiable builder profile (`/u/[wallet]`, `/api/passport/[wallet]`). |
| **Proof Packet Studio** | ✅ **Shipped** | Curated portable evidence bundle export in JSON & Markdown (`/components/ProofPacketModal`). |
| **Policy Evaluation Engine** | ✅ **Shipped** | Programmatic reputation and evidence gating API for DAOs and bounties (`/api/eligibility`). |
| **Streak Engine** | ✅ **Shipped** | Parity-guaranteed daily streak calculation in canonical `Asia/Kolkata` timezone. |
| **Export Studio** | 🧪 **Labs** | Multi-format export: Markdown (`.md`), Verifiable JSON, CSV, and Printable A4 certificate. |
| **Card Material Customizer** | 🧪 **Labs** | Data-driven metallic UI customizer and SVG card generator (`/api/passport-card/[wallet]`). |
| **GitHub Readme Badge** | 🧪 **Labs** | Dynamic SVG builder summary badge for GitHub profile READMEs (`/api/badge/[wallet].svg`). |
| **TypeScript SDK (`@provn/sdk` - Experimental Internal Package)** | 🧪 **Labs** | The SDK provides a typed interface for retrieving and validating PROVN proof packets. Note: This is currently an internal experimental workspace package that directly consumes the Next.js application core; it is not yet published to npm. |
| **CLI Utility** | 🧪 **Labs** | Terminal utility for passports, proofs, packets, and policy evaluation in [`cli/provn.mjs`](cli/provn.mjs). |
| **Bounty Policy Demo** | 🧪 **Labs** | Interactive reference demo illustrating programmatic policy gating (`/demo/bounty`). |
| **GitHub OAuth & Identity Binding** | ✅ **Shipped** | Strict cryptographic binding of GitHub accounts to wallets via SIWS OAuth with `source_verified` provenance. |
| **On-Chain Compressed NFTs** | 🔮 **Roadmap** | Metaplex Bubblegum Merkle tree minting for earned achievements (Phase 3). |

---

## 5. Canonical Message Specification

Every proof submission requires the wallet to sign a human-readable, tamper-evident prompt:

```text
provn-sol.vercel.app wants you to sign in with your Solana account:
<WALLET_ADDRESS>

PROVN Protocol Version: 2
Challenge: <SERVER_ISSUED_CHALLENGE>
Timestamp: <ISO_8601_TIMESTAMP>
Content: <WORK_DESCRIPTION>
GitHub URL: <NORMALIZED_GITHUB_URL_OR_NONE>
Evidence URL: <NORMALIZED_EVIDENCE_URL_OR_NONE>
```

Modifying any character in the content, links, timestamp, or challenge breaks the Ed25519 signature, preventing client tampering or unauthorized modification.

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

# Run protocol verification test suite
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
