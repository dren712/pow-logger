'use client'

import { useState, useEffect } from 'react'

interface NFTBadgeModalProps {
  isOpen: boolean
  onClose: () => void
  svgString: string
  title?: string
  logId?: number
  logContent?: string
  irysTxId?: string
}

export default function NFTBadgeModal({
  isOpen,
  onClose,
  svgString,
  title = 'PROVN Proof Card 🗿',
  logId,
  logContent = '',
  irysTxId,
}: NFTBadgeModalProps) {
  const [copiedSvg, setCopiedSvg] = useState(false)
  const [copiedImage, setCopiedImage] = useState(false)
  const [pngDataUrl, setPngDataUrl] = useState<string | null>(null)
  const [canWebShareFiles, setCanWebShareFiles] = useState(false)

  useEffect(() => {
    if (!svgString || typeof window === 'undefined') return

    const img = new Image()
    const encodedSvg = encodeURIComponent(svgString)
    const dataUrl = `data:image/svg+xml;charset=utf-8,${encodedSvg}`

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = 1280
        canvas.height = 760
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(img, 0, 0, 1280, 760)
          const pngUrl = canvas.toDataURL('image/png')
          setPngDataUrl(pngUrl)

          // Check if device supports Web Share API with files (iOS/Android native share)
          if (typeof navigator !== 'undefined' && 'canShare' in navigator) {
            fetch(pngUrl)
              .then((res) => res.blob())
              .then((blob) => {
                const file = new File([blob], 'provn-card.png', { type: 'image/png' })
                if (navigator.canShare({ files: [file] })) {
                  setCanWebShareFiles(true)
                }
              })
              .catch(() => {})
          }
        }
      } catch (err) {
        console.error('SVG to PNG conversion error:', err)
      }
    }
    img.src = dataUrl
  }, [svgString])

  if (!isOpen) return null

  const encodedSvg = encodeURIComponent(svgString)
  const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodedSvg}`
  const displayImage = pngDataUrl || svgDataUrl

  const handleShareSeamless = async () => {
    const previewText = logContent.length > 80 ? `${logContent.slice(0, 80)}...` : logContent
    const gatewayUrl = irysTxId ? `https://gateway.irys.xyz/${irysTxId}` : 'https://provn-sol.vercel.app'
    const tweetText = `Just logged my proof-of-work on PROVN 🗿\n\n"${previewText}"\n\nVerified on Arweave: ${gatewayUrl}\nBuild your reputation: provn-sol.vercel.app\n#PROVN #Solana #BuildInPublic`

    // 1. Mobile Web Share API (Spotify Lyrics Card Pattern — Auto Attaches Image)
    if (pngDataUrl && typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        const res = await fetch(pngDataUrl)
        const blob = await res.blob()
        const file = new File([blob], `provn-proof-${logId || 'card'}.png`, { type: 'image/png' })

        if ('canShare' in navigator && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: 'PROVN Proof Entry 🗿',
            text: tweetText,
            files: [file],
          })
          return
        }
      } catch (err) {
        console.error('Native Web Share cancelled or unhandled:', err)
      }
    }

    // 2. Desktop Seamless UX (Auto Copy PNG Image to Clipboard + Open X)
    let copiedToClipboard = false
    if (pngDataUrl && typeof window !== 'undefined' && typeof ClipboardItem !== 'undefined') {
      try {
        const res = await fetch(pngDataUrl)
        const blob = await res.blob()
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ])
        copiedToClipboard = true
        setCopiedImage(true)
        setTimeout(() => setCopiedImage(false), 4000)
      } catch (err) {
        console.warn('Clipboard image copy not supported by browser, falling back to download:', err)
      }
    }

    // If clipboard copy wasn't supported, trigger fallback download
    if (!copiedToClipboard) {
      const downloadLink = document.createElement('a')
      downloadLink.href = displayImage
      downloadLink.download = `provn-proof-${logId || 'card'}.${pngDataUrl ? 'png' : 'svg'}`
      document.body.appendChild(downloadLink)
      downloadLink.click()
      document.body.removeChild(downloadLink)
    }

    // Open X Intent
    const tweetIntent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`
    setTimeout(() => {
      window.location.href = tweetIntent
    }, 400)
  }

  const handleCopySvg = () => {
    navigator.clipboard.writeText(svgString)
    setCopiedSvg(true)
    setTimeout(() => setCopiedSvg(false), 2000)
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(6, 7, 9, 0.88)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '20px',
        zIndex: 99999,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#0c0e12',
          border: '1px solid #00ff88',
          borderRadius: '16px',
          padding: '24px',
          maxWidth: '680px',
          width: '100%',
          boxShadow: '0 0 40px rgba(0, 255, 136, 0.18)',
          fontFamily: 'var(--font-geist-mono), monospace',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ color: '#00ff88', margin: 0, fontSize: '15px', fontWeight: 800 }}>
            🖼️ {title}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#888',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Seamless Share Guidance Banner */}
        <div
          style={{
            background: 'rgba(0, 255, 136, 0.08)',
            border: '1px solid rgba(0, 255, 136, 0.25)',
            color: '#00ff88',
            borderRadius: '8px',
            padding: '10px 14px',
            marginBottom: '16px',
            fontSize: '11px',
            lineHeight: '1.5',
            textAlign: 'center',
          }}
        >
          {canWebShareFiles ? (
            <>📲 <strong>Mobile Web Share:</strong> Tapping <strong>Share Badge Card to X</strong> auto-attaches your PNG card image directly to your post on X!</>
          ) : copiedImage ? (
            <>✓ <strong>PNG Card Copied to Clipboard!</strong> Press <strong>Cmd+V (or Ctrl+V)</strong> in the X composer to paste your proof image instantly.</>
          ) : (
            <>✨ <strong>Seamless 1-Click Sharing:</strong> Tapping <strong>Share Badge Card to X</strong> auto-copies the PNG proof card to your clipboard and opens X!</>
          )}
        </div>

        {/* Display Image (Converted PNG or SVG) */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            background: '#060709',
            borderRadius: '12px',
            padding: '12px',
            border: '1px solid #1a202c',
            marginBottom: '20px',
            overflow: 'hidden',
          }}
        >
          <img
            src={displayImage}
            alt="PROVN NFT Proof Badge"
            style={{
              maxWidth: '100%',
              height: 'auto',
              borderRadius: '8px',
            }}
          />
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={handleShareSeamless}
            className="btn-primary"
            style={{
              flex: 2,
              fontSize: '12px',
              padding: '12px',
              background: '#00ff88',
              color: '#060709',
              fontWeight: 800,
              justifyContent: 'center',
            }}
          >
            {canWebShareFiles ? '📲 Share Card to X (Auto-Attach PNG) 🗿' : copiedImage ? '✓ PNG Copied! Opening X...' : '🚀 Share Proof Card to X 🗿'}
          </button>

          <button
            onClick={handleCopySvg}
            className="btn-primary"
            style={{
              flex: 1,
              fontSize: '12px',
              padding: '12px',
              borderColor: '#00e5ff',
              color: '#00e5ff',
              justifyContent: 'center',
            }}
          >
            {copiedSvg ? '✓ SVG Copied!' : '📋 Copy SVG Code'}
          </button>
        </div>
      </div>
    </div>
  )
}
