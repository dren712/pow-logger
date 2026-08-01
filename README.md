<!-- PoWL Protocol v1.0 -->
# PoWL — Proof-of-Work Logger 🗿

**Cryptographically verified, permanent builder reputation protocol on Solana.**

Log daily work → verify via Ed25519 signature → store permanently on Arweave → auto-classify skills → mint as compressed NFT on Solana → showcase pixel-perfect GitHub 365-day contribution heatmap.

> *"Your work, permanently on-chain."*

**Live Protocol App:** [pow-logger.vercel.app](https://pow-logger.vercel.app)  
**GitHub:** [github.com/dren712/pow-logger](https://github.com/dren712/pow-logger)  
**License:** [![License: MIT](https://img.shields.io/badge/License-MIT-00ff88.svg)](LICENSE)

---

## 💡 The Problem & Solution

### The Problem
Solana builders, bounty hunters, and hackathon participants complete daily work but lack a **portable, tamper-proof, on-chain proof of consistent effort**. GitHub records code pushes; bounty platforms show payouts. Nothing verifies the daily builder streak with cryptographic proof.

### The Solution: PoWL Protocol
1. **Cryptographic Verification**: Builders sign daily work logs using Ed25519 wallet signatures (anti-spoofing). Zero gas fees for users.
2. **Permanent Arweave Storage**: Decentralized immutable archiving via Irys (`gateway.irys.xyz/<tx_id>`) with 100% SHA-256 proof hash fallback coverage.
3. **Automated Skill Classification**: Zero-cost rule engine categorizing work into 16 skills, 14 protocols, and 10 work categories.
4. **Metaplex Bubblegum cNFTs**: Low-cost compressed NFT credentials (~$0.000005/mint) representing verified builder proof entries and active streaks.
5. **Pixel-Perfect GitHub 365-Day Contribution Heatmap**: Complete 52-week × 7-day grid (`app/components/ContributionHeatmap.tsx`) with month headers (`Jan`..`Dec`), day-of-week labels (`Mon`, `Wed`, `Fri`), 5-level green scale (`#161b22` → `#39d353`), and interactive tooltips.
6. **1-Click SVG NFT Proof Badges**: High-res vector cards with SVG `<tspan>` multi-line text wrapping and mobile WebKit / Phantom Browser modal support (`app/components/NFTBadgeModal.tsx`).
7. **Mobile Universal Deep Links**: 1-tap launchers for Phantom, Solflare, and Backpack to connect directly from mobile Safari, Chrome, and Brave.
8. **Public Verification API**: Read-only JSON endpoint (`/api/verify/[wallet]`) for DAOs, grant committees, and hiring platforms.

---

## 🏗 Architecture & Data Flow

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        User Browser (Client)                           │
│                                                                        │
│  Wallet ──► Write Log ──► Sign SIWS Message (Ed25519 / tweetnacl)      │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                 Server API Engine (/api/log-submit)                    │
│                                                                        │
│  ① Rate Limiter (10 reqs/hr per wallet)                                │
│  ② Replay Check (15-min timestamp freshness window)                    │
│  ③ Cryptographic Signature Verification (tweetnacl)                    │
│  ④ Rule Classifier (Skills, Protocols, Category)                       │
└──────────────┬───────────────────┬───────────────────┬─────────────────┘
               │                   │                   │
               ▼                   ▼                   ▼
┌──────────────────────┐┌──────────────────────┐┌────────────────────────┐
│ ① Supabase (PostgreSQL)││ ② Irys (Arweave)     ││ ③ Metaplex cNFT Engine │
│ Instant querying &   ││ Permanent immutable  ││ State Compression      │
│ RLS security policies││ storage gateway      ││ ~$0.000005/mint        │
└──────────────────────┘└──────────────────────┘└────────────────────────┘
```

---

## 🛠 Tech Stack

| Component | Technology | Role |
|---|---|---|
| **Framework** | Next.js 16 (App Router, TypeScript, Tailwind) | Fullstack App Router |
| **Cryptography** | Tweetnacl (`nacl.sign.detached.verify`), Base58 | Ed25519 Wallet Signature Verification |
| **Database** | Supabase (PostgreSQL with RLS) | Builder indexing, streak calculations, RLS |
| **Permanent Storage**| Irys (`@irys/upload`, `@irys/upload-solana`, Arweave) | Permanent proof storage (`gateway.irys.xyz`) |
| **cNFT Engine** | Metaplex Bubblegum (`@metaplex-foundation/mpl-bubblegum`) | Compressed NFT state compression credentials |
| **Heatmap Engine** | `ContributionHeatmap.tsx` | GitHub-grade 365-day grid with month/day labels |
| **Badge Viewer** | `NFTBadgeModal.tsx` + `badgeGenerator.ts` | Inline SVG viewer & mobile WebKit fallback |
| **Hosting** | Vercel | Auto-deploy on push with strict security headers |
| **Wallet Adapter** | `@solana/wallet-adapter` + Universal Deep Links | Multi-wallet & mobile browser support |

---

## 🛡 Cryptographic Security & System Guarantees

- **Ed25519 Anti-Spoofing**: Submissions require a signed SIWS message:
  `pow-logger.vercel.app wants you to sign in with your Solana account: <pubkey>...`
  Server reconstructs and verifies the payload using `tweetnacl`. Invalid signatures return `401 Unauthorized`.
- **Replay Attack Defense**: Submissions check timestamp freshness (`< 900,000ms drift`).
- **DoS Rate Limiting**: Rate limiting (10 requests/hr per wallet) triggers *before* signature verification.
- **Serverless Secrets**: `SUPABASE_SERVICE_ROLE_KEY` and `IRYS_PRIVATE_KEY` are kept strictly server-side.
- **Production Headers**: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and `Permissions-Policy`.

---

## 📡 Public Verification API (`/api/verify/[wallet]`)

Public read-only REST endpoint for grant committees, DAOs, and dApps to verify builder credentials.

### GET `/api/verify/<wallet_address>`

**Response (HTTP 200 OK):**
```json
{
  "wallet": "7xKp...3mNq",
  "wallet_full": "7xKp123456789012345678901234567890",
  "streak": 18,
  "total_logs": 47,
  "member_since": "2026-07-12",
  "top_skills": ["TypeScript", "Solana", "Irys"],
  "top_protocols": ["Bubblegum", "Irys", "Metaplex"],
  "work_categories": { "Development": 30, "Debugging": 10 },
  "recent_logs": [
    {
      "id": 1,
      "content": "Implemented cNFT minting engine and verified API...",
      "category": "Development",
      "skills": ["TypeScript", "Solana"],
      "created_at": "2026-07-30T10:20:35Z",
      "irys_url": "https://gateway.irys.xyz/65PB9nxZY2GSYrMspm3SXxpTeFJpt11m6ka4Bb2CUfRF"
    }
  ],
  "on_chain_proof_count": 44,
  "verified": true
}
```

---

## 🌳 Metaplex Bubblegum cNFT Setup (Mainnet / Devnet)

To deploy a live Metaplex Bubblegum Concurrent Merkle Tree on-chain:

```bash
# 1. Create a 14-depth Merkle Tree holding up to 16,384 cNFT leaves (~0.02 SOL one-time cost)
npx @metaplex-foundation/cli create-tree --depth 14 --buffer 64 --rpc https://api.mainnet-beta.solana.com

# 2. Add the created Merkle Tree Public Key to Vercel Environment Variables:
SOLANA_MERKLE_TREE_PUBKEY="your_merkle_tree_address"
```

---

## 📁 Repository Structure

```text
pow-logger/
├── app/
│   ├── api/
│   │   ├── log-submit/route.ts   # Verified API submission (Ed25519, rate limit, Irys, cNFT)
│   │   └── verify/[wallet]/      # Public JSON verification endpoint
│   ├── components/
│   │   ├── ContributionHeatmap.tsx # GitHub-grade 365-day contribution heatmap grid
│   │   ├── Footer.tsx            # Cyberpunk ecosystem footer
│   │   ├── NetworkBanner.tsx     # Devnet/mainnet detection banner
│   │   ├── NFTBadgeModal.tsx     # In-app mobile WebKit / Phantom Browser SVG modal
│   │   └── WalletButton.tsx      # SSR-safe wallet connect button
│   ├── lib/
│   │   ├── badgeGenerator.ts     # 1-Click SVG NFT Proof Badge generator with <tspan> wrapping
│   │   ├── classifier.ts         # Rule-based skills & protocols classifier
│   │   ├── cnft.ts               # Metaplex Bubblegum compressed NFT engine
│   │   └── irys.ts               # Client cryptographic submission helper
│   ├── providers/
│   │   └── WalletProvider.tsx    # Solana wallet context provider
│   ├── u/[wallet]/               # Public builder profiles & 365-day heatmaps
│   │   ├── page.tsx              # Server component with dynamic OG tags
│   │   └── ProfileClient.tsx     # Client heatmap, streak stats, & timeline
│   ├── globals.css               # Glassmorphic CSS design system
│   ├── layout.tsx                # Root layout & font stack
│   └── page.tsx                  # Main Proof Foundry logging interface
├── .env.example
├── next.config.ts                # Security headers & serverExternalPackages
├── package.json
└── README.md
```

---

## 🚀 Local Development

```bash
# Clone
git clone https://github.com/dren712/pow-logger.git
cd pow-logger

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env.local
```

Add your credentials to `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL="https://your-supabase-url.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-supabase-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-supabase-service-role-key"
IRYS_PRIVATE_KEY="[your_solana_private_key_json_array]"
```

Run dev server:
```bash
npm run dev
```

---

## 🤝 Contributing

Contributions from the Solana builder community are welcome!

1. **Fork the repository** and create a feature branch (`git checkout -b feature/amazing-feature`).
2. **Install dependencies**: `npm install`.
3. **Run local dev server**: `npm run dev`.
4. **Verify TypeScript compilation**: `npx tsc --noEmit`.
5. **Commit your changes**: `git commit -m "feat: add amazing feature"`.
6. **Open a Pull Request** describing your changes.

---

## 🛡️ Security Policy

### Responsible Disclosure
If you discover a potential security issue, Ed25519 signature bypass, or vulnerability within PoWL, please report it responsibly by emailing **darshangaikwad712@gmail.com** or reaching out directly on GitHub [@dren712](https://github.com/dren712). Please avoid public disclosure until the issue has been investigated and patched.

---

## 👨‍💻 Author

**Darshan Gaikwad** — [GitHub (@dren712)](https://github.com/dren712)  
Built for the Solana builder community. 🗿

---

## 📄 License

This project is open-source software licensed under the [MIT License](LICENSE). Feel free to use, modify, and build upon it!
