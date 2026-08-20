import { NextResponse } from 'next/server'
import { PROVN_TRUSTED_PUBLIC_KEYS } from '@/app/lib/serverKeypair'

export const dynamic = 'force-static'
export const revalidate = 86400

export async function GET() {
  const manifest = {
    protocol: 'PROVN',
    version: 2,
    issuer: 'PROVN Protocol Trust Registry',
    manifest_uri: 'https://provn-sol.vercel.app/.well-known/provn-keys.json',
    updated_at: '2026-08-21T00:00:00Z',
    keys: [
      {
        kid: 'provn-server-2026-08',
        algorithm: 'Ed25519',
        public_key: PROVN_TRUSTED_PUBLIC_KEYS['provn-server-2026-08'],
        valid_from: '2026-08-01T00:00:00Z',
        valid_until: null,
        status: 'active',
        purpose: 'Server challenge token and submission receipt signing',
      },
      {
        kid: 'provn-server-2026-06',
        algorithm: 'Ed25519',
        public_key: PROVN_TRUSTED_PUBLIC_KEYS['provn-server-2026-06'],
        valid_from: '2026-06-01T00:00:00Z',
        valid_until: '2026-08-31T23:59:59Z',
        status: 'historical',
        purpose: 'Historical test and pilot epoch signing',
      },
    ],
  }

  return NextResponse.json(manifest, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
    },
  })
}
