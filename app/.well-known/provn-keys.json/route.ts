import { NextResponse } from 'next/server'
import trustManifest from '@/protocol/trust-manifest.json'

export const dynamic = 'force-static'
export const revalidate = 86400

export async function GET() {
  return NextResponse.json(trustManifest, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
    },
  })
}
