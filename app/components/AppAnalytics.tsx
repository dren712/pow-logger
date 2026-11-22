'use client'

import { Analytics } from '@vercel/analytics/react'

export default function AppAnalytics() {
  return <Analytics beforeSend={event => {
    const url = new URL(event.url)
    url.search = ''
    url.hash = ''
    url.pathname = url.pathname.replace(/^(\/gh|\/u|\/proof|\/verify)\/[^/]+/, '$1/[identifier]')
    return { ...event, url: url.toString() }
  }} />
}
