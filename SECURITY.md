# PROVN Security Policy & Threat Model

PROVN is designed to provide cryptographic evidence of a builder's claims. However, it is essential to understand the strict boundary between what is cryptographically proven and what remains self-attested.

## 1. Cryptographic Guarantees (What PROVN Proves)

When a log is successfully submitted and verified, PROVN evaluates and guarantees the following distinct layers:
* **Signature Authenticity (Layer 1):** The exact Solana wallet address holding the private key explicitly signed the canonical payload using Ed25519 detached signatures.
* **Protocol Validity & Server-Bounded Timestamp (Layer 2):** The payload contains a valid server-issued challenge bound to the submitting wallet, was submitted within a strict ±15 minute observation window (`±900,000ms`) of the server's clock, and was atomically consumed.
* **Replay Defense (Layer 2):** Database-level unique signature constraints and atomic challenge consumption prevent re-submitting previously used signatures or challenges.
* **Author Identity Verification (Layer 3):** When linked via SIWS OAuth, PROVN cryptographically establishes that the commit/PR author matches the verified GitHub account bound to the wallet (`source_verified`).
* **Archival Data Availability (Layer 4):** Once archived on Arweave via Irys, the cryptographic envelope becomes an immutable, multi-decade decentralized public record with a verifiable transaction receipt.

## 2. Assumptions & Limitations (What PROVN Does NOT Prove)

PROVN provides the *cryptographic wrapper* around a claim, but the claim itself may be false. Reviewers MUST independently verify the claims.
* **Work Quality / Truthfulness:** PROVN does NOT prove that the builder actually performed the work they claim to have done in the text content, nor does it evaluate code quality.
* **Identity & Attribution:** The integration establishes a strict cryptographic binding: `Wallet -> SIWS Challenge -> Server OAuth State (PKCE) -> Immutable GitHub ID -> Commit Author ID`. PROVN proves that the commit author matches the linked GitHub account, but it does NOT prove the user holds access to the original repository beyond that specific contribution.
* **Anti-Gaming:** There is currently no algorithmic prevention against a user submitting low-effort logs purely to maintain a daily streak. The system enforces a strict maximum quota of 3 logs per day per wallet, but relies on human reviewers (DAOs, grant committees) to assess the quality of those logs.

## 3. Database Security & Transactional Hardening

* **Transactional Challenge & Quota Enforcement:** Signing challenge consumption, daily quota incrementation (3 logs/day), and row insertion execute within a single atomic PostgreSQL transaction (`atomic_insert_log`). Quota exhaustion or challenge invalidation causes immediate rollback.
* **Atomic OAuth State Consumption:** OAuth state records use single-operation atomic updates with `consumed_at` tracking and PKCE (`S256` code challenge / code verifier) verification to prevent CSRF and replay attacks.
* **Row-Level Security (RLS):** Anonymous clients have read-only `SELECT` access to public logs. All mutations are restricted to the `service_role`.
* **Rate Limiting:** Pre-verification in-memory rate limiting operates as a first-line UX barrier; authoritative replay defense and quota enforcement are enforced by PostgreSQL.

## 4. Responsible Disclosure

If you discover a vulnerability that compromises the Ed25519 signature verification, replay protection, or allows bypassing the daily quota, please report it privately:

* **Email:** security@provn.dev
* **Direct Message:** Contact the core maintainers on X/Twitter or Telegram.

Please do not open a public GitHub issue for critical security vulnerabilities.
