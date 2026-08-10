# 🗺️ PROVN Protocol — Engineering Roadmap

*Decentralized Proof-of-Work & Builder Reputation Protocol on Solana & Arweave*

---

## 📍 Phase Status Overview

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                            PROVN ROADMAP PHASES                             │
│                                                                             │
│  [ Phase 1: Proof Foundry Core ] ─────────────► ✅ COMPLETED & SECURITY-TESTED
│  [ Phase 2: Dual-Tier Reputation & Badges ] ──► ✅ COMPLETED & LIVE        │
│  [ Phase 3: B2B DAO Grant Gating & SDK ] ─────► 🚧 IN PROGRESS (Q3 2026)    │
│  [ Phase 4: Metaplex cNFT On-Chain Badges ] ──► 🔮 UPCOMING (Q4 2026)      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## ✅ Phase 1: Proof Foundry Core & Security Hardening (Completed)

- [x] **Sign-In-With-Solana (SIWS)**: Cryptographic binding of wallet, content, timestamp, nonce, and proof links using Ed25519 keypairs.
- [x] **Server-Side Verification Engine**: Off-chain signature verification using TweetNaCl (`nacl.sign.detached.verify()`).
- [x] **Permanent Decentralized Archival**: Packaging log envelopes into JSON metadata and archiving to Arweave via Irys Node #1.
- [x] **Database Security & RLS**: Supabase PostgreSQL with strict `service_role` write policies, anonymous `SELECT` read access, and unique signature indexing.
- [x] **Automated Classification Engine**: 16-skill regex classification for Solana, Rust, Anchor, Next.js, Security, and DeFi work categories.
- [x] **Automated CI/CD**: 17-assertion protocol test suite running on GitHub Actions.

---

## ✅ Phase 2: Multi-Pillar Reputation & Badge Engine (Completed / Live)

- [x] **Tier 1: Dynamic Evolving Builder Levels**: 5-tier builder progression (Apprentice → Verified Craftsman → Senior Architect → Protocol Master → Grand Legend).
- [x] **Tier 2: Streak Milestone Trophies**: Earnable trophy cards for 7, 14, 30, 60, 100, and 365 consecutive days of verified logging.
- [x] **Tier 3: LeetCode / Codeforces Skill Badges**:
  - ⚓ **Anchor Specialist**: 3+ Solana / Anchor smart contract logs.
  - 🛡️ **Security Auditor**: 2+ Security / Auth work logs.
  - 🐙 **Open Source Builder**: 3+ Verified GitHub PR / Commit links.
  - 📜 **Arweave Archivist**: 5+ Permanent Arweave archived logs.
  - 💯 **Century Club**: 100+ Total verified logs.
- [x] **GitHub README Live SVG Badge Engine**: Public SVG endpoint (`/api/badge/[wallet].svg`) for developer GitHub profiles.
- [x] **Glassmorphic Builder Dashboard**: 4-column stats grid, level progress bar, and 365-day contribution heatmap.

---

## 🚧 Phase 3: Ecosystem B2B API & DAO Grant Gating (In Progress / Q3 2026)

- [ ] **Global Builder Leaderboard (`/leaderboard`)**: Public ranking of top Solana builders by level, active streak, and verified contributions.
- [ ] **Developer SDK (`@provn/sdk`)**: TypeScript client library for querying builder reputation scores programmatically.
- [ ] **DAO & Hackathon Grant Gating**: API integration for Superteam Earn and Colosseum to require 7-day or 30-day verified PROVN streaks for bounty claims.
- [ ] **Whitelabel Proof Cards**: Custom DAO watermarking and branded SVG export badges.

---

## 🔮 Phase 4: Metaplex cNFT Merkle Tree & Solana Protocol (Upcoming / Q4 2026)

- [ ] **Metaplex Bubblegum Merkle Tree Deployment**: Deploying an on-chain Concurrent Merkle Tree (Depth 14, 16,384 badge capacity) on Solana Mainnet.
- [ ] **Helius RPC Indexer Integration**: Utilizing Helius DAS API for indexing compressed NFT badges.
- [ ] **Dynamic On-Chain Soulbound Badges**: Automatically updating on-chain cNFT metadata upon builder level-up milestones.

---

## 🎯 Production Engineering Deliverables & Milestones

| Milestone Phase | Technical Scope & Objective | Deliverables |
| :--- | :--- | :--- |
| **Milestone 1** | **Ecosystem Onboarding & Profile Embedding** | Onboard 10+ active Solana builders with 7-day streaks & live GitHub SVG embeds |
| **Milestone 2** | **Solana Mainnet Metaplex cNFT Engine** | Deploy Concurrent Merkle Tree (Depth 14) & automated Helius DAS badge minting |
| **Milestone 3** | **Developer SDK & Superteam Earn Integration** | Package `@provn/sdk` TypeScript client & build bounty-gating verification webhooks |

---

*For technical details, refer to the [PROVN Protocol Litepaper](LITEPAPER.md).*
