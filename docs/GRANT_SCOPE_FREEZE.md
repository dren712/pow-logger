# PROVN v2 — Grant Scope Freeze & Protocol Specification
**Document Status**: FROZEN  
**Protocol Version**: `agent/1`  
**Target Submission**: Solana Foundation / Web3 Infrastructure Grant  
**Repository**: [`dren712/pow-logger`](https://github.com/dren712/pow-logger) (`v2` branch)

---

## 1. The Core Thesis

> **AI agents are shifting from read-only chatbots to autonomous systems executing consequential real-world actions (deploying code, calling external APIs, moving money, signing contracts). Today, agent observability is "trust-me" logging stored in mutable databases. PROVN turns autonomous agent traces into self-contained, cryptographically sealed, portable receipts anchored to Solana Layer 1 and archived to Irys/Arweave.**

PROVN does not attempt to build autonomous payments, autonomous coding agents, or agent marketplaces. **PROVN builds the universal trust layer that sits underneath all of them.**

```text
                  AUTONOMOUS AGENT ACTION
        (GitHub Commit, Tool Call, Shell Command, Payment)
                             │
                             ▼
                 1. SOVEREIGN Ed25519 KEY
          (Deterministic canonical event signing)
                             │
                             ▼
                 2. MONOTONIC HASH CHAIN
         (Parent-linked SHA-256 integrity chain)
                             │
                             ▼
                 3. MERKLE BATCH COMMITMENT
      (Domain-separated tree: PROVN-MERKLE-LEAF-V1)
                             │
              ┌──────────────┴──────────────┐
              ▼                             ▼
    4. SOLANA DEVNET ANCHOR        5. IRYS ARCHIVAL
    (PDA: b"agent_batch", L1)      (Decentralized Arweave)
              │                             │
              └──────────────┬──────────────┘
                             ▼
                 6. PORTABLE RECEIPT (.json)
                             │
                             ▼
           7. INDEPENDENT AIR-GAPPED VERIFIER
   (Proves authenticity even if database is 100% corrupted)
```

---

## 2. The 5 Immutable Guarantees of PROVN `agent/1`

| Invariant | Cryptographic Mechanism | Attack Defeated |
| :--- | :--- | :--- |
| **1. Identity Binding** | Ed25519 detached signatures over PROVN agent/1 canonical line-oriented event representations | An attacker cannot impersonate an agent or sign actions without the agent's private key. |
| **2. Payload Integrity** | Double-hash commitment: `computePayloadHash(payload) === payloadHash` | A compromised database administrator cannot alter event arguments ($5k $\rightarrow$ $50k) without invalidating the receipt. |
| **3. Causal Continuity** | SHA-256 previous event hash chaining: `ev[n].previousEventHash === hash(ev[n-1])` | An adversary cannot delete, reorder, or inject actions without breaking the chain. |
| **4. Tamper-Proof Sealing** | Domain-separated Merkle root: `SHA256("PROVN-MERKLE-LEAF-V1:" \|\| eventHash)` | Individual actions are cryptographically proven members of a sealed batch via inclusion proofs. |
| **5. Layer 1 Consensus** | Deterministic Solana PDA: `[b"agent_batch", authority, SHA256(batchId)]` | An attacker who rewrites the entire PostgreSQL database is refuted by public Solana ledger state. |

---

## 3. Explicit Boundaries: What PROVN Does NOT Claim

To ensure absolute credibility with grant evaluators and security reviewers, PROVN explicitly publishes what it does **not** prove:

1. **NOT Agent Intent or Safety**: PROVN proves an action occurred and was signed by key $K$; it does not judge whether the agent's reasoning was benevolent, safe, or optimal.
2. **NOT External System Truth**: PROVN proves what tool inputs/outputs were recorded; it cannot verify if an external third-party API returned honest data.
3. **NOT Human Authorization**: Unless paired with a human co-signer, an agent signature proves autonomous software execution, not human approval.
4. **NOT Key Security**: If an agent operator leaks their private key, an attacker can produce validly signed traces. PROVN guarantees key attribution, not host enclave security.

---

## 4. Operational Architecture (Frozen)

### A. Server & Database
- **PostgreSQL / Supabase**: High-speed operational buffer and query layer.
- **Strict Atomic Finalization**: `/api/agent/finalize` invokes `finalize_agent_execution` inside a single PostgreSQL transaction. The sequential non-atomic fallback is **strictly disabled** (fails closed with `503 FINALIZATION_UNAVAILABLE`).
- **Transactional Outbox Worker**: Polling worker with lease locking (`FOR UPDATE SKIP LOCKED`) and exponential backoff for Solana anchoring and Irys uploads.

### B. Client SDK & CLI
- **`Provn` / `ProvnExecution`**: Ergonomic TypeScript SDK with 12 typed action helpers (`toolRequest`, `toolResponse`, `fileRead`, `fileWrite`, `shell`, `git`, `deploymentRequest`, `deploymentResult`, `paymentIntent`, `paymentExecuted`, `contractInteraction`, `outcome`).
- **Sensitive Data Scanner**: Blocks accidental leakage of raw credentials (`api_key`, `secret`, `private_key`).
- **Standalone Air-Gapped CLI**: `npx provn verify <receipt.json>` verifies all cryptographic layers offline without database or network dependency.

### C. Public Verification Console
- **Interactive 6-Node Proof Chain**: Visualizes the step-by-step cryptographic elevation from agent key to Solana PDA.
- **6-Link Verification Checklist**: Validates signatures, payload hashes, hash chain, Merkle inclusion, Solana anchor, and Irys archive.

---

## 5. Demonstration Battery

The grant submission is backed by two reproducible demonstration scripts:
1. **`scripts/agent-demo/live-tamper-e2e.ts`**:
   - Executes full agent session $\rightarrow$ produces portable receipt $\rightarrow$ runs 4 fatal database attacks $\rightarrow$ proves every attack fails independent verification.
2. **`scripts/agent-demo/demo-phase2.ts`**:
   - Connects to Solana Devnet and Supabase, demonstrating real blockchain transaction creation and PDA anchoring.
