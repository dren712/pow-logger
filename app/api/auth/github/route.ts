import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const wallet = url.searchParams.get('wallet')

  if (!wallet) {
    return NextResponse.json({ error: 'Wallet parameter is required' }, { status: 400 })
  }

  const clientId = process.env.GITHUB_CLIENT_ID
  if (!clientId) {
    console.error('GITHUB_CLIENT_ID is not configured')
    return NextResponse.json({ error: 'OAuth configuration error' }, { status: 500 })
  }

  // Use the wallet address as the state parameter.
  // In a production system, this could be a signed token or encrypted to prevent CSRF,
  // but for the sake of identity linking, verifying the wallet via SIWS before hitting this endpoint
  // is typically handled on the client side, and the callback will securely link it.
  const state = Buffer.from(JSON.stringify({ wallet })).toString('base64')

  const githubAuthUrl = new URL('https://github.com/login/oauth/authorize')
  githubAuthUrl.searchParams.append('client_id', clientId)
  githubAuthUrl.searchParams.append('state', state)
  // We only need basic profile read access to get the user ID and username
  githubAuthUrl.searchParams.append('scope', 'read:user')

  return NextResponse.redirect(githubAuthUrl.toString())
}
