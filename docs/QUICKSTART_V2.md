# PROVN v2.1 Quickstart Guide 🛡️🤖
## Zero-Trust Cryptographic Provenance for Autonomous Software in Under 3 Minutes

PROVN allows any autonomous AI agent, coding swarm, or workflow engine to produce **independently verifiable, cryptographically sealed receipts** of its execution.

Anyone can verify what an agent did, whether it conformed to policy, and prove that operational databases were not tampered with—**without trusting PROVN's servers**.

---

## 1. Installation

```bash
npm install @provn/sdk
# or via pnpm / yarn
pnpm add @provn/sdk
```

---

## 2. Basic Agent Integration (4 Methods)

Instrument any AI agent in 5 lines of code:

```typescript
import { Provn } from '@provn/sdk'

// 1. Initialize PROVN client (generates sovereign Ed25519 keypair automatically)
const provn = new Provn({
  apiKey: process.env.PROVN_API_KEY,      // Optional in local sandbox
  agentName: 'autonomous-engineer-01'
})

// 2. Start execution session with declared intent
const execution = await provn.start({
  agent: 'autonomous-engineer-01',
  intent: 'Fix database connection timeout in production cluster',
  metadata: { priority: 'P0', repository: 'acme/backend' }
})

// 3. Log consequential actions as they occur (signed client-side in <0.1ms)
await execution.action({
  type: 'file_read',
  target: 'src/db/pool.ts',
  metadata: { lineCount: 140 }
})

await execution.action({
  type: 'tool_call',
  tool: 'github.create_pull_request',
  target: 'acme/backend',
  input: { branch: 'fix/db-pool-timeout', base: 'main' },
  output: { prNumber: 842, url: 'https://github.com/acme/backend/pull/842' }
})

// 4. Record the final external outcome
await execution.outcome({
  status: 'success',
  prUrl: 'https://github.com/acme/backend/pull/842',
  summary: 'Bumped max pool connections to 50 and set connectionTimeoutMillis to 5000'
})

// 5. Seal execution and generate portable receipt
const receipt = await execution.complete()
console.log('Proof URL:', receipt.proofUrl)
console.log('Merkle Root:', receipt.merkle.root)
```

---

## 3. Independent Verification (Air-Gapped CLI)

Anyone who receives an agent receipt can independently verify it **offline with zero dependencies**:

```bash
# Verify cryptographic validity and policy compliance
npx provn agent verify receipt.json
```

### Expected Output
```text
=================================================================================
   🛡️  PROVN AUTONOMOUS AGENT RECEIPT VERIFIER (INDEPENDENT CRYPTO ENGINE)     
=================================================================================

Protocol Version:    agent/1
Execution ID:        43f9fc3d-951f-4149-b33c-72647fd90e7b
Agent Sovereign Key: DppNPGCUquREsi1zjfoJE3pjdD7EPz7iC6rzrcC6H9JX
Task Intent:         "Fix database connection timeout in production cluster"
Committed Events:    6 actions
Verification Mode:   100% Zero-Trust Air-Gapped Recomputation

─── 7-STEP PROTOCOL VERIFICATION ────────────────────────────────────────────────
[1/7] Protocol Header:         [PASS ✓]  agent/1
[2/7] Sovereign Ed25519 Sigs:  [PASS ✓]  6/6 valid signatures
[3/7] Event Hash Integrity:    [PASS ✓]  Canonical line-format SHA-256
[4/7] Monotonic Hash Chain:    [PASS ✓]  Continuous sequential linkage
[5/7] Merkle Inclusion Proofs: [PASS ✓]  6 proofs verified
[6/7] Merkle Root Match:       [PASS ✓]  Root: 47133ffb4f26618a...
[7/7] Solana Anchor PDA:       [PASS ✓]  Matched expected PDA: 7eKBvWeuuRdjKe...

─── LAYER 3 BEHAVIORAL POLICY AUDIT ─────────────────────────────────────────────
COMPLIANT (0 policy violations detected)

─────────────────────────────────────────────────────────────────────────────────

✅ VERDICT: AGENT RECEIPT CRYPTOGRAPHICALLY AUTHENTIC & UNTAMPERED
Every action was sovereignly signed by DppNPGCU... and matches the public commitment.
```

To inspect the execution timeline and tool traces in detail:

```bash
npx provn agent inspect receipt.json
```

---

## 4. Framework Integrations

### LangGraph / LangChain Middleware Hook
```typescript
import { Provn } from '@provn/sdk'

const provn = new Provn()

export function createProvnCallback(intent: string) {
  let executionPromise = provn.start({ intent })

  return {
    handleToolStart: async (tool: any, input: string) => {
      const execution = await executionPromise
      await execution.action({
        type: 'tool_call',
        tool: tool.name,
        input: JSON.parse(input)
      })
    },
    handleChainEnd: async (outputs: any) => {
      const execution = await executionPromise
      await execution.outcome({ status: 'success', result: outputs })
      return await execution.complete()
    }
  }
}
```

### Model Context Protocol (MCP) Server Wrap
```typescript
import { Provn } from '@provn/sdk'

const provn = new Provn({ agentName: 'mcp-server-proxy' })

export async function executeMcpToolWithProof(toolName: string, args: any, handler: Function) {
  const execution = await provn.start({ intent: `Invoke MCP tool: ${toolName}` })
  
  try {
    const result = await handler(args)
    await execution.action({ type: 'tool_call', tool: toolName, input: args, output: result })
    await execution.outcome({ status: 'success', result })
    const receipt = await execution.complete()
    return { result, receipt }
  } catch (err: any) {
    await execution.outcome({ status: 'failure', summary: err.message })
    await execution.complete()
    throw err
  }
}
```

### Python Agents (via REST API)
If your agent runs in Python, interact directly with the PROVN Control Plane:
```python
import requests

BASE_URL = "https://provn-sol.vercel.app/api/agent"
HEADERS = {"Authorization": "Bearer YOUR_API_KEY"}

# 1. Start execution
res = requests.post(f"{BASE_URL}/execution", json={
    "execution": {
        "executionId": "uuid-here",
        "agentPublicKey": "agent-pubkey-base58",
        "taskDescription": "Python agent task"
    }
}, headers=HEADERS)

# 2. Ingest signed events
# 3. Finalize execution
```

---

## 5. What Makes PROVN Different?

| Feature | Standard Logging (Datadog/CloudWatch) | PROVN Protocol |
| :--- | :--- | :--- |
| **Tamper Resistance** | ❌ Anyone with DB/admin access can alter or delete logs | ✅ Cryptographic SHA-256 hash chains + Solana Merkle anchor |
| **Non-Repudiation** | ❌ Server logs can be forged | ✅ Detached Ed25519 sovereign agent signatures |
| **Portability** | ❌ Locked to proprietary SaaS vendor | ✅ Self-contained, portable JSON cryptographic receipt |
| **Independent Verification** | ❌ Impossible without SaaS dashboard access | ✅ Offline CLI verifier (`npx provn agent verify`) |
| **Policy Audit** | ❌ Non-deterministic LLM judge | ✅ Deterministic pattern matching & AST rules |
