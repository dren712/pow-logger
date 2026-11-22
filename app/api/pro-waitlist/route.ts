import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit } from '@/app/lib/rateLimiter'
import { isConfiguredSupabaseUrl } from '@/app/lib/canonicalMessage'
import { validateWaitlistInput } from '@/app/lib/proWaitlist'

const opensSoon = 'Waitlist opens soon, try again later'

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1'
  const limit = checkRateLimit(`pro_waitlist_${ip}`, 'ip', 5, 900000)
  if (!limit.allowed) return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, {
    status: 429, headers: { 'Retry-After': String(Math.max(1, Math.ceil((limit.resetTime - Date.now()) / 1000))) },
  })
  let input: unknown
  try {
    if (Number(request.headers.get('content-length')) > 4096) return NextResponse.json({ error: 'Request too large' }, { status: 413 })
    const text = await request.text()
    if (text.length > 4096) return NextResponse.json({ error: 'Request too large' }, { status: 413 })
    input = JSON.parse(text)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const result = validateWaitlistInput(input)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key || !isConfiguredSupabaseUrl(url)) return NextResponse.json({ error: opensSoon }, { status: 503 })
  try {
    const supabase = createClient(url, key, { auth: { persistSession: false } })
    const { error } = await supabase.from('pro_waitlist').insert(result.value)
    if (error?.code === '23505') return NextResponse.json({ message: 'You’re already on the list.' })
    if (error?.code === '42P01' || error?.code === 'PGRST205') return NextResponse.json({ error: opensSoon }, { status: 503 })
    if (error) return NextResponse.json({ error: 'Could not join right now. Please try again later.' }, { status: 502 })
    return NextResponse.json({ message: 'You’re on the list. We’ll let you know when Pro launches.' }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Could not join right now. Please try again later.' }, { status: 502 })
  }
}
