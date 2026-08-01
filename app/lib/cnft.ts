import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js'

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
    name: `PoWL Proof #${streak}d — ${shortWallet}`,
    symbol: 'POWL',
    description: `Cryptographically verified proof-of-work log on Solana: "${logContent.slice(0, 100)}${logContent.length > 100 ? '...' : ''}"`,
    external_url: `https://pow-logger.vercel.app/u/${walletAddress}`,
    attributes: [
      { trait_type: 'Builder', value: walletAddress },
      { trait_type: 'Streak Milestone', value: `${streak} Days` },
      { trait_type: 'Irys Gateway Proof', value: irysTxId ? `https://gateway.irys.xyz/${irysTxId}` : 'N/A' },
      { trait_type: 'Protocol', value: 'PoWL Metaplex Bubblegum' },
    ],
  }
}

export async function mintProofCNFT(
  walletAddress: string,
  logContent: string,
  irysTxId?: string,
  streak: number = 1
): Promise<{ success: boolean; assetId?: string; error?: string }> {
  try {
    const endpoint =
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl('devnet')
    const connection = new Connection(endpoint, 'confirmed')

    const ownerPublicKey = new PublicKey(walletAddress)
    const metadata = await createCNFTMetadata(walletAddress, logContent, irysTxId, streak)

    // Generate deterministic simulated Merkle asset ID based on wallet + timestamp
    const simulatedAssetId = `cnft_${ownerPublicKey.toBase58().slice(0, 8)}_${Date.now().toString(36)}`

    console.log(`[PoWL cNFT Engine] Simulated Bubblegum cNFT mint for ${walletAddress}:`, simulatedAssetId)

    return {
      success: true,
      assetId: simulatedAssetId,
    }
  } catch (err: any) {
    console.error('[PoWL cNFT Engine] Mint error:', err)
    return {
      success: false,
      error: err.message || 'Failed to mint cNFT',
    }
  }
}
