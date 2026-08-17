'use client'

/**
 * PROVN Client-Side QR Code Generator
 *
 * Generates QR codes entirely client-side to prevent wallet address
 * leakage to third-party services (previously api.qrserver.com).
 *
 * Uses the 'qrcode' npm package for canvas-based generation.
 */

import { useEffect, useState } from 'react'

/**
 * React hook that generates a QR code data URL client-side.
 * Returns null while generating, then a data:image/png;base64,... string.
 */
export function useQRCode(
  data: string,
  options?: {
    width?: number
    margin?: number
    darkColor?: string
    lightColor?: string
  }
): string | null {
  const [dataUrl, setDataUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!data) return

    let cancelled = false

    async function generate() {
      try {
        // Dynamic import to avoid SSR issues
        const QRCode = (await import('qrcode')) as unknown as {
          toDataURL: (text: string, opts?: Record<string, unknown>) => Promise<string>
        }
        const url = await QRCode.toDataURL(data, {
          width: options?.width || 200,
          margin: options?.margin || 2,
          color: {
            dark: options?.darkColor || '#ffffff',
            light: options?.lightColor || '#08090c',
          },
          errorCorrectionLevel: 'M',
        })
        if (!cancelled) {
          setDataUrl(url)
        }
      } catch (err) {
        console.error('QR code generation failed:', err)
      }
    }

    generate()

    return () => {
      cancelled = true
    }
  }, [data, options?.width, options?.margin, options?.darkColor, options?.lightColor])

  return dataUrl
}
