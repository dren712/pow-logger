# PROVN Agent Protocol Specification

**Protocol Identifier**: `PROVN`  
**Protocol Version**: `agent/1`  
**Document Version**: `1.0.0`  
**Status**: `Draft / Reference Implementation`  
**Architecture Track**: `Track B — Verifiable Agent Action Infrastructure`  
**Reference Implementation**: `app/lib/agent/`  

---

## Table of Contents

1. [Protocol Purpose & Architectural Thesis](#1-protocol-purpose--architectural-thesis)
2. [Protocol Versioning](#2-protocol-versioning)
3. [Threat Model & Security Assumptions](#3-threat-model--security-assumptions)
4. [What PROVN Does NOT Prove](#4-what-provn-does-not-prove)
5. [Canonical Event Format](#5-canonical-event-format)
6. [Hash Chain Model](#6-hash-chain-model)
7. [Cryptographic Signature Model](#7-cryptographic-signature-model)
8. [Merkle Tree & Inclusion Proofs](#8-merkle-tree--inclusion-proofs)
9. [Solana Anchor Commitment](#9-solana-anchor-commitment)
10. [Irys Permanent Archival](#10-irys-permanent-archival)
11. [Portable Receipt Format](#11-portable-receipt-format)
12. [Verification Algorithm (7-Step Independent Pipeline)](#12-verification-algorithm-7-step-independent-pipeline)
13. [Security Limitations & Boundary Scope](#13-security-limitations--boundary-scope)
14. [V1 Event Types Specification](#14-v1-event-types-specification)

---

## 1. Protocol Purpose & Architectural Thesis

Autonomous software agents execute increasingly consequential operations: creating and deploying code, manipulating filesystems, executing shell commands, transferring assets, and interacting with external APIs. However, existing execution logging mechanisms are vulnerable to post-hoc tampering, omission, fabrications, and silent modification.

The **PROVN Agent Protocol** provides a verifiable cryptographic provenance layer that allows autonomous software to produce **portable, tamper-evident cryptographic receipts** of their complete execution lifecycle.

### 1.1 Observability vs. Cryptographic Provenance

A critical conceptual distinction separates standard observability tools from PROVN cryptographic provenance:

| Dimension | Observability (Datadog, OpenTelemetry, Sentry) | Cryptographic Provenance (PROVN `agent/1`) |
| :--- | :--- | :--- |
| **Primary Goal** | Real-time monitoring, debugging, alerting, and metrics aggregation. | Verifiable, tamper-evident record of actions and commitments. |
| **Trust Model** | Centralized. Assumes server/database operator is benevolent and uncompromised. | Zero-Trust. Assumes server, database, and transport layers may be malicious. |
| **Tamper Resistance** | None. Logs can be modified, reordered, or deleted by database administrators. | Cryptographic. Any deletion, reordering, or byte mutation breaks hash chains and Merkle roots. |
| **Identity Binding** | Process ID, host IP, or service token (easily spoofed or reassigned). | Asymmetric Ed25519 public keys signing each canonical event at generation time. |
| **Portability** | Confined to proprietary database or vendor dashboard. | Standalone, self-contained JSON receipts verifiable offline without third-party APIs. |
| **L1 Consensus Anchor** | None. | Batched Merkle roots anchored into Solana Program Derived Addresses (PDAs). |
| **Permanent Storage** | Ephemeral or retention-windowed (e.g., 30–90 days). | Permanent decentralized evidence envelopes on Arweave / Irys. |

PROVN does not replace application observability; it provides the **cryptographic trust fabric** on top of which verifiable agent actions can be audited by downstream protocols, smart contracts, DAOs, and third parties.

### 1.2 The Five Separated Primitives of Autonomous Action

To maintain cryptographic rigor and prevent conceptual incoherence as agents become economic actors, PROVN permanently decouples five distinct operational dimensions:

```text
               ┌─────────────────────────┐
               │  Autonomous Settlement  │ (What value moved?)
               ├─────────────────────────┤
               │  Outcome Attestation    │ (What happened because of it?)
               ├─────────────────────────┤
               │  Authorization / Policy │ (Were they allowed to do it?)
               ├─────────────────────────┤
               │  Cryptographic Provenance│ (What did they actually do?)
               ├─────────────────────────┤
               │  Agent Identity         │ (Who is acting?)
               └─────────────────────────┘
```

1. **Identity** (*"Who is acting?"*): The cryptographic agent keypair (Ed25519) establishing non-repudiable actor attribution.
2. **Provenance** (*"What did they actually do?"*): The immutable, monotonically chained, Merkle-batched, and Solana-anchored event log. Provenance does NOT assert that an action was good or authorized; it proves that it definitively happened.
3. **Authorization** (*"Were they allowed to do it?"*): Deterministic evaluation of execution policies, permission boundaries, and allow/deny constraints.
4. **Outcome** (*"What happened because of it?"*): The verified result, execution exit state, output hash, and attestation digests.
5. **Settlement** (*"What value moved because of it?"*): On-chain asset transfers, micropayments, or escrow releases contingent on verified proofs.

PROVN serves as the foundational **Cryptographic Provenance** layer upon which higher-level authorization engines, agent marketplaces, and settlement protocols operate.

---


## 2. Protocol Versioning

The protocol identifier and version string are strictly defined:

- **Protocol Name**: `PROVN`
- **Protocol Version**: `agent/1`
- **Version Number**: `1` (numeric representation used in binary on-chain records)

### 2.1 Domain Separation Constants

To prevent cross-protocol ambiguity, signature collision, and hash reuse attacks, all hashing operations utilize strict domain separation prefixes:

```typescript
export const DOMAIN_SEPARATION = {
  EVENT: 'PROVN-AGENT-EVENT-V1',
  MERKLE_LEAF: 'PROVN-MERKLE-LEAF-V1',
  MERKLE_NODE: 'PROVN-MERKLE-NODE-V1',
} as const
```

### 2.2 Version Compatibility Rules

1. Any modification to the canonical event format, hash derivation rules, Merkle construction, or signature semantics mandates a version increment (e.g., `agent/2`).
2. Verifiers implementing `agent/1` MUST reject any receipt containing an unrecognized protocol version string.
3. Unrecognized event types within `agent/1` MUST cause verification rejection.

---

## 3. Threat Model & Security Assumptions

PROVN operates under a zero-trust model where the agent hosting environment, database operator, indexing layer, and transport network are assumed to be potentially adversarial.

```text
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │                            ADVERSARIAL BOUNDARY                             │
 │                                                                             │
 │   ┌───────────────┐     ┌───────────────┐     ┌─────────────────────────┐   │
 │   │ Compromised   │     │ Malicious DB  │     │ Man-in-the-Middle /     │   │
 │   │ File Storage  │     │ Administrator │     │ Network Interceptor     │   │
 │   └───────┬───────┘     └───────┬───────┘     └────────────┬────────────┘   │
 │           │                     │                          │                │
 │           ▼                     ▼                          ▼                │
 │   ┌─────────────────────────────────────────────────────────────────┐       │
 │   │                      TAMPER ATTEMPTS                            │       │
 │   │  • Bit Flip In Payload       • Event Omission / Deletion        │       │
 │   │  • Event Insertion           • Sequence Reordering              │       │
 │   │  • Signature Substitution    • Merkle Root Replacement          │       │
 │   └─────────────────────────────┬───────────────────────────────────┘       │
 └─────────────────────────────────┼───────────────────────────────────────────┘
                                   │
                                   ▼
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │                         PROVN VERIFICATION ENGINE                           │
 │                                                                             │
 │   [1] Recompute Payload & Event Hash    ──► SHA-256 mismatch detected       │
 │   [2] Verify Ed25519 Detached Signature ──► Invalid signature detected      │
 │   [3] Verify Sequential Chain Linkage   ──► Broken hash chain detected      │
 │   [4] Verify Merkle Inclusion Proofs    ──► Merkle path failure detected    │
 │   [5] Reconstruct Merkle Root           ──► Root divergence detected        │
 │   [6] Verify Solana PDA Anchor          ──► On-chain commitment mismatch   │
 │   [7] Verify Irys Archive Reference     ──► Archive digest mismatch         │
 └─────────────────────────────────────────────────────────────────────────────┘
```

### 3.1 Threat Matrix & Detection Guarantees

| Threat / Attack Vector | Adversary Action | Cryptographic Detection Mechanism | Resulting Verification Failure |
| :--- | :--- | :--- | :--- |
| **Database Tampering** | Mutating event metadata or payload fields in the relational store. | Verifier independently recomputes SHA-256 over the canonical event string. | `EVENT_HASH_MISMATCH` |
| **Event Deletion** | Dropping an intermediate event $E_k$ from the sequence. | Sequence numbers exhibit a gap ($S_{k-1} \rightarrow S_{k+1}$) and hash chain link $E_{k+1}.\text{previousEventHash} \neq E_{k-1}.\text{eventHash}$. | `SEQUENCE_GAP` / `CHAIN_SEVERED` / `MERKLE_ROOT_MISMATCH` |
| **Event Insertion** | Injecting an unauthorized event into an existing execution history. | Injected event cannot produce valid Ed25519 signature from agent key and breaks preceding/succeeding hash linkage. | `CHAIN_SEVERED` / `SIGNATURE_INVALID` / `MERKLE_INCLUSION_INVALID` |
| **Event Reordering** | Swapping the execution order of events $E_a$ and $E_b$. | Sequence monotonic order is violated, and previous event hash links fail. | `SEQUENCE_GAP` / `CHAIN_SEVERED` |
| **Signature Substitution** | Replacing an agent signature with an arbitrary key signature. | Verifier evaluates Ed25519 signature against declared `agentPublicKey`. | `SIGNATURE_INVALID` |
| **Merkle Root Replacement** | Altering the Merkle root in the receipt to match modified events. | Root check fails against the immutable Solana on-chain PDA account state. | `SOLANA_ANCHOR_MISMATCH` |
| **Archive Replacement** | Pointing the receipt to a modified off-chain archive payload. | Archive content hash diverges from on-chain anchor or receipt specification. | `IRYS_ARCHIVE_UNAVAILABLE` / `ARCHIVE_MISMATCH` |
| **Replay Attack** | Submitting the same execution or event multiple times. | Execution IDs are cryptographically random UUIDs; Solana batch PDAs enforce uniqueness per batch ID seed. | `DUPLICATE_EXECUTION` / PDA Collision Rejection |
| **Compromised Agent Key** | Private key stolen by attacker to sign fraudulent actions. | Protocol proves private key produced signature; cannot prove operator was honest. | *Protocol boundary: see Section 4 & 13.* |

---

## 4. What PROVN Does NOT Prove

> [!IMPORTANT]
> PROVN provides cryptographic provenance over **what an agent recorded and signed**. It does **NOT** provide semantic validation, moral safety, or execution correctness guarantees.

The PROVN Agent Protocol explicitly **DOES NOT** prove:

1. **NOT Correctness of Agent Reasoning**: An agent may make invalid logical deductions, formulate flawed plans, or emit incorrect mathematical conclusions. PROVN guarantees the agent signed that specific thought process, not that the thought process is correct.
2. **NOT Safety of Agent Actions**: An agent may issue destructive shell commands (e.g., `rm -rf /` or dropping a production database) or malicious smart contract calls. PROVN records and cryptographically proves that the agent initiated those actions; it does not filter or prevent unsafe actions.
3. **NOT Truthfulness of Agent Output**: An agent may hallucinate, output false statements, or generate fabricated data. PROVN proves that the agent emitted that exact output string, not that the content is factually accurate.
4. **NOT Honesty of Tool Responses**: If an external API, shell subprocess, or filesystem returns fraudulent, mocked, or corrupted data to the agent, PROVN records the hash of the data as received. It does not prove the external tool behaved honestly.
5. **NOT Human Authorization**: In Protocol Version `agent/1`, an agent signature proves possession of the agent's Ed25519 private key. It does not prove that a specific human user authorized, approved, or supervised that individual action.
6. **NOT That Agent Was Uncompromised**: If an agent host is compromised via prompt injection, binary exploitation, or memory exfiltration, the attacker can use the agent's signing key to produce mathematically valid PROVN events. PROVN proves key attribution, not that the agent was free from malware or prompt injection.
7. **NOT That External Systems Behaved Honestly**: PROVN proves the agent's internal view and recorded commitments of external interactions. It does not verify the integrity of third-party RPC nodes, DNS resolvers, or remote host operating systems.

---

## 5. Canonical Event Format

To guarantee deterministic hashing across diverse runtime environments, programming languages, and operating systems, PROVN strictly prohibits raw JSON hashing (`JSON.stringify` is non-deterministic regarding property ordering and whitespace).

All events MUST be formatted into the line-oriented **Canonical Event String** before hashing.

### 5.1 Canonical Event String Specification

The canonical event string consists of exactly **9 lines**, separated by standard Unix newline characters (`\n`, `0x0A`), with zero trailing whitespace:

```text
PROVN-AGENT-EVENT-V1
execution:<executionId>
sequence:<sequence>
agent:<agentPublicKey>
event_type:<eventType>
timestamp:<timestamp>
parent_event:<parentEventId-or-none>
previous_event_hash:<hash-or-none>
payload_hash:<sha256>
```

### 5.2 Field Serialization Rules

| Line # | Field Label | Format / Serialization Rule | Example |
| :--- | :--- | :--- | :--- |
| **1** | *(Domain Prefix)* | Literal string: `PROVN-AGENT-EVENT-V1` | `PROVN-AGENT-EVENT-V1` |
| **2** | `execution:` | Cryptographically random UUID v4 string. | `execution:7c9e6679-7425-40de-944b-e07fc1f90ae7` |
| **3** | `sequence:` | Non-negative integer (0-indexed, ASCII decimal). | `sequence:0` |
| **4** | `agent:` | Base58-encoded 32-byte Ed25519 public key. | `agent:8x2vK9...` |
| **5** | `event_type:` | Valid V1 event type string (see Section 14). | `event_type:agent.started` |
| **6** | `timestamp:` | ISO-8601 UTC timestamp format (`YYYY-MM-DDTHH:mm:ss.sssZ`). | `timestamp:2026-09-02T03:38:08.000Z` |
| **7** | `parent_event:` | Parent UUID v4 string, or literal string `none` if null. | `parent_event:none` |
| **8** | `previous_event_hash:` | 64-character lowercase hex SHA-256 digest, or `none` for sequence 0. | `previous_event_hash:none` |
| **9** | `payload_hash:` | 64-character lowercase hex SHA-256 digest of payload commitment. | `payload_hash:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

### 5.3 Deterministic Payload Commitment Hashing

The `payload_hash` commits to action-specific metadata without leaking raw secrets or sensitive data. Because payloads are arbitrary structured JSON objects, PROVN mandates a recursive deterministic serialization specification (aligned with RFC 8785 JSON Canonicalization Scheme principles):

1. **Primitives**:
   - `null` serializes as `"null"`.
   - `boolean` serializes as `"true"` or `"false"`.
   - `number`: finite IEEE-754 decimal string representation. Non-finite values (`NaN`, `Infinity`, `-Infinity`) are strictly rejected. `-0` is normalized to `"0"`.
   - `string`: standard JSON string escaping with UTF-8 character encoding (`"..."`).
2. **Arrays**:
   - Encased in `[` and `]`, elements separated by `,`.
   - `undefined`, functions, or symbols inside arrays normalize to `null`.
3. **Objects**:
   - Encased in `{` and `}`, key-value pairs separated by `,`.
   - Object keys are sorted strictly lexicographically by UTF-16 code units.
   - Keys and values are joined with `:`.
   - Properties whose values are `undefined`, functions, or symbols are omitted.
4. **Digest Computation**:
   $$\text{payload\_hash} = \operatorname{SHA-256}\big(\operatorname{UTF-8}(\operatorname{canonicalize}(\text{payload}))\big)$$

```typescript
export function computePayloadHash(payload: PayloadCommitment): string {
  const canonical = canonicalize(payload)
  return crypto.createHash('sha256').update(canonical, 'utf-8').digest('hex')
}
```

Cross-language reference implementations (Python, Rust, Go) must produce identical SHA-256 hashes for all standardized test vectors defined in [`tests/canonicalizationVectors.test.ts`](file:///Users/darshangaikwad/pow-logger/tests/canonicalizationVectors.test.ts).

---

## 6. Hash Chain Model

Within a single agent execution, events form an append-only, sequential cryptographic hash chain.

```text
 ┌───────────────────────────┐       ┌───────────────────────────┐       ┌───────────────────────────┐
 │          Event 0          │       │          Event 1          │       │          Event 2          │
 │  (Genesis / agent.started)│       │       (file.read)         │       │     (shell.execute)       │
 ├───────────────────────────┤       ├───────────────────────────┤       ├───────────────────────────┤
 │ Sequence: 0               │       │ Sequence: 1               │       │ Sequence: 2               │
 │ Previous Hash: none       │       │ Previous Hash: Hash(E0) ◄─┼───────┤ Previous Hash: Hash(E1) ◄─┼─── ...
 │ Payload: {...}            │       │ Payload: {...}            │       │ Payload: {...}            │
 ├───────────────────────────┤       ├───────────────────────────┤       ├───────────────────────────┤
 │ EventHash: Hash(E0) ──────┼──────►│ EventHash: Hash(E1) ──────┼──────►│ EventHash: Hash(E2)       │
 │ Signature: Ed25519_Sig(E0)│       │ Signature: Ed25519_Sig(E1)│       │ Signature: Ed25519_Sig(E2)│
 └───────────────────────────┘       └───────────────────────────┘       └───────────────────────────┘
```

### 6.1 Chain Semantics & Invariants

1. **Genesis Event ($S_0$)**:
   $$\text{previousEventHash}(E_0) = \text{null} \quad (\text{represented as literal } \texttt{"none"} \text{ in canonical string})$$

2. **Sequential Events ($S_N$ for $N \ge 1$)**:
   $$\text{previousEventHash}(E_N) = \text{eventHash}(E_{N-1})$$

3. **Strict Monotonicity**:
   $$\operatorname{sequence}(E_N) = N \quad \text{for } N = 0, 1, 2, \dots, K$$
   Sequence numbers MUST begin at 0 and increase by exactly 1 per event without gaps or duplicates.

4. **Event Hash Computation**:
   $$\text{eventHash}(E_N) = \operatorname{SHA-256}\big(\operatorname{buildCanonicalEventString}(E_N)\big)$$

---

## 7. Cryptographic Signature Model

Every individual event in the execution chain is independently signed by the agent's private key.

### 7.1 Signature Specification

- **Algorithm**: Ed25519 (Edwards-curve Digital Signature Algorithm over Curve25519 with SHA-512, RFC 8032 / TweetNaCl).
- **Public Key**: 32-byte Ed25519 public key, serialized as a Base58 string.
- **Signature Output**: 64-byte detached signature, serialized as a Base58 string.

### 7.2 Signing Procedure

The signature is computed strictly over the **raw 32-byte binary SHA-256 digest** of the canonical event string (not over the hex string and not over JSON):

$$\text{hashBytes} = \operatorname{hexToBytes}(\text{eventHash})$$

$$\text{signatureBytes} = \operatorname{Ed25519Sign}(\text{hashBytes}, \text{secretKey})$$

$$\text{signatureBase58} = \operatorname{Base58Encode}(\text{signatureBytes})$$

```typescript
export function signEventHash(eventHashHex: string, secretKey: Uint8Array): string {
  const hashBytes = Buffer.from(eventHashHex, 'hex')
  const signature = nacl.sign.detached(hashBytes, secretKey)
  return bs58.encode(signature)
}
```

---

## 8. Merkle Tree & Inclusion Proofs

To support efficient batch anchoring on Solana and lightweight $O(\log N)$ inclusion verification, event hashes are aggregated into a deterministic Binary Merkle Tree.

```text
                                  ┌─────────────────────────────┐
                                  │         Merkle Root         │
                                  │      Node(N0123, N45)       │
                                  └──────────────┬──────────────┘
                                                 │
                        ┌────────────────────────┴────────────────────────┐
                        ▼                                                 ▼
          ┌───────────────────────────┐                     ┌───────────────────────────┐
          │        Node(N01, N23)     │                     │          Node N45         │
          └─────────────┬─────────────┘                     └─────────────┬─────────────┘
                        │                                                 │
            ┌───────────┴───────────┐                         ┌───────────┴───────────┐
            ▼                       ▼                         ▼                       ▼
      ┌───────────┐           ┌───────────┐             ┌───────────┐           ┌───────────┐
      │ Node(L0,L1)│          │ Node(L2,L3)│            │   Leaf 4  │           │   Leaf 5  │
      └─────┬─────┘           └─────┬─────┘             └─────┬─────┘           └─────┬─────┘
            │                       │                         │                       │
      ┌─────┴─────┐           ┌─────┴─────┐                   │                       │
      ▼           ▼           ▼           ▼                   ▼                       ▼
   ┌─────┐     ┌─────┐     ┌─────┐     ┌─────┐             ┌─────┐                 ┌─────┐
   │Leaf0│     │Leaf1│     │Leaf2│     │Leaf3│             │Leaf4│                 │Leaf5│
   └──┬──┘     └──┬──┘     └──┬──┘     └──┬──┘             └──┬──┘                 └──┬──┘
      │           │           │           │                   │                       │
      ▼           ▼           ▼           ▼                   ▼                       ▼
   Event 0     Event 1     Event 2     Event 3             Event 4                 Event 5
```

### 8.1 Domain-Separated Hash Functions

To prevent second-preimage attacks where an internal node could be interpreted as a leaf, domain separation prefixes are prepended before hashing:

1. **Leaf Hash**:
   $$\text{leafHash} = \operatorname{SHA-256}\big(\texttt{"PROVN-MERKLE-LEAF-V1:"} \mathbin{\Vert} \text{eventHash}\big)$$

2. **Internal Node Hash**:
   $$\text{nodeHash} = \operatorname{SHA-256}\big(\texttt{"PROVN-MERKLE-NODE-V1:"} \mathbin{\Vert} \text{leftHash} \mathbin{\Vert} \text{rightHash}\big)$$

### 8.2 The Odd-Leaf Promotion Rule

When any level of the Merkle tree contains an odd number of nodes, the final un-paired node is **promoted unchanged to the next level**.

> [!NOTE]
> PROVN explicitly **DOES NOT** duplicate odd leaves (avoiding Bitcoin-style CVE-2012-2459 duplicate transaction vulnerabilities). Promotion is deterministic and produces unique Merkle trees for every leaf set.

```typescript
while (currentLevel.length > 1) {
  const nextLevel: string[] = []
  for (let i = 0; i < currentLevel.length; i += 2) {
    if (i + 1 < currentLevel.length) {
      // Pair: hash left and right children
      nextLevel.push(computeNodeHash(currentLevel[i], currentLevel[i + 1]))
    } else {
      // Odd node: promote unchanged (NOT duplicated)
      nextLevel.push(currentLevel[i])
    }
  }
  levels.push(nextLevel)
  currentLevel = nextLevel
}
```

### 8.3 Inclusion Proof Structure

An inclusion proof consists of the target leaf index, the leaf hash, the expected root, and an ordered array of sibling steps:

```typescript
export interface MerkleProofStep {
  hash: string
  direction: 'left' | 'right'
}

export interface MerkleInclusionProof {
  leafIndex: number
  leafHash: string
  proof: MerkleProofStep[]
  root: string
}
```

---

## 9. Solana Anchor Commitment

PROVN anchors batch Merkle roots onto the Solana blockchain. This provides an immutable, global timestamp and state commitment that cannot be rewritten even if the PROVN backend infrastructure is compromised.

### 9.1 PDA Namespace Separation

To maintain strict isolation from human developer proof accounts, agent batch commitments are namespaced under the seed prefix `b"agent_batch"`.

```text
Seeds: [
  b"agent_batch",
  authority.toBuffer(),
  SHA256(batchId)
]
```

```typescript
export function deriveAgentBatchAnchorPda(
  authority: PublicKey,
  batchId: string,
  programId: PublicKey = PROVN_PROGRAM_ID
): [PublicKey, number] {
  const batchIdSeed = crypto.createHash('sha256').update(batchId).digest()
  return PublicKey.findProgramAddressSync(
    [Buffer.from('agent_batch'), authority.toBuffer(), batchIdSeed],
    programId
  )
}
```

### 9.2 On-Chain Account Binary Layout

The `AgentBatchAnchor` account occupies exactly **161 bytes** on Solana:

```text
 0               8              40              72             104   108    116   117          160 161
┌───────────────┬───────────────┬───────────────┬───────────────┬─────┬──────┬─────┬────────────┬───┐
│ Discriminator │ Batch ID Hash │   Authority   │  Merkle Root  │Count│ Time │ Ver │ Archive Tx │Bmp│
│   (8 bytes)   │  (32 bytes)   │  (32 bytes)   │  (32 bytes)   │(4 B)│(8 B) │(1 B)│ (43 bytes) │1 B│
└───────────────┴───────────────┴───────────────┴───────────────┴─────┴──────┴─────┴────────────┴───┘
```

| Field Name | Type | Size | Description |
| :--- | :--- | :--- | :--- |
| `discriminator` | `[u8; 8]` | 8 bytes | `SHA256("global:anchor_agent_batch")[0..8]` Anchor discriminator. |
| `batch_id` | `[u8; 32]` | 32 bytes | SHA-256 digest of the unique `batchId` string. |
| `authority` | `Pubkey` | 32 bytes | Solana public key of the anchoring authority wallet. |
| `merkle_root` | `[u8; 32]` | 32 bytes | Raw 32-byte Merkle root committing to all batched events. |
| `event_count` | `u32` | 4 bytes | Total number of events contained in the batch (Little Endian). |
| `timestamp` | `i64` | 8 bytes | Unix timestamp in seconds at time of anchor (Little Endian). |
| `protocol_version` | `u8` | 1 byte | Protocol numeric version (`1`). |
| `archive_tx_id` | `[u8; 43]` | 43 bytes | Base64URL-encoded Arweave / Irys transaction ID (fixed width). |
| `bump` | `u8` | 1 byte | PDA canonical bump seed. |

---

## 10. Irys Permanent Archival

While Solana provides consensus and immutable state commitments, storing full event payloads and tool execution outputs directly in Solana accounts would be cost-prohibitive.

PROVN utilizes **Irys / Arweave** for permanent decentralized data availability.

### 10.1 Role in Trust Architecture

- **Solana Consensus (Layer 1)**: Authoritative state and Merkle root commitment (the *Source of Truth*).
- **Irys / Arweave (Layer 2)**: Complete, unpruned execution envelope and payload storage (the *Evidence Availability Layer*).
- **Independent Verifier**: Downloads envelope from Irys, reconstructs Merkle root locally, and matches it against the Solana PDA.

```text
                              ┌────────────────────────┐
                              │ Complete Agent Receipt │
                              │   (Events + Payloads)  │
                              └───────────┬────────────┘
                                          │
                     ┌────────────────────┴────────────────────┐
                     ▼                                         ▼
        ┌─────────────────────────┐               ┌─────────────────────────┐
        │     Irys / Arweave      │               │     Solana Program      │
        │       (Layer 2)         │               │        (Layer 1)        │
        ├─────────────────────────┤               ├─────────────────────────┤
        │ • Full JSON Envelope    │               │ • 32-byte Merkle Root   │
        │ • Payloads & Metadata   │               │ • Batch ID Hash         │
        │ • Permanent Retention   │               │ • Event Count           │
        └─────────────────────────┘               └─────────────────────────┘
```

---

## 11. Portable Receipt Format

A PROVN Agent Receipt is a self-contained, standalone JSON document that encapsulates all data required for an external party to verify an execution without network access to PROVN servers.

### 11.1 JSON Schema Specification

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "PROVN-Agent-Receipt",
  "type": "object",
  "required": [
    "protocol",
    "version",
    "generatedAt",
    "execution",
    "events",
    "batch",
    "merkle",
    "solana",
    "irys"
  ],
  "properties": {
    "protocol": { "type": "string", "enum": ["PROVN"] },
    "version": { "type": "string", "enum": ["agent/1"] },
    "generatedAt": { "type": "string", "format": "date-time" },
    "execution": {
      "type": "object",
      "required": ["executionId", "agentPublicKey", "startedAt", "status", "eventCount", "protocolVersion"],
      "properties": {
        "executionId": { "type": "string", "format": "uuid" },
        "agentPublicKey": { "type": "string" },
        "startedAt": { "type": "string", "format": "date-time" },
        "completedAt": { "type": ["string", "null"], "format": "date-time" },
        "status": { "type": "string", "enum": ["running", "completed", "failed"] },
        "eventCount": { "type": "integer", "minimum": 1 },
        "terminalEventHash": { "type": ["string", "null"] },
        "merkleRoot": { "type": ["string", "null"] },
        "anchorReference": { "type": ["object", "null"] },
        "protocolVersion": { "type": "string", "enum": ["agent/1"] }
      }
    },
    "events": {
      "type": "array",
      "items": {
        "type": "object",
        "required": [
          "eventId",
          "executionId",
          "sequence",
          "agentPublicKey",
          "eventType",
          "timestamp",
          "parentEventId",
          "previousEventHash",
          "payloadHash",
          "eventHash",
          "signature",
          "protocolVersion"
        ]
      }
    },
    "batch": { "type": "object" },
    "merkle": {
      "type": "object",
      "required": ["root", "leafCount", "leaves", "proofs"],
      "properties": {
        "root": { "type": "string" },
        "leafCount": { "type": "integer" },
        "leaves": { "type": "array", "items": { "type": "string" } },
        "proofs": { "type": "array" }
      }
    },
    "solana": { "type": ["object", "null"] },
    "irys": { "type": ["object", "null"] }
  }
}
```

---

## 12. Verification Algorithm (7-Step Independent Pipeline)

An independent verifier NEVER trusts stored hashes, flags, or receipts. The verification algorithm recomputes every cryptographic artifact from scratch in a strict 7-step sequence:

```text
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │                         7-STEP VERIFICATION PIPELINE                        │
 └─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
  [Step 1] RECOMPUTE EVENT HASHES
           For each event: CanonicalString(E_i) ──► ComputedHash(E_i)
           Assert ComputedHash(E_i) == StoredEventHash(E_i)
                                       │
                                       ▼
  [Step 2] VERIFY AGENT SIGNATURES
           For each event: Ed25519Verify(ComputedHash(E_i), Sig_i, AgentPubKey)
           Assert Sig == Valid
                                       │
                                       ▼
  [Step 3] VERIFY HASH CHAIN CONTINUITY
           Assert E_0.previousEventHash == null ("none")
           For i from 1 to N: Assert E_i.previousEventHash == ComputedHash(E_{i-1})
           Assert Monotonic Sequence (0, 1, 2, ..., N)
                                       │
                                       ▼
  [Step 4] VERIFY MERKLE INCLUSION PROOFS
           For each event leaf: Walk sibling path with domain separation
           Assert PathResult == ProofRoot
                                       │
                                       ▼
  [Step 5] RECONSTRUCT FULL MERKLE ROOT
           Build complete Merkle tree from all computed leaf hashes
           Assert ReconstructedRoot == ReceiptMerkleRoot
                                       │
                                       ▼
  [Step 6] VERIFY SOLANA ON-CHAIN ANCHOR
           Derive PDA [b"agent_batch", authority, SHA256(batchId)]
           Fetch on-chain account data ──► Assert OnChainRoot == ReconstructedRoot
                                       │
                                       ▼
  [Step 7] VERIFY IRYS EVIDENCE AVAILABILITY
           Fetch payload envelope from Irys Gateway via txId
           Assert EnvelopePayloadHash == CommittedPayloadHash
```

### 12.1 Algorithmic Specification

```
Algorithm: VerifyAgentReceipt(Receipt, Options)
Input:  Receipt R, Options Opt
Output: VerificationResult { verified: Boolean, layers: Map, failures: List }

1. Sort R.events by sequence ascending.
2. Initialize Failures = []

// Step 1, 2, 3: Event Hashes, Signatures, and Hash Chain
3. For i = 0 to length(R.events) - 1:
     Event = R.events[i]
     
     // Monotonic sequence check
     If Event.sequence != i:
       Append SEQUENCE_GAP / SEQUENCE_DUPLICATE to Failures
       
     // Recompute event hash from canonical string
     ComputedHash = SHA256(BuildCanonicalEventString(Event))
     If ComputedHash != Event.eventHash:
       Append EVENT_HASH_MISMATCH to Failures
       
     // Verify Ed25519 signature against recomputed hash
     If Not Ed25519Verify(ComputedHash, Event.signature, Event.agentPublicKey):
       Append SIGNATURE_INVALID to Failures
       
     // Hash chain linkage check
     If i == 0:
       If Event.previousEventHash != null:
         Append CHAIN_SEVERED to Failures
     Else:
       PrevEvent = R.events[i - 1]
       If Event.previousEventHash != PrevEvent.eventHash:
         Append CHAIN_SEVERED to Failures

// Step 4: Merkle Inclusion Proofs
4. For i = 0 to length(R.events) - 1:
     Proof = FindProofByLeafIndex(R.merkle.proofs, i)
     If Proof is null:
       Append MERKLE_INCLUSION_INVALID to Failures
     Else:
       ComputedLeaf = SHA256("PROVN-MERKLE-LEAF-V1:" || RecomputedHash[i])
       Current = ComputedLeaf
       For each Step in Proof.steps:
         If Step.direction == 'left':
           Current = SHA256("PROVN-MERKLE-NODE-V1:" || Step.hash || Current)
         Else:
           Current = SHA256("PROVN-MERKLE-NODE-V1:" || Current || Step.hash)
       If Current != Proof.root:
         Append MERKLE_INCLUSION_INVALID to Failures

// Step 5: Full Merkle Root Reconstruction
5. ReconstructedLeaves = Map(R.events, e => SHA256("PROVN-MERKLE-LEAF-V1:" || RecomputedHash(e)))
6. ReconstructedRoot = BuildMerkleRootBottomUp(ReconstructedLeaves)
7. If ReconstructedRoot != R.merkle.root:
     Append MERKLE_ROOT_MISMATCH to Failures

// Step 6: Solana Anchor Check (if not skipped)
8. If Opt.skipSolana is false and R.solana is present:
     [PDA] = DeriveAgentBatchAnchorPda(R.solana.authority, R.batch.batchId)
     OnChainAccount = FetchSolanaAccount(PDA)
     If OnChainAccount is null:
       Append SOLANA_ANCHOR_NOT_FOUND to Failures
     Else If OnChainAccount.merkleRoot != ReconstructedRoot:
       Append SOLANA_ANCHOR_MISMATCH to Failures

// Step 7: Irys Archive Check (if not skipped)
9. If Opt.skipIrys is false and R.irys is present:
     ArchiveData = FetchIrysUrl(R.irys.url)
     If ArchiveData is unreachable:
       Append IRYS_ARCHIVE_UNAVAILABLE to Failures

10. Return VerificationResult(Failures.isEmpty())
```

---

## 13. Security Limitations & Boundary Scope

Protocol implementers and consumers MUST account for the following security constraints:

### 13.1 Agent Identity Architecture: Persistent Identity vs. Ephemeral Keys
In Protocol Version `agent/1`, an agent identity is defined by an Ed25519 public key.
- **Ephemeral Keys (Demo / Sandbox Only)**: Instantiating the SDK without an explicit keypair generates an ephemeral keypair in memory. While convenient for rapid prototyping, a process restart creates a completely new identity, breaking identity continuity across runs.
- **Persistent Identity (Production Requirement)**: Enterprise and production autonomous software **MUST** initialize the agent with a persistent Ed25519 keypair loaded from an encrypted secrets manager, environment variable (`AGENT_PRIVATE_KEY_BASE58`), or hardware security module (HSM / KMS):
  ```typescript
  import nacl from 'tweetnacl'
  import bs58 from 'bs58'
  import { Provn } from '@provn/sdk'

  const secretKey = bs58.decode(process.env.AGENT_SOVEREIGN_SECRET_KEY!)
  const persistentKeypair = nacl.sign.keyPair.fromSecretKey(secretKey)

  const provn = new Provn({
    keypair: persistentKeypair,
    agentName: 'production-treasury-bot-01',
  })
  ```
Key rotation within a single running execution chain is not supported in `agent/1`. If an agent keypair is compromised during an active execution, all events signed by that key up to the compromise point remain mathematically valid, but operator trustworthiness cannot be established retroactively.

### 13.2 Delegation & Sub-Identities
Protocol Version `agent/1` provides structural parent/child linkage via `parentExecutionId`, allowing child executions to reference parent sessions. However, `agent/1` does not yet enforce on-chain capability attenuation certificates (e.g., UCANs / Macaroons). A single Ed25519 identity signs all events within each execution session. Cryptographic delegation verification is reserved for future protocol revisions (`agent/2`).

### 13.3 Data Model & Privacy Architecture: The 3-Tier Commitment Rule
PROVN operational databases store event `payload` as JSONB to enable Layer 3 deterministic policy audits and forensic timeline exploration. To balance audit transparency with enterprise data privacy, agents MUST adhere to the **3-Tier Data Model**:

1. **Tier 1: Public Action Metadata (Committed Directly in `payload`)**
   - High-level, observable execution context: tool name (`vault.get_reserves`), target URI (`solana:mainnet-beta`), HTTP status codes, exit codes (`0`), timestamps, execution intent, and completion summaries.
2. **Tier 2: Off-Chain Content Commitments (Committed as SHA-256 Hashes)**
   - Heavy payloads, source code diffs, database query records, and detailed tool inputs/outputs **MUST NOT** be embedded raw. Instead, compute and commit their SHA-256 hex digests into standard fields: `contentHash`, `inputCommitment`, `outputCommitment`, and `diffHash`.
   - The verifier validates the hashes without exposing underlying proprietary business data.
3. **Tier 3: Strictly Forbidden Sensitive Data (Zero Ingestion)**
   - Raw enterprise credentials, private API keys (`sk-...`), passwords, database passwords, session tokens, cookie headers, and unencrypted customer PII **MUST NEVER** be placed in payload commitments.
   - The PROVN SDK includes a recursive sensitive data scanner (`scanForSensitiveData`) enabled by default. Any payload containing secret-like keys throws `SENSITIVE_DATA_DETECTED` at runtime.

---

## 14. V1 Event Types Specification

The `agent/1` protocol defines a catalog of core and extensible action event types. Unrecognized event types are strictly prohibited.

| Event Type | Category | Description | Key Payload Fields |
| :--- | :--- | :--- | :--- |
| `agent.started` | Lifecycle | Emitted when an agent begins a named task execution. | `taskDescription`, `agentName` |
| `agent.completed` | Lifecycle | Emitted upon successful task completion with summary. | `summary`, `eventCount` |
| `agent.failed` | Lifecycle | Emitted when execution terminates abnormally with error. | `error`, `lastSuccessfulSequence` |
| `tool.request` | Action | Invocation request dispatched to an external tool or API. | `toolName`, `inputHash` |
| `tool.response` | Action | Output or result returned by the external tool. | `toolName`, `outputHash`, `success` |
| `file.read` | Filesystem | Read operation on local or remote file storage. | `path`, `contentHash`, `sizeBytes` |
| `file.write` | Filesystem | Creation, modification, or deletion of a file. | `path`, `contentHash`, `previousContentHash`, `sizeBytes`, `operation` |
| `shell.execute` | System | Execution of a shell command or OS subprocess. | `commandHash`, `cwdHash`, `exitCode`, `stdoutHash`, `stderrHash` |
| `git.operation` | VCS | Version control operation (commit, push, checkout). | `operation`, `ref`, `commitHash` |
| `deployment.request` | DevOps | Request to deploy code or infrastructure. | `targetEnvironment`, `deploymentConfigHash` |
| `deployment.result` | DevOps | Outcome of deployment operation. | `targetEnvironment`, `success`, `endpointHash` |
| `payment.intent` | Economic | Autonomous payment intent declared before settlement. | `recipient`, `amount`, `currency`, `memo` |
| `payment.executed` | Economic | Payment transaction confirmed on-chain or through gateway. | `txSignature`, `recipient`, `amount`, `currency` |
| `contract.interaction` | Smart Contract | Call dispatched to an on-chain program or contract. | `programId`, `method`, `instructionHash` |
| `outcome.attestation` | Attestation | Verifiable attestation of external effect or delivery. | `outcomeType`, `summary`, `success` |


### 14.1 Payload Schemas (TypeScript Reference)

```typescript
export interface FileReadPayload extends PayloadCommitment {
  type: 'file.read'
  path: string
  contentHash: string
  sizeBytes: number
}

export interface FileWritePayload extends PayloadCommitment {
  type: 'file.write'
  path: string
  contentHash: string
  previousContentHash: string | null
  sizeBytes: number
  operation: 'create' | 'modify' | 'delete'
}

export interface ShellExecutePayload extends PayloadCommitment {
  type: 'shell.execute'
  commandHash: string
  cwdHash: string
  exitCode: number
  stdoutHash: string
  stderrHash: string
}

export interface AgentStartedPayload extends PayloadCommitment {
  type: 'agent.started'
  taskDescription: string
  agentName?: string
}

export interface AgentCompletedPayload extends PayloadCommitment {
  type: 'agent.completed'
  summary: string
  eventCount: number
}

export interface AgentFailedPayload extends PayloadCommitment {
  type: 'agent.failed'
  error: string
  lastSuccessfulSequence: number
}

export interface ToolRequestPayload extends PayloadCommitment {
  type: 'tool.request'
  toolName: string
  inputHash: string
}

export interface ToolResponsePayload extends PayloadCommitment {
  type: 'tool.response'
  toolName: string
  outputHash: string
  success: boolean
}

export interface GitOperationPayload extends PayloadCommitment {
  type: 'git.operation'
  operation: 'commit' | 'push' | 'pull' | 'checkout' | 'merge'
  ref?: string
  commitHash?: string
}

export interface PaymentIntentPayload extends PayloadCommitment {
  type: 'payment.intent'
  recipient: string
  amount: string
  currency: string
  memo?: string
}

export interface PaymentExecutedPayload extends PayloadCommitment {
  type: 'payment.executed'
  txSignature: string
  recipient: string
  amount: string
  currency: string
  status: 'confirmed' | 'failed'
}

export interface ContractInteractionPayload extends PayloadCommitment {
  type: 'contract.interaction'
  programId: string
  method: string
  instructionHash: string
  txSignature?: string
}

export interface OutcomeAttestationPayload extends PayloadCommitment {
  type: 'outcome.attestation'
  outcomeType: string
  summary: string
  targetEntity?: string
  success: boolean
}
```


---

## 15. Summary & Reference

The PROVN Agent Protocol (`agent/1`) establishes an open, verifiable standard for autonomous software provenance. By anchoring hash-chained, signed event logs into Solana PDAs and backing them with Arweave / Irys permanent storage, PROVN creates an unimpeachable audit trail that enables third-party verification, cross-agent coordination, and cryptographic trust in agentic workflows.
