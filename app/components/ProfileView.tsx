'use client'

import { useEffect, useRef } from 'react'
import { trackEvent } from '@/app/lib/analytics'

export default function ProfileView({ username }: { username: string }) {
  const viewed = useRef<string | null>(null)
  useEffect(() => {
    if (viewed.current !== username) {
      trackEvent('profile_view')
      viewed.current = username
    }
  }, [username])
  return null
}
