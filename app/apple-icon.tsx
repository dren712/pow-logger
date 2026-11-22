import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

// iOS masks the icon itself, so the mark fills the square on the site background.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#060709' }}>
        <svg width="132" height="132" viewBox="0 0 24 24" fill="none">
          <rect x="1" y="1" width="22" height="22" rx="6" fill="#2ee59d" />
          <path d="M7 12.5l3.2 3.2L17 8.8" stroke="#04130c" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    ),
    size
  )
}
