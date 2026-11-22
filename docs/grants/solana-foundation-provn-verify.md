# PROVN Verify — Solana Foundation grant draft

> Draft for Darshan (dren712). Not submitted. Every figure marked **[unsourced]** has no checked source yet and must be
> verified or removed before submission. Figures marked **[proposed]** are our own plan, not facts. Market figures
> marked **[secondary]** come from an internal market note (Nov 2026) that cites Token Terminal; the underlying
> dashboard has not been checked.

## Summary

PROVN Verify gives AI agents that act and pay on Solana a signed, mandate-checked receipt for every tool call and
payment, including the ones they were not allowed to make. Anyone can verify a receipt in a browser, without trusting
PROVN, and check its Merkle root against a Solana anchor. Live today on devnet: https://provn-sol.vercel.app/agent-proof.

Ask: **$60,000** **[proposed]** over **6 months** **[proposed]**, paid against four milestones.

## Problem

Agents now pay for APIs, data and compute on their own, often through x402 (HTTP 402 payment requests settled
on-chain). When something goes wrong, the people who funded the agent need three answers:

1. What was the agent allowed to do (its mandate: spend limit, allowed actions, allowed recipients)?
2. What did it ask to do, and was each request inside the mandate?
3. What happened, and can the record be checked by someone who does not trust the agent operator?

Today the answer is usually application logs held by the operator. Logs can be edited, are not signed by the agent,
and do not record refused actions. A Solana transaction proves a payment settled, but not which mandate allowed it,
which tool call led to it, or that the agent tried and was refused a larger one.

Enterprise agent-governance tools exist and are well funded (for example Mintive, Bay, Outerlimit, Metano, OpenBox;
funding amounts **[unsourced]**). They target internal compliance teams and are not built around open, independently
verifiable receipts for on-chain agent payments.

## Why Solana

- **Where agent payments happen.** The market note reports about 17M Solana agent transfers in 90 days
  **[secondary]**, an average of about $0.31 per transfer **[secondary]**, and about 1.5k monthly active Solana agent
  senders **[secondary]**.
- **x402 share.** Solana's share of x402 payment volume: **[unsourced — fill from a public x402 dashboard before
  submission]**.
- **Cost per anchor.** Committing one 32-byte Merkle root per execution is cheap enough to anchor every agent run, not
  just large ones (per-anchor cost on mainnet **[unsourced]**; all current work is on devnet).
- **Ed25519 everywhere.** Agent keys, Solana keys and the receipt signatures use the same curve, so a receipt can be
  checked with the same libraries wallets already ship.

## What exists today

All on Solana devnet and Irys devnet. Code: https://github.com/dren712/pow-logger.

- **Agent receipt protocol** (`app/lib/agent`): every event is Ed25519-signed by the agent, hash-chained to the one
  before it, and rolled into a Merkle root committed to a Solana devnet program and archived on Irys devnet.
- **Agent API**: API keys, `agent_executions` / `agent_events` / `agent_outbox` tables, server-side re-verification of
  every event, atomic finalization, and a transactional outbox that anchors and archives with retries.
- **PROVN Verify SDK** (`sdk/verify.ts`): wraps a tool call, an MCP `tools/call` and an x402-style devnet payment in a
  mandate check. Allowed actions run; refused ones (for example a $700 payment against a $500 mandate) do not run but
  are still signed into the receipt with an evidence hash binding the mandate, request and outcome. Not on npm yet.
- **Independent verifier** (https://provn-sol.vercel.app/verify): paste a receipt or ID and the browser re-checks
  signatures, hashes, hash chain, Merkle root, every mandate decision and every evidence hash, and links the devnet
  anchor.
- **Agent console and hostile-agent demo** (https://provn-sol.vercel.app/agent-proof/demo): a simulated agent tries to
  read secrets, run destructive commands and exfiltrate files; the policy audit flags each step.

What a receipt does **not** prove: a hash on Solana proves the record has not changed since it was committed. It does
not prove an off-chain event (a tool response, an API's answer) happened as described. Milestone 3 narrows that gap for
payments by checking settlement on-chain.

## Milestones

| # | Deliverable | Acceptance | Amount | Time |
|---|---|---|---|---|
| 1 | **Publish the SDK.** `@provn/verify` on npm with TypeScript types, docs, and drop-in wrappers for the MCP TypeScript SDK and one x402 client. | Package published; quickstart runs in under 5 minutes **[proposed]** on a clean machine; receipts verify on `/verify`. | $12,000 **[proposed]** | Month 1–2 **[proposed]** |
| 2 | **Standalone verifier.** CLI and dependency-light library (`npx provn-verify receipt.json`) that checks everything `/verify` does, plus a JSON schema for receipts and mandates. | Verifier has no PROVN network calls; test vectors published; third party can reproduce results. | $14,000 **[proposed]** | Month 2–3 **[proposed]** |
| 3 | **Settlement checks.** For each `payment.executed` event, look up the Solana transaction and confirm recipient, amount and mint match the signed request; flag mismatches. | Works on devnet against real x402 test payments; mismatch cases covered by tests. | $18,000 **[proposed]** | Month 3–5 **[proposed]** |
| 4 | **Open anchor program and adoption.** Publish and document the anchor program, batch many executions per anchor, and integrate with 3 **[proposed]** open-source agent frameworks. | Program source and IDL public; 3 merged or published integrations; public devnet dashboard of anchored receipts. | $16,000 **[proposed]** | Month 5–6 **[proposed]** |

Total: **$60,000** **[proposed]**.

## Budget

| Item | Amount | Notes |
|---|---|---|
| Engineering (one developer, 6 months part-time) | $48,000 **[proposed]** | SDK, verifier, settlement checks, integrations |
| Security review of the anchor program and verifier | $7,000 **[proposed]** | External reviewer; quote **[unsourced]** |
| Infrastructure (RPC, hosting, Irys devnet uploads) | $3,000 **[proposed]** | Cost estimate **[unsourced]** |
| Docs, examples and developer outreach | $2,000 **[proposed]** | |
| **Total** | **$60,000** **[proposed]** | |

## Team

Darshan (GitHub: [dren712](https://github.com/dren712)), sole developer of PROVN.

## Open questions before submission

- Replace every **[secondary]** figure with a direct link to the Token Terminal dashboard (or drop it).
- Fill in the x402 share and per-anchor cost, or remove those lines.
- Confirm the funding amounts for the named competitors, or remove the names.
- Decide whether mainnet anchoring is in scope for the grant period; this draft keeps everything on devnet.
