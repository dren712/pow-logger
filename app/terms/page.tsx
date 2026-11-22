import type { Metadata } from 'next'
import Link from 'next/link'
import LegalPage from '@/app/components/docs-legal/LegalPage'

export const metadata: Metadata = {
  title: 'Terms — PROVN',
  description: 'Plain-language terms for using PROVN profiles, résumés, the leaderboard and the proof logger.',
}

export default function TermsPage() {
  return (
    <LegalPage
      current="/terms"
      title="Terms of use"
      lead="These are the rules for using PROVN, written in plain language. By using the site you agree to them."
    >
      <h2 id="service">What PROVN is</h2>
      <p>
        PROVN generates developer profiles and résumés from public GitHub data, ranks generated profiles on a
        leaderboard, and provides a proof logger where a Solana wallet can sign records of work. No account is needed
        for profiles.
      </p>

      <h2 id="scores">Profiles and scores</h2>
      <ul>
        <li>Profiles are built automatically from what GitHub reports as public. They can be incomplete or out of date, and they are refreshed at most once a day.</li>
        <li>Scores and tiers are computed by a formula. They are a summary of public activity, not a judgement of a person&apos;s skill, and not a hiring recommendation.</li>
        <li>A profile is not an endorsement by PROVN of the person, and PROVN is not affiliated with GitHub.</li>
        <li>If you rely on a profile or résumé, check the linked GitHub sources yourself.</li>
      </ul>

      <h2 id="proofs">Proofs you submit</h2>
      <ul>
        <li>You are responsible for what you sign and submit. Only submit work that is yours and content you have the right to publish.</li>
        <li>A signature shows that a wallet signed a statement at a point in time. It does not show that the statement is true.</li>
        <li>Archived proofs are public and permanent. They cannot be edited or deleted afterwards.</li>
        <li>You are responsible for your wallet and keys. PROVN cannot recover them and never asks for a seed phrase.</li>
        <li>Network fees charged by Solana or by your wallet are yours to pay.</li>
      </ul>

      <h2 id="acceptable-use">Acceptable use</h2>
      <p>Do not:</p>
      <ul>
        <li>submit unlawful content, other people&apos;s personal information, or secrets such as API keys;</li>
        <li>impersonate someone else or misrepresent whose work something is;</li>
        <li>overload the service, get around rate limits, or probe it for weaknesses without permission;</li>
        <li>use the API or generated profiles to harass people or to send spam.</li>
      </ul>
      <p>Access may be limited or blocked for use that breaks these rules.</p>

      <h2 id="code">Code and content</h2>
      <p>
        The source code is published on{' '}
        <a href="https://github.com/dren712/pow-logger" rel="noopener noreferrer" target="_blank">GitHub</a> under the
        licence stated in that repository. GitHub data shown in profiles belongs to its owners and is shown with links
        to its source.
      </p>

      <h2 id="warranty">No warranty</h2>
      <p>
        PROVN is provided as is and as available, without warranties of any kind. It may change, be interrupted or stop.
        To the extent the law allows, the operators of PROVN are not liable for losses that result from using the
        service or relying on its output, including lost funds, lost data or decisions made on the basis of a profile.
      </p>

      <h2 id="changes">Changes</h2>
      <p>
        These terms may be updated. The date at the top shows the latest version, and continuing to use PROVN after a
        change means you accept it.
      </p>

      <h2 id="contact">Contact</h2>
      <p>
        Questions about these terms: <a href="mailto:darshangaikwad712@gmail.com">darshangaikwad712@gmail.com</a>. How
        data is handled is described on the <Link href="/privacy">privacy page</Link>.
      </p>
    </LegalPage>
  )
}
