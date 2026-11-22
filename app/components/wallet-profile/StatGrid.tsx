import type { BuilderReputation } from '@/app/lib/types'

export default function StatGrid({ reputation }: { reputation: BuilderReputation }) {
  const stats = [
    { label: 'Signed proofs', value: reputation.verifiedProofs, note: 'Ed25519 wallet signatures' },
    { label: 'Last 30 days', value: reputation.recentVerifiedProofs, note: 'Signed proofs' },
    { label: 'With GitHub link', value: reputation.proofsWithGithubEvidence, note: 'Self-attested links' },
    {
      label: 'Archived on Arweave',
      value: `${reputation.archivalSuccessRate}%`,
      note: `${reputation.archivedVerifiedProofs} confirmed`,
    },
    { label: 'Current streak', value: `${reputation.currentStreak}d`, note: `Longest ${reputation.longestStreak}d` },
  ]
  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-5" aria-label="Summary">
      {stats.map((s, i) => (
        <div key={s.label} className={`pv-card px-4 py-4 ${i === 0 ? 'col-span-2 sm:col-span-1' : ''}`}>
          <div className="text-[26px] font-bold leading-none tracking-tight text-white">{s.value}</div>
          <div className="mt-2 text-[12px] leading-snug text-[#c3cad6]">{s.label}</div>
          <div className="pv-faint mt-0.5 text-[11px] leading-snug">{s.note}</div>
        </div>
      ))}
    </section>
  )
}
