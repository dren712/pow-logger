# PROVN Security Policy & Threat Model

PROVN is designed to provide cryptographic evidence of a builder's claims. However, it is essential to understand the strict boundary between what is cryptographically proven and what remains self-attested.

## 1. Cryptographic Guarantees (What PROVN Proves)

When a log is evaluated by PROVN or an independent third-party auditor, the protocol verifies a 4-layer proof model:
* **Signature Authenticity (Layer 1):** The exact Solana wallet address holding the private key explicitly signed the canonical SIWS payload using Ed25519 detached signatures.
* **Protocol Context & Challenge Issuance (Layer 2):** The challenge was issued by the PROVN server, cryptographically signed by an authorized server key (`kid`), and strictly bounded by the issuance window (`iat <= client_timestamp <= exp`).
* **Server Observation & Submission Receipt (Layer 2.5):** The PROVN server observed and ingested the proof, issuing a signed `PROVN_SUBMISSION_RECEIPT` that cryptographically binds to the exact `SHA-256` digest of the canonical signed message (`signed_payload_hash`).
* **Author Identity Attribution (Layer 3):** When linked via SIWS OAuth, PROVN cryptographically establishes that the commit/PR author matches the verified GitHub account bound to the wallet (`source_verified`).
* **Archival Data Availability (Layer 4):** Once archived on Arweave via Irys, the cryptographic envelope becomes an immutable, multi-decade decentralized public record with a verifiable transaction receipt.

## 2. Formal Verification Algorithm Specification (Protocol V2)

Any independent node, auditor, or smart contract can evaluate a PROVN proof offline using the following 7-step algorithm without database access:

```text
1. RECONSTRUCT CANONICAL MESSAGE
   canonicalMsg = reconstructCanonicalSubmitMessage(log)
   assert(canonicalMsg != null)

2. VERIFY WALLET SIGNATURE (Layer 1)
   assert(Ed25519.verify(signature: log.signature, message: canonicalMsg, publicKey: log.wallet_address) == true)

3. VERIFY SERVER CHALLENGE RECEIPT (Layer 2)
   [challengePayload, challengeSig] = log.challenge.split('.')
   challengeObj = JSON.parse(decodeBase58(challengePayload))
   assert(challengeObj.iss == "PROVN")
   assert(challengeObj.wallet == log.wallet_address)
   assert(challengeObj.iat <= log.created_at <= challengeObj.exp)
   assert(Ed25519.verify(signature: challengeSig, message: challengePayload, publicKey: KEY_REGISTRY[challengeObj.kid]) == true)

4. VERIFY SERVER SUBMISSION RECEIPT (Layer 2.5)
   [subPayload, subSig] = log.submission_receipt.split('.')
   subObj = JSON.parse(decodeBase58(subPayload))
   assert(subObj.type == "PROVN_SUBMISSION_RECEIPT")
   assert(subObj.version == 1)
   assert(subObj.iss == "PROVN")
   assert(subObj.wallet == log.wallet_address)
   assert(subObj.challenge_id == log.challenge)
   assert(subObj.proof_id == log.id)

5. VERIFY CANONICAL PROOF HASH BINDING
   expectedHash = SHA256(canonicalMsg)
   assert(subObj.signed_payload_hash == expectedHash)
   assert(Ed25519.verify(signature: subSig, message: subPayload, publicKey: KEY_REGISTRY[subObj.kid]) == true)

6. EVALUATE SOURCE & ARCHIVE STATUS (Layers 3 & 4)
   sourceVerificationMode = "LOCAL_METADATA"  -> sourceStatus = "CLAIMED"
   archiveVerificationMode = "LOCAL_METADATA" -> archiveStatus = "CLAIMED"

7. FINAL STATUS DECISION
   signatureVerified = (Step 2 passed)
   protocolVerified  = (Steps 1, 2, 3, 4, 5 passed)
```

## 3. Assumptions & Limitations (What PROVN Does NOT Prove)

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
