import nacl, { SignKeyPair } from 'tweetnacl';
import bs58 from 'bs58';

let serverKeypair: SignKeyPair;

export const PROVN_KID = 'provn-server-2026-08';

if (process.env.PROVN_SERVER_SECRET) {
  // Production / Staging with secret provided
  const secretKey = bs58.decode(process.env.PROVN_SERVER_SECRET);
  serverKeypair = nacl.sign.keyPair.fromSecretKey(secretKey);
} else if (process.env.NODE_ENV === 'test') {
  // Deterministic seed for tests to allow offline validation of fixtures
  const SERVER_SEED = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    SERVER_SEED[i] = i; 
  }
  serverKeypair = nacl.sign.keyPair.fromSeed(SERVER_SEED);
} else {
  // Local development or Next.js build-time collection fallback
  serverKeypair = nacl.sign.keyPair();
  console.warn('WARNING: PROVN_SERVER_SECRET is not set. Using ephemeral server keypair.');
}

/**
 * Immutable Public Key Registry: maps Key IDs (kid) to authorized server public keys.
 * Enables historical validation across key rotation epochs without runtime tampering.
 */
const TRUSTED_KEY_REGISTRY: Readonly<Record<string, Uint8Array>> = Object.freeze({
  [PROVN_KID]: serverKeypair.publicKey,
});

export function getServerPublicKey(kid: string = PROVN_KID): Uint8Array | null {
  return TRUSTED_KEY_REGISTRY[kid] || null;
}

export function signServerReceipt(message: Uint8Array): Uint8Array {
  return nacl.sign.detached(message, serverKeypair.secretKey);
}

export function verifyServerReceipt(message: Uint8Array, signature: Uint8Array, kid: string = PROVN_KID): boolean {
  const pubkey = getServerPublicKey(kid);
  if (!pubkey) {
    return false; // Unknown or revoked key ID
  }
  return nacl.sign.detached.verify(message, signature, pubkey);
}
