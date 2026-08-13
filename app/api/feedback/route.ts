import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { wallet, feedback, rating } = body

    if (!feedback || typeof feedback !== 'string' || feedback.trim().length === 0) {
      return NextResponse.json({ error: 'Feedback text is required' }, { status: 400 })
    }

    console.log('[PROVN_FEEDBACK_CAPTURE]:', {
      wallet: wallet || 'anonymous',
      rating: rating || 5,
      feedback: feedback.trim().slice(0, 1000),
      timestamp: new Date().toISOString(),
    })

    return NextResponse.json({ success: true, message: 'Thank you for your feedback!' })
  } catch (error) {
    console.error('Feedback API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
