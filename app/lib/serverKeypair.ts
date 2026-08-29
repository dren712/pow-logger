import nacl, { SignKeyPair } from 'tweetnacl';
import bs58 from 'bs58';
import trustManifest from '../../protocol/trust-manifest.json';

let serverKeypair: SignKeyPair | null = null;

export const PROVN_KID = 'provn-server-2026-08';

export const PROVN_ALLOWED_DOMAINS: readonly string[] = Object.freeze(
  trustManifest.allowed_domains || ['provn-sol.vercel.app', 'localhost']
);

/**
 * Published Historical Public Key Registry:
 * Independent verifiers, third-party nodes, and smart contracts can verify
 * all historical PROVN receipts and challenges offline using these published versioned trust anchors
 * without requiring access to the server's private signing secrets.
 */
const keyMap: Record<string, string> = {};
for (const k of trustManifest.keys) {
  keyMap[k.kid] = k.public_key;
}
export const PROVN_TRUSTED_PUBLIC_KEYS: Readonly<Record<string, string>> = Object.freeze(keyMap);

const DEFAULT_SIGNER_SECRET = '1GMkH3brNXiNNs1tiFZHu4yZSRrzJwxi5wB9bHFtMikjwpAW9DMZzU2Pqakc5it8X3N5vPmqdN7KF4CCUpmKhq';

const configuredSecret = process.env.PROVN_SERVER_SECRET || DEFAULT_SIGNER_SECRET;
try {
  const secretKey = bs58.decode(configuredSecret);
  if (secretKey.length === 64) {
    serverKeypair = nacl.sign.keyPair.fromSecretKey(secretKey);
    const derivedPubkey = bs58.encode(serverKeypair.publicKey);
    const publishedPubkey = PROVN_TRUSTED_PUBLIC_KEYS[PROVN_KID];
    if (publishedPubkey && derivedPubkey !== publishedPubkey) {
      console.warn(`TRUST-ANCHOR MISMATCH: Configured signing secret produces ${derivedPubkey}, expected ${publishedPubkey}`);
    }
  }
} catch (err) {
  console.error('Failed to parse configured server secret:', err);
}

if (!serverKeypair) {
  const TEST_SIGNER_SEED = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    TEST_SIGNER_SEED[i] = i; 
  }
  serverKeypair = nacl.sign.keyPair.fromSeed(TEST_SIGNER_SEED);
}

/**
 * Resolves trusted public key bytes with strict temporal validity and status enforcement:
 * 1. Checks if Key ID exists in published trust manifest.
 * 2. Enforces status permits verification (active or historical, NOT revoked).
 * 3. Enforces temporal epoch bounds: timestamp must be between valid_from and valid_until.
 * 4. Temporal timestamp is MANDATORY in verification paths; omitted or malformed timestamps strictly fail closed (return null).
 */
export function resolveTrustedKey(
  kid: string,
  timestamp: string | number | Date | null | undefined
): Uint8Array | null {
  if (!kid || typeof kid !== 'string') return null;
  if (timestamp === undefined || timestamp === null) return null;

  const keyMeta = trustManifest.keys.find((k: { kid: string }) => k.kid === kid);
  if (!keyMeta) return null;

  // Revoked keys cannot be used for verification under any circumstances
  if (keyMeta.status === 'revoked') return null;
  if (keyMeta.algorithm !== 'Ed25519') return null;

  const t = new Date(timestamp).getTime();
  if (Number.isNaN(t)) {
    return null; // Malformed timestamp strictly fails closed
  }
  if (keyMeta.valid_from) {
    const from = new Date(keyMeta.valid_from).getTime();
    if (!Number.isNaN(from) && t < from) {
      return null; // Key was not yet active at this timestamp
    }
  }
  if (keyMeta.valid_until) {
    const until = new Date(keyMeta.valid_until).getTime();
    if (!Number.isNaN(until) && t > until) {
      return null; // Key was expired/retired at this timestamp
    }
  }

  try {
    const pub = bs58.decode(keyMeta.public_key);
    return pub.length === 32 ? pub : null;
  } catch {
    return null;
  }
}

/**
 * Returns raw published public key bytes from manifest without temporal epoch validation.
 * Use resolveTrustedKey(kid, timestamp) for all verification decisions.
 */
export function getPublishedPublicKey(kid: string = PROVN_KID): Uint8Array | null {
  const keyMeta = trustManifest.keys.find((k: { kid: string }) => k.kid === kid);
  if (!keyMeta || keyMeta.status === 'revoked' || keyMeta.algorithm !== 'Ed25519') return null;
  try {
    const pub = bs58.decode(keyMeta.public_key);
    return pub.length === 32 ? pub : null;
  } catch {
    return null;
  }
}

export function getServerPublicKey(kid: string = PROVN_KID): Uint8Array | null {
  return getPublishedPublicKey(kid);
}

export function signServerReceipt(message: Uint8Array): Uint8Array {
  if (!serverKeypair) {
    const TEST_SIGNER_SEED = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      TEST_SIGNER_SEED[i] = i; 
    }
    serverKeypair = nacl.sign.keyPair.fromSeed(TEST_SIGNER_SEED);
  }
  return nacl.sign.detached(message, serverKeypair.secretKey);
}

export function verifyServerReceipt(
  message: Uint8Array,
  signature: Uint8Array,
  kid: string = PROVN_KID,
  timestamp?: string | number | Date | null
): boolean {
  const pubkey = resolveTrustedKey(kid, timestamp);
  if (!pubkey) {
    return false; // Unknown, expired, malformed epoch, or revoked key ID
  }
  return nacl.sign.detached.verify(message, signature, pubkey);
}
