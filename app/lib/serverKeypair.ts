import { sign } from 'tweetnacl';
import bs58 from 'bs58';

let serverKeypair: sign.KeyPair;

export const PROVN_KID = 'provn-server-2026-08';

if (process.env.PROVN_SERVER_SECRET) {
  // Production / Staging
  const secretKey = bs58.decode(process.env.PROVN_SERVER_SECRET);
  serverKeypair = sign.keyPair.fromSecretKey(secretKey);
} else if (process.env.NODE_ENV === 'test') {
  // Deterministic seed for tests to allow offline validation of fixtures if needed
  const SERVER_SEED = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    SERVER_SEED[i] = i; 
  }
  serverKeypair = sign.keyPair.fromSeed(SERVER_SEED);
} else {
  // Development / Unconfigured
  serverKeypair = sign.keyPair();
  console.warn('WARNING: PROVN_SERVER_SECRET is not set. Using ephemeral server keypair. Receipts will not persist across restarts.');
}

export function getServerPublicKey(): Uint8Array {
  return serverKeypair.publicKey;
}

export function signServerReceipt(message: Uint8Array): Uint8Array {
  return sign.detached(message, serverKeypair.secretKey);
}

export function verifyServerReceipt(message: Uint8Array, signature: Uint8Array): boolean {
  return sign.detached.verify(message, signature, serverKeypair.publicKey);
}
