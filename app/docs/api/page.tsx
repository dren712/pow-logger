import type { Metadata } from 'next'
import Link from 'next/link'
import CodeBlock from '@/app/components/docs-legal/CodeBlock'

export const metadata: Metadata = {
  title: 'REST API — PROVN documentation',
  description: 'Public REST endpoints for PROVN GitHub profile badges, wallet passports, proofs and eligibility checks.',
}

const BASE = 'https://provn-sol.vercel.app'

function Endpoint({ method, path }: { method: 'GET' | 'POST'; path: string }) {
  return (
    <h3 className="dl-endpoint">
      <span className={`dl-method dl-method-${method}`}>{method}</span>
      <span className="dl-path">{path}</span>
    </h3>
  )
}

export default function ApiDocsPage() {
  return (
    <article className="dl-prose">
      <p className="pv-eyebrow">Reference</p>
      <h1>REST API</h1>
      <p className="dl-lead">
        Read-only endpoints for embedding PROVN data in your own site, bounty board or hiring tool. The endpoints on this
        page need no API key.
      </p>

      <h2 id="basics">Basics</h2>
      <ul>
        <li>Base URL: <code>{BASE}</code></li>
        <li>Responses are JSON unless noted. Errors return a JSON body with an <code>error</code> or <code>message</code> field.</li>
        <li>Wallet parameters are Base58 Solana public keys (32 to 44 characters).</li>
        <li>Successful responses are cached for a short time, so a new proof can take a few minutes to appear.</li>
      </ul>

      <h2 id="profiles">GitHub profiles</h2>
      <Endpoint method="GET" path="/api/gh-badge/:username" />
      <p>
        Returns an SVG badge with the tier and score of a GitHub user&apos;s PROVN profile. The profile is built from public
        GitHub data and refreshed at most once a day. An unknown username returns <code>404</code> with a grey
        &quot;unknown&quot; badge.
      </p>
      <CodeBlock
        label="Markdown"
        code={`[![Verified builder](${BASE}/api/gh-badge/USERNAME)](${BASE}/gh/USERNAME)`}
      />
      <p>
        The profile page itself is at <code>/gh/:username</code> and the résumé at <code>/gh/:username/resume</code>.
      </p>

      <h2 id="proofs">Wallet proofs</h2>
      <p>
        These endpoints read proofs signed in the <Link href="/log">proof logger</Link>.
      </p>

      <Endpoint method="GET" path="/api/passport/:wallet" />
      <p>
        The full passport for a wallet: reputation metrics and every public proof with its signature, verification state
        and archive transaction ID.
      </p>
      <CodeBlock label="Shell" code={`curl ${BASE}/api/passport/WALLET_ADDRESS`} />
      <CodeBlock
        label="Response shape"
        code={`{
  "protocol": "PROVN",
  "version": "1.0",
  "exportedAt": "<ISO-8601 timestamp>",
  "wallet": "<wallet address>",
  "reputation": { ... },
  "proofs": [
    {
      "id": 0,
      "content": "<log text>",
      "signature": "<Ed25519 signature>",
      "verificationState": "VERIFIED | UNVERIFIED | LEGACY",
      "irysTxId": "<archive transaction ID or null>",
      ...
    }
  ],
  "verificationUrl": "${BASE}/u/<wallet address>"
}`}
      />

      <Endpoint method="GET" path="/api/proof/:id" />
      <p>
        One proof by numeric ID, with the signature check re-run on the server and a <code>validityReport</code> describing
        which checks passed. A proof its owner has marked private returns <code>403</code> unless the request carries a
        valid wallet-signature authorization header.
      </p>

      <Endpoint method="GET" path="/api/verify/:wallet" />
      <p>
        A summary for a wallet: whether it has verified proofs, top skills and protocols, badge level and the five most
        recent logs. Returns <code>404</code> when the wallet has no logs.
      </p>

      <Endpoint method="GET" path="/api/badge/:wallet" />
      <p>An SVG badge for a wallet, for READMEs and profile pages.</p>

      <Endpoint method="GET" path="/api/passport-card/:wallet" />
      <p>A 1200×630 SVG social card with the wallet&apos;s reputation metrics.</p>

      <Endpoint method="GET" path="/api/stats" />
      <p>
        Network totals: <code>totalBuilders</code>, <code>totalProofs</code> and <code>totalArchived</code>.
      </p>

      <h2 id="eligibility">Eligibility</h2>
      <Endpoint method="POST" path="/api/eligibility" />
      <p>
        Checks a wallet against an evidence policy and returns each check with a pass or fail. Send your own{' '}
        <code>policy</code>, or name a preset with <code>policyPreset</code>: <code>SUPERTEAM_BOUNTY</code>,{' '}
        <code>GRANT_EVALUATION</code>, <code>CORE_ENGINEERING</code> or <code>LIGHTWEIGHT_BUILDER</code>. With neither,{' '}
        <code>SUPERTEAM_BOUNTY</code> is used.
      </p>
      <CodeBlock
        label="Shell"
        code={`curl -X POST ${BASE}/api/eligibility \\
  -H "Content-Type: application/json" \\
  -d '{
    "wallet": "WALLET_ADDRESS",
    "policy": { "minVerifiedProofs": 5, "requireArchivedProof": true }
  }'`}
      />
      <div className="dl-table-wrap">
        <table className="dl-table">
          <thead>
            <tr><th>Policy field</th><th>Type</th><th>Meaning</th></tr>
          </thead>
          <tbody>
            <tr><td><code>minVerifiedProofs</code></td><td>number</td><td>Minimum proofs with a valid signature</td></tr>
            <tr><td><code>minSourceVerifiedProofs</code></td><td>number</td><td>Minimum proofs whose source was verified</td></tr>
            <tr><td><code>minRecentProofs</code></td><td>number</td><td>Minimum recent proofs</td></tr>
            <tr><td><code>minStreak</code></td><td>number</td><td>Minimum streak in days</td></tr>
            <tr><td><code>requiredSkills</code></td><td>string[]</td><td>Skills that must appear in proofs</td></tr>
            <tr><td><code>requiredProtocols</code></td><td>string[]</td><td>Protocols that must appear in proofs</td></tr>
            <tr><td><code>requireGithubSource</code></td><td>boolean</td><td>Require a GitHub source</td></tr>
            <tr><td><code>requireGithubEvidence</code></td><td>boolean</td><td>Require GitHub evidence</td></tr>
            <tr><td><code>requireVerifiedGithubAttribution</code></td><td>boolean</td><td>Require a verified GitHub link for the wallet</td></tr>
            <tr><td><code>requireArchivedProof</code></td><td>boolean</td><td>Require at least one archived proof</td></tr>
          </tbody>
        </table>
      </div>
      <p>
        The response contains <code>eligible</code>, <code>policyName</code>, <code>evaluatedAt</code>, a{' '}
        <code>checks</code> array and a <code>summary</code> with <code>passedCount</code> and <code>totalChecks</code>.
      </p>

      <h2 id="client">TypeScript client</h2>
      <p>
        <code>ProvnClient</code> wraps the wallet endpoints above. It is part of the SDK source in the repository at{' '}
        <code>sdk/index.ts</code>.
      </p>
      <p className="dl-note dl-note-warn">
        The SDK is not published to npm yet. Until it is, import it from a checkout of the{' '}
        <a href="https://github.com/dren712/pow-logger" rel="noopener noreferrer" target="_blank">repository</a>.
      </p>
      <CodeBlock
        label="TypeScript"
        code={`import { ProvnClient } from './sdk'

const provn = new ProvnClient() // or new ProvnClient({ baseUrl })

const passport = await provn.getPassport(wallet)
const reputation = await provn.getReputation(wallet)
const proof = await provn.getProof(42)
const result = await provn.checkEligibility(wallet, { minVerifiedProofs: 5 })

console.log(result.eligible, result.summary)`}
      />

      <h2 id="errors">Errors</h2>
      <div className="dl-table-wrap">
        <table className="dl-table">
          <thead>
            <tr><th>Status</th><th>Meaning</th></tr>
          </thead>
          <tbody>
            <tr><td><code>400</code></td><td>The wallet address or proof ID is missing or malformed</td></tr>
            <tr><td><code>403</code></td><td>The proof is private and the request is not authorized</td></tr>
            <tr><td><code>404</code></td><td>No such proof, wallet history or GitHub user</td></tr>
            <tr><td><code>500</code></td><td>The server could not complete the request; try again later</td></tr>
          </tbody>
        </table>
      </div>
      <p>
        Building with agents instead? See the <Link href="/docs/agent-sdk">Agent SDK</Link>.
      </p>
    </article>
  )
}
