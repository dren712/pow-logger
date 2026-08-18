import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
)

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const stateBase64 = url.searchParams.get('state')

  if (!code || !stateBase64) {
    return NextResponse.json({ error: 'Missing code or state' }, { status: 400 })
  }

  let wallet: string
  let action: string
  try {
    // Look up the state in oauth_states table
    const { data: stateRecord } = await supabase
      .from('oauth_states')
      .select('wallet_address, expires_at, action')
      .eq('state_id', stateBase64)
      .single()

    if (!stateRecord) {
      return NextResponse.json({ error: 'Invalid or missing state parameter' }, { status: 400 })
    }

    if (new Date(stateRecord.expires_at) < new Date()) {
      return NextResponse.json({ error: 'OAuth session expired' }, { status: 400 })
    }

    wallet = stateRecord.wallet_address
    action = stateRecord.action || 'Link'

    // Cleanup used state
    await supabase.from('oauth_states').delete().eq('state_id', stateBase64)
  } catch (err) {
    console.error('State validation error', err)
    return NextResponse.json({ error: 'Failed to validate state' }, { status: 500 })
  }

  const clientId = process.env.GITHUB_CLIENT_ID
  const clientSecret = process.env.GITHUB_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'OAuth configuration error' }, { status: 500 })
  }

  try {
    // 1. Exchange code for access token
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    })

    if (!tokenRes.ok) {
      throw new Error('Failed to exchange access token')
    }

    const tokenData = await tokenRes.json()
    if (tokenData.error) {
      throw new Error(tokenData.error_description || tokenData.error)
    }

    const accessToken = tokenData.access_token

    // 2. Fetch GitHub User Profile
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    })

    if (!userRes.ok) {
      throw new Error('Failed to fetch user profile')
    }

    const userData = await userRes.json()
    const githubId = String(userData.id)
    const githubUsername = userData.login

    if (!githubId || !githubUsername) {
      throw new Error('Invalid GitHub profile data')
    }

    // 3. Store Identity in Supabase
    // Check if identity already exists to enforce explicit Relink
    const { data: existingIdentity } = await supabase
      .from('wallet_identities')
      .select('github_id')
      .eq('wallet_address', wallet)
      .maybeSingle()

    if (existingIdentity && action !== 'Relink') {
      throw new Error('Identity already exists. Explicit Relink action required.')
    }

    // Upsert the identity.
    const { error: upsertError } = await supabase
      .from('wallet_identities')
      .upsert(
        {
          wallet_address: wallet,
          github_id: githubId,
          github_username: githubUsername,
          verified_at: new Date().toISOString(),
        },
        { onConflict: 'wallet_address' }
      )

    if (upsertError) {
      console.error('Failed to store wallet identity:', upsertError)
      throw new Error('Database error while saving identity')
    }

    // 4. Redirect back to the user's profile with a success flag
    const redirectUrl = new URL(`/u/${wallet}`, req.url)
    redirectUrl.searchParams.set('identity_linked', 'true')
    return NextResponse.redirect(redirectUrl.toString())
  } catch (error: unknown) {
    console.error('OAuth Callback Error:', error)
    const redirectUrl = new URL(`/u/${wallet}`, req.url)
    redirectUrl.searchParams.set('identity_linked', 'false')
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    redirectUrl.searchParams.set('error', encodeURIComponent(errorMessage))
    return NextResponse.redirect(redirectUrl.toString())
  }
}
