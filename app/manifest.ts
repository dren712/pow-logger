import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'PROVN — verified developer profiles',
    short_name: 'PROVN',
    description: 'A verified developer profile and résumé built from your merged GitHub work.',
    start_url: '/',
    display: 'standalone',
    background_color: '#060709',
    theme_color: '#060709',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  }
}
