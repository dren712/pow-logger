'use client'

import { track } from '@vercel/analytics'

type AnalyticsEvent = 'profile_view' | 'resume_download' | 'share_click' | 'readme_card_copy' | 'waitlist_join'
type EventProperties = { network?: 'x' | 'linkedin'; source?: 'profile' | 'resume' | 'year'; theme?: 'light' | 'dark' }

export function trackEvent(event: AnalyticsEvent, properties?: EventProperties) {
  try {
    track(event, properties)
  } catch {
    // Analytics must never interrupt the action being measured.
  }
}
