import nacl, { SignKeyPair } from 'tweetnacl';
import bs58 from 'bs58';

let serverKeypair: SignKeyPair | null = null;

export const PROVN_KID = 'provn-server-2026-08';

/**
 * Published Historical Public Key Registry:
 * Independent verifiers, third-party nodes, and smart contracts can verify
 * all historical PROVN receipts and challenges offline using these immutable public keys
 * without requiring access to the server's private signing secrets.
 */
export const PROVN_TRUSTED_PUBLIC_KEYS: Readonly<Record<string, string>> = Object.freeze({
  // Epoch 2026-08 (Genesis / Current Protocol Key)
  'provn-server-2026-08': 'FAe4sisG95oZ42w7buUn5qEE4TAnfTTFPiguZUHmhiF',
  // Historical Test Epoch for key rotation validation
  'provn-server-2026-06': '3yFwqdfjEU52f3Hj1m79xJ2vKrqWpZz7fE9iM2e7X8uG',
});

if (process.env.PROVN_SERVER_SECRET) {
  const secretKey = bs58.decode(process.env.PROVN_SERVER_SECRET);
  if (secretKey.length !== 64) {
    throw new Error(`CRITICAL PROTOCOL ERROR: PROVN_SERVER_SECRET must be exactly 64 bytes (got ${secretKey.length})`);
  }
  serverKeypair = nacl.sign.keyPair.fromSecretKey(secretKey);
} else {
  // Deterministic seed for development and testing (matches genesis 'provn-server-2026-08' public key)
  const SERVER_SEED = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    SERVER_SEED[i] = i; 
  }
  serverKeypair = nacl.sign.keyPair.fromSeed(SERVER_SEED);
  if (process.env.NODE_ENV === 'production') {
    console.warn('WARNING: PROVN_SERVER_SECRET is not configured in production environment.');
  }
}

export function getServerPublicKey(kid: string = PROVN_KID): Uint8Array | null {
  // 1. If actively configured with a signing keypair matching this kid, return its public key
  if (serverKeypair && kid === PROVN_KID) {
    return serverKeypair.publicKey;
  }

  // 2. Resolve from published static public key registry (offline verifier friendly)
  if (PROVN_TRUSTED_PUBLIC_KEYS[kid]) {
    try {
      return bs58.decode(PROVN_TRUSTED_PUBLIC_KEYS[kid]);
    } catch {
      return null;
    }
  }

  return null;
}

export function signServerReceipt(message: Uint8Array): Uint8Array {
  if (!serverKeypair) {
    throw new Error('Signing keypair is not configured on this node');
  }
  return nacl.sign.detached(message, serverKeypair.secretKey);
}

export function verifyServerReceipt(message: Uint8Array, signature: Uint8Array, kid: string = PROVN_KID): boolean {
  const pubkey = getServerPublicKey(kid);
  if (!pubkey) {
    return false; // Unknown or revoked key ID
  }
  return nacl.sign.detached.verify(message, signature, pubkey);
}
