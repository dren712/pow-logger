import type { Metadata } from 'next'
import Link from 'next/link'
import CodeBlock from '@/app/components/docs-legal/CodeBlock'

export const metadata: Metadata = {
  title: 'Agent SDK — PROVN documentation',
  description: 'Record what a software agent did as Ed25519-signed, hash-chained events and seal them into a receipt anyone can verify.',
}

const QUICKSTART = `import { ProvnAgent } from './sdk'

// 1. Create an agent. A new Ed25519 keypair is generated if you do not pass one.
const provn = new ProvnAgent({
  apiKey: process.env.PROVN_API_KEY,
  agentName: 'ci-agent',
})

// 2. Start an execution session
const session = await provn.startSession({
  taskDescription: 'Run the test suite and open a pull request',
})

// 3. Record each consequential action. Every event is signed and chained locally.
await session.record('tool.request', {
  type: 'tool.request',
  tool: 'github.read',
  repo: 'dren712/pow-logger',
  path: 'src/index.ts',
})

await session.record('shell.execute', {
  type: 'shell.execute',
  command: 'npm test',
  exitCode: 0,
  stdoutHash: '<sha256 of stdout>',
})

// 4. Seal the execution: builds the Merkle root and returns the receipt
const receipt = await session.seal('Pipeline finished')

console.log(receipt.merkle.root)
console.log(receipt.proofUrl)`

const VERIFY = `import { verifyAgentReceipt, formatVerificationReport } from './sdk'

const result = verifyAgentReceipt(receipt)
console.log(formatVerificationReport(result))`

const EVENT_TYPES = [
  ['agent.started, agent.completed, agent.failed', 'Execution lifecycle'],
  ['tool.request, tool.response', 'A tool call and its result'],
  ['file.read, file.write', 'File access, recorded as a path and content hash'],
  ['shell.execute', 'A shell command and its exit code'],
  ['git.operation', 'A commit, push or other git action'],
  ['deployment.request, deployment.result', 'A deployment and its outcome'],
  ['payment.intent, payment.executed', 'A payment the agent planned or made'],
  ['contract.interaction', 'A smart contract call'],
  ['outcome.attestation', 'The final result of the task'],
]

const GUARANTEES = [
  {
    title: 'The agent signs, not the server',
    body: 'Each event is signed in the agent runtime with an Ed25519 detached signature over a canonical string. The server never signs agent events.',
  },
  {
    title: 'The database is only an index',
    body: 'Events are hash-chained and batched into a Merkle tree. Changing or deleting a stored event breaks the chain and the Merkle root, and verification fails.',
  },
  {
    title: 'The timestamp is anchored on Solana',
    body: 'Batch Merkle roots can be committed to a Program Derived Address on Solana, which gives a public timestamp that cannot be backdated.',
  },
]

function Endpoint({ method, path, children }: { method: 'GET' | 'POST'; path: string; children: React.ReactNode }) {
  return (
    <tr>
      <td>
        <span className="dl-endpoint flex-nowrap">
          <span className={`dl-method dl-method-${method}`}>{method}</span>
          <code>{path}</code>
        </span>
      </td>
      <td>{children}</td>
    </tr>
  )
}

export default function AgentSdkDocsPage() {
  return (
    <article className="dl-prose">
      <p className="pv-eyebrow">Guide</p>
      <h1>Agent SDK</h1>
      <p className="dl-lead">
        Give a software agent, bot or CI pipeline a signed record of what it did. Each action becomes an event that is
        signed locally, chained to the one before it, and sealed into a receipt that anyone can verify.
      </p>
      <div className="no-print flex flex-wrap gap-3">
        <Link href="/agent-proof/demo" className="pv-btn">Open the example receipt</Link>
        <Link href="/agent-proof" className="pv-btn-ghost">Agent console</Link>
      </div>

      <h2 id="install">Install</h2>
      <p>
        The SDK source is in the repository at <code>sdk/index.ts</code>. It depends on <code>tweetnacl</code> and{' '}
        <code>bs58</code>.
      </p>
      <p className="dl-note dl-note-warn">
        The SDK is not published to npm yet. Until it is, import it from a checkout of the repository.
      </p>
      <CodeBlock label="Shell" code={`git clone https://github.com/dren712/pow-logger.git\ncd pow-logger && npm install`} />

      <h2 id="quickstart">Quickstart</h2>
      <p>
        Record payloads should describe an action without containing secrets: pass hashes of file contents and command
        output, not the raw values.
      </p>
      <CodeBlock label="TypeScript" code={QUICKSTART} />
      <p>
        Without a <code>gatewayUrl</code>, events are sent to the hosted PROVN gateway. Set <code>gatewayUrl</code> to
        your own deployment to keep them there. The gateway needs a project API key, sent as a Bearer token.
      </p>

      <h2 id="events">Event types</h2>
      <p>The first argument to <code>session.record</code> is one of these types.</p>
      <div className="dl-table-wrap">
        <table className="dl-table">
          <thead>
            <tr><th>Type</th><th>Use it for</th></tr>
          </thead>
          <tbody>
            {EVENT_TYPES.map(([types, use]) => (
              <tr key={types}>
                <td>{types.split(', ').map((t, i) => <span key={t}>{i > 0 && ' '}<code>{t}</code></span>)}</td>
                <td>{use}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 id="guarantees">What a receipt proves</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        {GUARANTEES.map((g) => (
          <div key={g.title} className="pv-card p-5">
            <h3 className="!mt-0">{g.title}</h3>
            <p className="pv-muted mt-2 text-[13.5px] leading-relaxed">{g.body}</p>
          </div>
        ))}
      </div>
      <p>
        A receipt proves that the holder of the agent key signed these events in this order. It does not prove that the
        events describe what really happened on the machine; that depends on how the agent is instrumented.
      </p>

      <h2 id="endpoints">Gateway endpoints</h2>
      <p>The SDK calls these for you. Endpoints marked &quot;API key&quot; expect <code>Authorization: Bearer &lt;key&gt;</code>.</p>
      <div className="dl-table-wrap">
        <table className="dl-table">
          <thead>
            <tr><th>Endpoint</th><th>Purpose</th></tr>
          </thead>
          <tbody>
            <Endpoint method="POST" path="/api/agent/execution">Register a new execution. API key.</Endpoint>
            <Endpoint method="POST" path="/api/agent/event">Submit one signed event. API key.</Endpoint>
            <Endpoint method="POST" path="/api/agent/finalize">Seal an execution. API key.</Endpoint>
            <Endpoint method="GET" path="/api/agent/executions">List a project&apos;s executions (<code>limit</code>, up to 100). API key.</Endpoint>
            <Endpoint method="GET" path="/api/agent/receipt/:executionId">Fetch the receipt for an execution.</Endpoint>
            <Endpoint method="POST" path="/api/agent/verify">Verify a receipt sent in the request body.</Endpoint>
          </tbody>
        </table>
      </div>

      <h2 id="verify">Verify a receipt</h2>
      <p>
        Verification needs only the receipt. It re-checks every signature, the hash chain and the Merkle root, and runs
        offline.
      </p>
      <CodeBlock label="TypeScript" code={VERIFY} />
      <p>
        To check over HTTP instead, post <code>{'{ "receipt": ... }'}</code> to <code>/api/agent/verify</code>. Add{' '}
        <code>&quot;checkNetwork&quot;: true</code> to also compare the receipt with its Solana anchor.
      </p>
      <p>
        For the wallet and profile endpoints, see the <Link href="/docs/api">REST API</Link>.
      </p>
    </article>
  )
}
