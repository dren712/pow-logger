import { sign } from 'tweetnacl';

// In production, this would be derived from a process.env.PROVN_SERVER_SECRET.
// For the protocol prototype, we use a deterministic seed so tests and local dev work.
const SERVER_SEED = new Uint8Array(32); // Deterministic testing keypair
for (let i = 0; i < 32; i++) {
  SERVER_SEED[i] = i; 
}

const serverKeypair = sign.keyPair.fromSeed(SERVER_SEED);

export function getServerPublicKey(): Uint8Array {
  return serverKeypair.publicKey;
}

export function signServerReceipt(message: Uint8Array): Uint8Array {
  return sign.detached(message, serverKeypair.secretKey);
}

export function verifyServerReceipt(message: Uint8Array, signature: Uint8Array): boolean {
  return sign.detached.verify(message, signature, serverKeypair.publicKey);
}
