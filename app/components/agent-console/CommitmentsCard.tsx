import type { AgentReceipt } from '../../lib/agent/types'
import HashField from './HashField'

export default function CommitmentsCard({ receipt, isLiveDbRecord }: { receipt: AgentReceipt; isLiveDbRecord: boolean }) {
  const { solana, irys } = receipt
  const cluster = solana && solana.network !== 'mainnet-beta' ? `?cluster=${solana.network === 'localnet' ? 'custom' : solana.network}` : ''
  const exampleNote = isLiveDbRecord ? undefined : 'Example value. It does not point to a real transaction.'

  return (
    <section className="pv-card p-5 sm:p-6" aria-labelledby="ac-commit-title">
      <h2 id="ac-commit-title" className="pv-h2">Batch commitments</h2>
      <p className="pv-muted mt-1 text-[13px]">Where the Merkle root and the evidence for this batch are recorded.</p>
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <HashField label="Merkle root" value={receipt.merkle.root} />
        {solana?.signature ? (
          <HashField
            label={`Solana transaction (${solana.network})`}
            value={solana.signature}
            href={isLiveDbRecord ? `https://explorer.solana.com/tx/${solana.signature}${cluster}` : undefined}
            linkLabel="Explorer"
            note={exampleNote}
          />
        ) : (
          <HashField
            label={solana ? `Solana account (${solana.network})` : 'Solana anchor'}
            value={solana?.pda}
            href={solana && isLiveDbRecord ? `https://explorer.solana.com/address/${solana.pda}${cluster}` : undefined}
            linkLabel="Explorer"
            empty="Not anchored yet. The batch is waiting to be committed."
            note={solana ? exampleNote : undefined}
          />
        )}
        <HashField
          label="Irys archive"
          value={irys?.txId}
          href={irys && isLiveDbRecord ? `https://devnet.irys.xyz/${irys.txId}` : undefined}
          linkLabel="Gateway"
          empty="Not archived yet. The evidence envelope is waiting to be uploaded."
          note={irys ? exampleNote : undefined}
        />
      </div>
    </section>
  )
}
