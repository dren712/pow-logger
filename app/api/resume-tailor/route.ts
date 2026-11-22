import { NextRequest, NextResponse } from 'next/server'
import { generateText, Output } from 'ai'
import { checkRateLimit } from '@/app/lib/rateLimiter'
import { loadBuilderProfile } from '@/app/lib/builderProfileCache'
import {
  FREE_TAILOR_USES,
  TAILOR_COOKIE,
  TAILOR_MODELS,
  buildTailorPrompt,
  groundTailoredResume,
  readUsageCookie,
  signUsageCookie,
  tailoredResumeSchema,
  validateTailorInput,
} from '@/app/lib/resumeTailor'

export const maxDuration = 60

const unavailable = 'AI tailoring is unavailable right now. Please try again later.'

function usedCount(request: NextRequest, secret: string) {
  return Math.min(FREE_TAILOR_USES, readUsageCookie(request.cookies.get(TAILOR_COOKIE)?.value, secret))
}

export async function GET(request: NextRequest) {
  const secret = process.env.PROVN_SERVER_SECRET
  if (!secret) return NextResponse.json({ remaining: 0, available: false })
  return NextResponse.json({ remaining: FREE_TAILOR_USES - usedCount(request, secret), available: true })
}

export async function POST(request: NextRequest) {
  const secret = process.env.PROVN_SERVER_SECRET
  if (!secret) return NextResponse.json({ error: unavailable }, { status: 503 })

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1'
  const limit = checkRateLimit(`resume_tailor_${ip}`, 'ip', 4, 24 * 60 * 60 * 1000)
  if (!limit.allowed) return NextResponse.json({ error: 'Too many attempts today. Please try again tomorrow.' }, { status: 429 })

  const used = usedCount(request, secret)
  if (used >= FREE_TAILOR_USES) {
    return NextResponse.json({ error: 'You’ve used your free tailored résumés.', remaining: 0 }, { status: 402 })
  }

  let body: unknown
  try {
    const text = await request.text()
    if (text.length > 12000) return NextResponse.json({ error: 'Request too large' }, { status: 413 })
    body = JSON.parse(text)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const input = validateTailorInput(body)
  if (!input.ok) return NextResponse.json({ error: input.error }, { status: 400 })

  const profileResult = await loadBuilderProfile(input.username)
  if (!profileResult.ok) return NextResponse.json({ error: 'Could not load this GitHub profile right now.' }, { status: 502 })
  const profile = profileResult.profile

  try {
    const { system, prompt } = buildTailorPrompt(profile, input.jobPost)
    const [model, ...fallbacks] = TAILOR_MODELS
    const { output } = await generateText({
      model,
      system,
      prompt,
      output: Output.object({ schema: tailoredResumeSchema }),
      maxOutputTokens: 1200,
      providerOptions: { gateway: { models: fallbacks } },
    })
    const result = groundTailoredResume(profile, output)
    const remaining = FREE_TAILOR_USES - (used + 1)
    const response = NextResponse.json({ result, remaining })
    response.cookies.set(TAILOR_COOKIE, signUsageCookie(used + 1, secret), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/api/resume-tailor',
      maxAge: 60 * 60 * 24 * 365,
    })
    return response
  } catch (error) {
    console.error('Resume tailor failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: unavailable }, { status: 503 })
  }
}
