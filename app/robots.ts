import type { MetadataRoute } from 'next'
import { SITE } from './lib/profileFormat'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/api/gh-badge/'],
        disallow: ['/api/', '/admin/'],
      },
    ],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  }
}
