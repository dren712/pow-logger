import type { Metadata } from 'next'
import Link from 'next/link'
import LegalPage from '@/app/components/docs-legal/LegalPage'

export const metadata: Metadata = {
  title: 'Privacy — PROVN',
  description: 'What PROVN reads, stores and shares: public GitHub data for profiles, and wallet-signed proofs for the proof logger.',
}

export default function PrivacyPage() {
  return (
    <LegalPage
      current="/privacy"
      title="Privacy"
      lead="PROVN builds developer profiles from public GitHub data and lets people sign proofs of their work with a Solana wallet. This page says what is read, what is stored and what cannot be undone."
    >
      <h2 id="summary">In short</h2>
      <ul>
        <li>Profiles use only data that is already public on GitHub. There is no login and no access to private repositories.</li>
        <li>A generated profile is cached for up to a day, and a summary row is stored for the leaderboard.</li>
        <li>The proof logger stores what you sign. Archived proofs are permanent.</li>
        <li>PROVN sets no cookies, shows no ads, and does not sell data.</li>
      </ul>

      <h2 id="profiles">GitHub profiles and résumés</h2>
      <p>
        When anyone opens <code>/gh/username</code>, PROVN asks the public GitHub API for that account&apos;s public
        profile, public repositories and merged pull requests, and computes a score and tier from them. You do not sign
        in, and PROVN never asks for a GitHub password or token from you.
      </p>
      <p>
        Because the data is public, a profile can be generated for any public GitHub account, including by someone other
        than its owner.
      </p>
      <h3>What is stored</h3>
      <ul>
        <li>
          <strong>Profile cache.</strong> The generated profile is kept in a server cache for up to 24 hours so that
          repeat visits do not call GitHub again. After that it is rebuilt from GitHub on the next visit.
        </li>
        <li>
          <strong>Leaderboard row.</strong> For each generated profile, one row is saved: GitHub account ID, username,
          display name, avatar URL, score, tier, number of merged pull requests in other projects, number of projects
          contributed to, stars, top language, a fingerprint of the profile and the time it was generated. These rows
          are shown on the <Link href="/leaderboard">leaderboard</Link>.
        </li>
      </ul>
      <p>
        If GitHub no longer finds a username, its leaderboard row is deleted the next time that profile is requested. To
        have your row removed sooner, use the contact details below.
      </p>

      <h2 id="proofs">Wallets and proofs</h2>
      <p>The <Link href="/log">proof logger</Link> is optional and separate from GitHub profiles. If you use it:</p>
      <ul>
        <li>
          <strong>Wallet address.</strong> Your public Solana address is stored with every proof you submit and is shown
          on your passport page.
        </li>
        <li>
          <strong>Proof content.</strong> The text you write, any links, skills and categories you attach, the signature
          and the time are stored in the database. Proofs are public unless you mark them private.
        </li>
        <li>
          <strong>Private keys.</strong> Signing happens in your wallet. PROVN never receives your private key or seed
          phrase.
        </li>
        <li>
          <strong>Linked GitHub account.</strong> If you choose to link GitHub to your wallet, you sign in with GitHub
          once with read-only access to your public profile, and PROVN stores your GitHub account ID and username next
          to your wallet address.
        </li>
        <li>
          <strong>Signing challenges.</strong> When you request a message to sign, the short-lived challenge is stored
          with your wallet address and IP address to prevent replay and abuse.
        </li>
        <li>
          <strong>Feedback.</strong> If you send feedback, the text, the rating and your wallet address (if connected)
          are stored.
        </li>
      </ul>
      <p className="dl-note dl-note-warn">
        <strong>Archived proofs are permanent.</strong> Proofs archived to Arweave through Irys, and hashes anchored on
        Solana, are public and cannot be edited or deleted by anyone, including PROVN. Do not put secrets, API keys or
        personal information in a proof.
      </p>

      <h2 id="agents">Agent executions</h2>
      <p>
        Projects that use the agent protocol send signed events to PROVN. The agent&apos;s public key, event hashes,
        signatures and the event metadata the project chose to include are stored. API keys are stored as hashes.
      </p>

      <h2 id="browser">Cookies, browser storage and logs</h2>
      <ul>
        <li>PROVN does not set cookies or load advertising scripts.</li>
        <li>If you connect a wallet, the wallet adapter remembers which wallet you chose in your browser&apos;s local storage so it can reconnect.</li>
        <li>IP addresses are used to rate-limit requests. The hosting provider also keeps standard request logs.</li>
      </ul>

      <h2 id="analytics">Vercel Web Analytics</h2>
      <p>
        We use Vercel Web Analytics for cookieless, aggregated usage statistics. We measure profile views,
        résumé download-button clicks, sharing networks, README card copies and successful waitlist joins.
        We do not send personal data such as emails, GitHub usernames or wallet addresses as custom event properties.
        Query strings are removed and profile identifiers are masked in analytics URLs. No cookie banner is required
        because this analytics integration does not use cookies.
      </p>

      <h2 id="waitlist">Pro waitlist</h2>
      <p>
        If you join the Pro waitlist, we store your email address, the GitHub username from the page, the source
        page type and signup time in Supabase to notify you about Pro. This is separate from analytics and is not
        public. There is no payment or subscription at signup. To leave the waitlist or delete your information,
        contact us using the details below.
      </p>

      <h2 id="providers">Services PROVN relies on</h2>
      <ul>
        <li><strong>GitHub</strong>: source of public profile data, and sign-in if you link an account to a wallet.</li>
        <li><strong>Supabase</strong>: database for leaderboard rows, proofs and agent events.</li>
        <li><strong>Vercel</strong>: hosting, server functions and cookieless Web Analytics.</li>
        <li><strong>Solana</strong>: public network where proof hashes are anchored.</li>
        <li><strong>Irys and Arweave</strong>: permanent storage for archived proofs.</li>
      </ul>
      <p>PROVN does not sell personal data or share it with advertisers.</p>

      <h2 id="choices">Your choices</h2>
      <ul>
        <li>To change what a profile shows, change what is public on GitHub. The profile updates when its cache expires.</li>
        <li>To remove a leaderboard row or database records tied to your wallet, get in touch. Data already on Arweave or Solana cannot be removed.</li>
        <li>To stop the wallet reconnecting, disconnect it in the app or clear this site&apos;s storage in your browser.</li>
      </ul>

      <h2 id="changes">Changes</h2>
      <p>If this page changes, the date at the top changes with it.</p>

      <h2 id="contact">Contact</h2>
      <p>
        For privacy questions, removal requests or security reports, email{' '}
        <a href="mailto:darshangaikwad712@gmail.com">darshangaikwad712@gmail.com</a> or open an issue on{' '}
        <a href="https://github.com/dren712/pow-logger" rel="noopener noreferrer" target="_blank">GitHub</a>.
        See also the <Link href="/terms">terms</Link>.
      </p>
    </LegalPage>
  )
}
