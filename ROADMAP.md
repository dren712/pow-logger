# 🗺️ PROVN Protocol — Engineering Roadmap

*A Solana-Native, Wallet-Signed Builder Evidence Protocol with Optional Arweave Archival*

---

## 📍 Phase Overview

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                            PROVN ROADMAP PHASES                             │
│                                                                             │
│  [ Phase 0: Core Protocol Engine ] ──────────► ✅ SHIPPED & VERIFIED        │
│  [ Phase 1: Builder Passport & Identity ] ───► ✅ SHIPPED & LIVE            │
│  [ Phase 2: Ecosystem Integrations ] ────────► 🧪 EXPERIMENTAL / IN PROGRESS │
│  [ Phase 3: Ecosystem & Review Dashboards ] ─► 🔮 PLANNED (GRANT-FUNDED)    │
│  [ Phase 4: Scale & Infrastructure ] ────────► 🔮 FUTURE                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## ✅ Phase 0: Core Protocol Engine (Shipped & Live)

- [x] **Canonical Proof Payloads**: SIWS-inspired deterministic message format binding wallet, content, timestamp, nonce, and normalized URLs.
- [x] **Cryptographic Verification**: Server-side Ed25519 detached signature verification using TweetNaCl.
- [x] **Replay Protection**: Strict 15-minute validity window (`900,000ms`) + database-level unique signature index.
- [x] **Permanent Arweave Archival**: Zero-fee (<100KB) immutable storage via Irys L1 gateway.
- [x] **Public Verifier Inspector**: Individual proof lookup (`/proof/[id]`) and public REST verification API (`/api/verify/[wallet]`).
- [x] **Single Database Contract**: PostgreSQL `logs` table with strict Row-Level Security (`SELECT` public, mutations strictly via `service_role`).

---

## ✅ Phase 1: Builder Passport & Identity (Shipped & Live)

- [x] **Builder Passport UI**: Public builder profile showing verified history, skills, and protocols (`/u/[wallet]`).
- [x] **Deterministic Streak Engine**: Canonical Indian Standard Time (`Asia/Kolkata`) streak calculation ensuring global display parity.
- [x] **Export Studio**: Client-side zero-latency export to Markdown (`.md`), REST JSON (`.json`), CSV spreadsheet (`.csv`), and printable A4 dossier.
- [x] **GitHub Profile Badge**: Dynamic SVG endpoint (`/api/badge/[wallet].svg`) for developer README embeds.
- [x] **Material Themes**: Data-driven metallic UI customizer with instant SVG generation (`/api/passport-card/[wallet]`).

---

## 🧪 Phase 2: Ecosystem Integrations (Experimental / In Progress)

- [x] **TypeScript Client SDK**: Programmatic passport querying and local offline signature verifier in [`sdk/index.ts`](sdk/index.ts).
- [x] **CLI Prototype**: Terminal utility for inspecting builder reputation in [`cli/provn.mjs`](cli/provn.mjs).
- [x] **Bounty Gating Demo**: Prototype verification flow evaluating builder streak and proof criteria for bounty eligibility (`/demo/bounty`).
- [x] **GitHub OAuth & Identity Binding**: Strict cryptographic binding of GitHub accounts to Solana wallets via SIWS OAuth with `source_verified` provenance.
- [ ] **Published npm Package**: Publishing `@provn/sdk` to npm registry with zero external runtime dependencies.

---

## 🔮 Phase 3: Ecosystem & Review Dashboards (Planned / Grant-Funded)

- [ ] **Superteam Earn Integration**: Allowing users to attach wallet-signed evidence packets to bounty submissions.
- [ ] **Solana Foundation Grants**: Exportable evidence bundles to supplement grant application credibility.
- [ ] **Manual Review Dashboards**: Interfaces for grant and bounty managers to inspect evidence provenance.

---

## 🔮 Phase 4: Scale & Infrastructure (Future)

- [ ] **Distributed Rate Limiting**: Redis/Upstash backing for high-concurrency multi-region API routes.
- [ ] **Public RPC Nodes**: Dedicated Solana RPC pool for enterprise and bounty platform integration.
- [ ] **Cross-Ecosystem Bridging**: Verifiable credentials export compatible with W3C DID standards.

---

*For technical details, refer to the [PROVN Protocol Litepaper](LITEPAPER.md).*
