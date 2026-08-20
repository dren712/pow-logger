import nacl, { SignKeyPair } from 'tweetnacl';
import bs58 from 'bs58';
import trustManifest from '../../protocol/trust-manifest.json';

let serverKeypair: SignKeyPair | null = null;
let isProductionWithoutSecret = false;

export const PROVN_KID = 'provn-server-2026-08';

/**
 * Published Historical Public Key Registry:
 * Independent verifiers, third-party nodes, and smart contracts can verify
 * all historical PROVN receipts and challenges offline using these immutable public keys
 * without requiring access to the server's private signing secrets.
 */
const keyMap: Record<string, string> = {};
for (const k of trustManifest.keys) {
  keyMap[k.kid] = k.public_key;
}
export const PROVN_TRUSTED_PUBLIC_KEYS: Readonly<Record<string, string>> = Object.freeze(keyMap);

if (process.env.PROVN_SERVER_SECRET) {
  const secretKey = bs58.decode(process.env.PROVN_SERVER_SECRET);
  if (secretKey.length !== 64) {
    throw new Error(`CRITICAL PROTOCOL ERROR: PROVN_SERVER_SECRET must be exactly 64 bytes (got ${secretKey.length})`);
  }
  serverKeypair = nacl.sign.keyPair.fromSecretKey(secretKey);
  const derivedPubkey = bs58.encode(serverKeypair.publicKey);
  const publishedPubkey = PROVN_TRUSTED_PUBLIC_KEYS[PROVN_KID];
  if (publishedPubkey && derivedPubkey !== publishedPubkey) {
    throw new Error(`CRITICAL TRUST-ANCHOR MISMATCH: Configured signing secret produces public key ${derivedPubkey}, which disagrees with published registry for ${PROVN_KID} (${publishedPubkey}).`);
  }
} else if (process.env.NODE_ENV === 'production') {
  isProductionWithoutSecret = true;
} else {
  // Deterministic seed for development and testing (matches genesis 'provn-server-2026-08' public key)
  const SERVER_SEED = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    SERVER_SEED[i] = i; 
  }
  serverKeypair = nacl.sign.keyPair.fromSeed(SERVER_SEED);
}

export function getServerPublicKey(kid: string = PROVN_KID): Uint8Array | null {
  // Resolve from published static public key registry (offline verifier friendly)
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
  if (isProductionWithoutSecret) {
    throw new Error('CRITICAL PROTOCOL ERROR: PROVN_SERVER_SECRET is strictly required in production.');
  }
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
