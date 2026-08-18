# PROVN Security Policy & Threat Model

PROVN is designed to provide cryptographic evidence of a builder's claims. However, it is essential to understand the strict boundary between what is cryptographically proven and what remains self-attested.

## 1. Cryptographic Guarantees (What PROVN Proves)

When a log is successfully submitted and verified, PROVN cryptographically guarantees the following:
* **Author Authenticity:** The exact Solana wallet address holding the private key explicitly signed the canonical payload.
* **Content Integrity:** The exact string of text, evidence URL, and GitHub URL submitted were signed; any subsequent modification invalidates the Ed25519 signature.
* **Timestamp Boundedness:** The payload was signed and submitted within a strict 15-minute window (`±900,000ms`) of the server's clock, preventing backdated logs.
* **Replay Defense:** A unique database-level constraint prevents the exact same signature from being submitted twice.
* **Data Permanence:** Once archived on Arweave via Irys, the cryptographic envelope (including the original signature) becomes an immutable, decentralized public record.

## 2. Assumptions & Limitations (What PROVN Does NOT Prove)

PROVN provides the *cryptographic wrapper* around a claim, but the claim itself may be false. Reviewers MUST independently verify the claims.
* **Work Quality / Truthfulness:** PROVN does NOT prove that the builder actually performed the work they claim to have done in the text content.
* **Identity & Attribution:** The integration establishes a strict cryptographic binding: `Wallet -> SIWS Challenge -> Server OAuth State -> Immutable GitHub ID -> Commit Author ID`. PROVN proves that the commit author matches the linked GitHub account, but it does NOT prove the user holds access to the original repository beyond that specific contribution.
* **Anti-Gaming:** There is currently no algorithmic prevention against a user submitting low-effort or nonsensical logs purely to inflate their daily streak. The system enforces a strict maximum quota of 3 logs per day per wallet, but relies on human reviewers (DAOs, grant committees) to assess the quality of those logs.

## 3. Rate Limiter Caveats

The pre-verification rate limiter (which protects the `/api/log-submit` endpoint from spam) uses an **in-memory implementation**.
* **Limitation:** In serverless environments like Vercel, this in-memory state resets upon cold starts and is not shared across Lambda instances.
* **Impact:** This exists purely as a first-line UX protection. Authoritative anti-spam, replay defense, and daily quota limits (max 3 logs/day) are strictly and atomically enforced inside the PostgreSQL database using a transactional `INSERT ... ON CONFLICT` strategy against a dedicated `daily_quotas` table.

## 4. Responsible Disclosure

If you discover a vulnerability that compromises the Ed25519 signature verification, replay protection, or allows bypassing the daily quota, please report it privately:

* **Email:** security@provn.dev
* **Direct Message:** Contact the core maintainers on X/Twitter or Telegram.

Please do not open a public GitHub issue for critical security vulnerabilities.
