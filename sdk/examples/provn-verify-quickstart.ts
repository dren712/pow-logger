/**
 * PROVN Verify quickstart: a mandate-checked tool call, an MCP tool call and two x402-style devnet payments.
 * Run: npx tsx sdk/examples/provn-verify-quickstart.ts
 * Fully offline (gatewayUrl: ''). Set PROVN_API_KEY to sync the receipt to https://provn-sol.vercel.app.
 */
import { ProvnVerify, verifyProvnVerifyReceipt, type McpToolCaller } from '../index'

const mandate = {
  mandateId: 'quickstart',
  principal: 'you@example.com',
  spendLimit: { amount: '500.00', currency: 'USDC' },
  allowedActions: ['weather.lookup', 'mcp:search', 'x402.pay'],
}

// Any MCP client with callTool() works, e.g. new Client(...) from @modelcontextprotocol/sdk.
const mcp: McpToolCaller = { callTool: async ({ name }) => ({ content: [{ type: 'text', text: `${name} ok` }] }) }

async function main() {
  const apiKey = process.env.PROVN_API_KEY
  const pv = await ProvnVerify.start({
    intent: 'Look up weather, search, then pay for data',
    mandate,
    client: apiKey ? { apiKey } : { gatewayUrl: '' },
  })

  await pv.tool('weather.lookup', { city: 'Lisbon' }, async ({ city }) => ({ city, tempC: 19 }))
  await pv.mcp(mcp, 'search', { q: 'x402 solana' })

  // Replace with a real x402 client paying on Solana devnet.
  const payDevnet = async () => ({ txSignature: 'simulated-devnet-signature', network: 'solana-devnet' as const })
  const ok = await pv.pay({ resource: 'https://api.example/data', payTo: 'Recipient111', amount: '120.00', asset: 'USDC' }, payDevnet)
  const over = await pv.pay({ resource: 'https://api.example/bulk', payTo: 'Recipient111', amount: '700.00', asset: 'USDC' }, payDevnet)

  const receipt = await pv.complete()
  const report = verifyProvnVerifyReceipt(receipt)
  console.log({ allowed: ok.decision, overLimit: over.decision, reasons: over.reasons, verified: report.verified })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
