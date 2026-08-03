import { PublicKey } from '@solana/web3.js'

export interface CNFTMetadata {
  name: string
  symbol: string
  description: string
  attributes: { trait_type: string; value: string }[]
  external_url: string
}

export async function createCNFTMetadata(
  walletAddress: string,
  logContent: string,
  irysTxId?: string,
  streak: number = 1
): Promise<CNFTMetadata> {
  const shortWallet =
    walletAddress.length > 8
      ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`
      : walletAddress

  return {
    name: `PROVN Proof #${streak}d — ${shortWallet} 🗿`,
    symbol: 'PROVN',
    description: `Cryptographically verified proof-of-work log on Solana: "${logContent.slice(0, 100)}${logContent.length > 100 ? '...' : ''}"`,
    external_url: `https://provn-sol.vercel.app/u/${walletAddress}`,
    attributes: [
      { trait_type: 'Builder', value: walletAddress },
      { trait_type: 'Streak Milestone', value: `${streak} Days` },
      { trait_type: 'Irys Gateway Proof', value: irysTxId ? `https://gateway.irys.xyz/${irysTxId}` : 'N/A' },
      { trait_type: 'Protocol', value: 'PROVN Metaplex Bubblegum' },
    ],
  }
}

export async function mintProofCNFT(
  walletAddress: string,
  logContent: string,
  irysTxId?: string,
  streak: number = 1
): Promise<{ success: boolean; assetId?: string; error?: string }> {
  const treePubkey = process.env.SOLANA_MERKLE_TREE_PUBKEY
  if (!treePubkey) {
    return { success: false, error: 'Merkle tree not configured' }
  }

  try {
    const ownerPublicKey = new PublicKey(walletAddress)
    const metadata = await createCNFTMetadata(walletAddress, logContent, irysTxId, streak)

    // Note: On-chain compressed NFT minting requires a funded payer keypair & Bubblegum tree authority.
    // If treePubkey is configured, on-chain minting logic is triggered.
    console.log(`[PROVN cNFT Engine] Tree configured at ${treePubkey} for ${ownerPublicKey.toBase58()} (Metadata: ${metadata.name})`)

    // Honest status: return failure until full on-chain transaction instruction is signed & broadcast to cluster
    return {
      success: false,
      error: 'On-chain cNFT tree minting pipeline pending wallet fee payer configuration',
    }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to mint cNFT'
    console.error('[PROVN cNFT Engine] Mint error:', errorMessage)
    return {
      success: false,
      error: errorMessage,
    }
  }
}
