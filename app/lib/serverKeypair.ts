import nacl, { SignKeyPair } from 'tweetnacl';
import bs58 from 'bs58';
import trustManifest from '../../protocol/trust-manifest.json';

let serverKeypair: SignKeyPair | null = null;

export const PROVN_KID = process.env.PROVN_KID || 'provn-server-2026-09-r2';

export const PROVN_ALLOWED_DOMAINS: readonly string[] = Object.freeze(
  trustManifest.allowed_domains || ['provn-sol.vercel.app']
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

function initServerKeypair(): SignKeyPair | null {
  if (serverKeypair) return serverKeypair;
  if (!process.env.PROVN_SERVER_SECRET) {
    return null;
  }
  const secretKey = bs58.decode(process.env.PROVN_SERVER_SECRET.trim());
  if (secretKey.length !== 64) {
    throw new Error(`CRITICAL PROTOCOL ERROR: PROVN_SERVER_SECRET must be exactly 64 bytes (got ${secretKey.length})`);
  }
  const kp = nacl.sign.keyPair.fromSecretKey(secretKey);
  const derivedPubkey = bs58.encode(kp.publicKey);
  const activeKid = process.env.PROVN_KID || PROVN_KID;

  // In production, forbid using test fixture or revoked signing identities
  if (process.env.NODE_ENV === 'production') {
    const keyEntry = trustManifest.keys.find((k: { kid: string }) => k.kid === activeKid);
    if (!keyEntry || keyEntry.status === 'test' || keyEntry.status === 'revoked') {
      throw new Error(`CRITICAL PROTOCOL ERROR: Signing identity '${activeKid}' is marked as ${keyEntry?.status || 'unregistered'} and is forbidden in production.`);
    }
  }

  const publishedPubkey = PROVN_TRUSTED_PUBLIC_KEYS[activeKid];
  if (publishedPubkey && derivedPubkey !== publishedPubkey) {
    throw new Error(`CRITICAL TRUST-ANCHOR MISMATCH: Configured signing secret produces public key ${derivedPubkey}, which disagrees with published registry for ${activeKid} (${publishedPubkey}).`);
  }
  serverKeypair = kp;
  return serverKeypair;
}

// Initial evaluation at module load
try {
  initServerKeypair();
} catch (err) {
  if (process.env.NODE_ENV === 'production' && process.env.PROVN_SERVER_SECRET) {
    throw err;
  }
}

/**
 * Explicit requirement helper for endpoints that issue server signatures.
 * Fails closed immediately if server signing secret is unconfigured.
 */
export function requireServerKeypair(): SignKeyPair {
  const kp = initServerKeypair();
  if (!kp) {
    throw new Error('CRITICAL PROTOCOL ERROR: PROVN_SERVER_SECRET is required and not configured on this node.');
  }
  return kp;
}

/**
 * Resolves trusted public key bytes with strict temporal validity, revocation boundaries, and status enforcement:
 * 1. Checks if Key ID exists in published trust manifest.
 * 2. Enforces status permits verification:
 *    - 'active' & 'historical': Valid within [valid_from, valid_until].
 *    - 'revoked': Signatures observed at or after revoked_at are strictly rejected.
 *    - 'test': Valid strictly in non-production environments; strictly rejected in production.
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

  if (keyMeta.algorithm !== 'Ed25519') return null;

  // Test keys are strictly forbidden in production verifiers
  if (keyMeta.status === 'test' && process.env.NODE_ENV === 'production') {
    return null;
  }

  const t = new Date(timestamp).getTime();
  if (Number.isNaN(t)) {
    return null; // Malformed timestamp strictly fails closed
  }

  // Revocation handling with temporal cutoff (Standard PKI CRL/OCSP semantics)
  if (keyMeta.status === 'revoked') {
    if (!keyMeta.revoked_at) return null; // No timestamp provided -> fail closed
    const revokedAtTime = new Date(keyMeta.revoked_at).getTime();
    if (Number.isNaN(revokedAtTime) || t >= revokedAtTime) {
      return null; // Rejected: timestamp is at or after revocation
    }
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
  if (keyMeta.status === 'test' && process.env.NODE_ENV === 'production') return null;
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
  const kp = requireServerKeypair();
  return nacl.sign.detached(message, kp.secretKey);
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
