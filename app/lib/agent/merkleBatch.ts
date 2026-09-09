/**
 * PROVN Agent Protocol — Deterministic Merkle Tree & Inclusion Proofs
 * Protocol Version: agent/1
 *
 * Pure Node `crypto` implementation — zero external Merkle dependencies.
 *
 * DOMAIN SEPARATION:
 *   Leaf:  SHA256("PROVN-MERKLE-LEAF-V1:" || eventHash)
 *   Node:  SHA256("PROVN-MERKLE-NODE-V1:" || leftHash || rightHash)
 *
 * ODD-LEAF RULE:
 *   When a tree level has an odd number of nodes, the last node is promoted
 *   unchanged to the parent level. It is NOT silently duplicated.
 *   This is deterministic and documented per the protocol specification.
 *
 * VERIFICATION:
 *   An independent verifier receives (eventHash, leafIndex, proof[], root)
 *   and recomputes the path from leaf to root using the domain-separated
 *   hash functions. The verifier NEVER trusts the stored merkleRoot.
 */

import crypto from 'crypto'
import { DOMAIN_SEPARATION, type MerkleInclusionProof, type MerkleProofStep, type MerkleTree } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Domain-Separated Hash Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes a domain-separated leaf hash.
 * leafHash = SHA256("PROVN-MERKLE-LEAF-V1:" || eventHash)
 */
export function computeLeafHash(eventHash: string): string {
  return crypto
    .createHash('sha256')
    .update(`${DOMAIN_SEPARATION.MERKLE_LEAF}:${eventHash}`)
    .digest('hex')
}

/**
 * Computes a domain-separated internal node hash.
 * nodeHash = SHA256("PROVN-MERKLE-NODE-V1:" || leftHash || rightHash)
 *
 * Both leftHash and rightHash are 64-character hex strings (32 bytes each).
 */
export function computeNodeHash(leftHash: string, rightHash: string): string {
  return crypto
    .createHash('sha256')
    .update(`${DOMAIN_SEPARATION.MERKLE_NODE}:${leftHash}${rightHash}`)
    .digest('hex')
}

// ─────────────────────────────────────────────────────────────────────────────
// Merkle Tree Construction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds a complete Merkle tree from an array of event hashes.
 *
 * The tree is constructed bottom-up:
 * 1. Each event hash is converted to a leaf hash using domain separation
 * 2. Adjacent leaves are paired and hashed into parent nodes
 * 3. Odd leaves are promoted unchanged (NOT duplicated)
 * 4. Process repeats until a single root remains
 *
 * Returns the tree structure including root, leaves, and inclusion proofs
 * for every leaf.
 *
 * @param eventHashes - Array of SHA-256 hex event hashes (in sequence order)
 * @returns Complete MerkleTree with root and per-leaf inclusion proofs
 * @throws Error if eventHashes is empty
 */
export function buildMerkleTree(eventHashes: string[]): MerkleTree {
  if (eventHashes.length === 0) {
    throw new Error('Cannot build Merkle tree from empty event list')
  }

  // Step 1: Compute leaf hashes with domain separation
  const leaves = eventHashes.map(computeLeafHash)

  // Step 2: Build tree levels bottom-up, recording the full tree structure
  // for proof generation
  const levels: string[][] = [leaves]
  let currentLevel = leaves

  while (currentLevel.length > 1) {
    const nextLevel: string[] = []
    for (let i = 0; i < currentLevel.length; i += 2) {
      if (i + 1 < currentLevel.length) {
        // Pair: hash left and right children
        nextLevel.push(computeNodeHash(currentLevel[i], currentLevel[i + 1]))
      } else {
        // Odd node: promote unchanged (NOT duplicated)
        nextLevel.push(currentLevel[i])
      }
    }
    levels.push(nextLevel)
    currentLevel = nextLevel
  }

  const root = currentLevel[0]

  // Step 3: Generate inclusion proofs for each leaf
  const proofs: MerkleInclusionProof[] = leaves.map((leafHash, leafIndex) => {
    const proof = generateProofFromLevels(levels, leafIndex)
    return {
      leafIndex,
      leafHash,
      proof,
      root,
    }
  })

  return {
    root,
    leafCount: leaves.length,
    leaves,
    proofs,
  }
}

/**
 * Generates a Merkle inclusion proof for a specific leaf index
 * by walking up the tree levels.
 */
function generateProofFromLevels(levels: string[][], leafIndex: number): MerkleProofStep[] {
  const proof: MerkleProofStep[] = []
  let currentIndex = leafIndex

  for (let level = 0; level < levels.length - 1; level++) {
    const currentLevel = levels[level]
    const isLeft = currentIndex % 2 === 0
    const siblingIndex = isLeft ? currentIndex + 1 : currentIndex - 1

    if (siblingIndex < currentLevel.length) {
      // Sibling exists — include it in the proof
      proof.push({
        hash: currentLevel[siblingIndex],
        direction: isLeft ? 'right' : 'left',
      })
    }
    // If sibling doesn't exist (odd node), no proof step is needed —
    // the node was promoted unchanged.

    // Move to parent index
    currentIndex = Math.floor(currentIndex / 2)
  }

  return proof
}

// ─────────────────────────────────────────────────────────────────────────────
// Merkle Proof Verification
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Independently verifies a Merkle inclusion proof.
 *
 * The verifier:
 * 1. Starts with the event hash (untrusted)
 * 2. Computes the domain-separated leaf hash
 * 3. Walks the proof path, computing parent hashes at each step
 * 4. Compares the final computed root with the expected root
 *
 * This function does NOT trust any stored data. It recomputes everything.
 *
 * @param eventHash - The SHA-256 hex event hash to verify inclusion of
 * @param proof - The inclusion proof (leaf index, proof steps, expected root)
 * @returns true if the proof is cryptographically valid
 */
export function verifyMerkleProof(eventHash: string, proof: MerkleInclusionProof): boolean {
  // Step 1: Recompute the leaf hash from the event hash
  const computedLeafHash = computeLeafHash(eventHash)

  // Verify that the leaf hash matches what the proof claims
  if (computedLeafHash !== proof.leafHash) {
    return false
  }

  // Step 2: Walk the proof path to recompute the root
  let currentHash = computedLeafHash

  for (const step of proof.proof) {
    if (step.direction === 'left') {
      // Sibling is on the left, current is on the right
      currentHash = computeNodeHash(step.hash, currentHash)
    } else {
      // Sibling is on the right, current is on the left
      currentHash = computeNodeHash(currentHash, step.hash)
    }
  }

  // Step 3: Compare computed root with expected root
  return currentHash === proof.root
}

/**
 * Independently reconstructs the Merkle root from ALL event hashes.
 * Used by the verifier to confirm that the committed root matches
 * the complete event set.
 *
 * @param eventHashes - All event hashes in sequence order
 * @returns The recomputed Merkle root
 */
export function recomputeMerkleRoot(eventHashes: string[]): string {
  const tree = buildMerkleTree(eventHashes)
  return tree.root
}
