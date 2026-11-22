'use client'

import { useState, useEffect } from 'react'
import ModalShell, { CheckIcon } from './modals-cards/ModalShell'

interface ShareCardModalProps {
  isOpen: boolean
  onClose: () => void
  svgString: string
  title?: string
  logId?: number
  logContent?: string
  irysTxId?: string
}

export default function ShareCardModal({
  isOpen,
  onClose,
  svgString,
  title = 'Proof card',
  logId,
  logContent = '',
  irysTxId,
}: ShareCardModalProps) {
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
    const proofLink = irysTxId
      ? `Verified on Arweave: https://gateway.irys.xyz/${irysTxId}`
      : `Verified SIWS Proof: https://provn-sol.vercel.app`
    const tweetText = `Just logged my proof-of-work on PROVN 🗿\n\n"${previewText}"\n\n${proofLink}\nBuild your reputation: provn-sol.vercel.app\n#PROVN #Solana #BuildInPublic`

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
      window.open(tweetIntent, '_blank', 'noopener')
    }, 400)
  }

  const handleCopySvg = () => {
    navigator.clipboard.writeText(svgString)
    setCopiedSvg(true)
    setTimeout(() => setCopiedSvg(false), 2000)
  }

  const displayTitle = title.replace(/[\p{Extended_Pictographic}\uFE0F]/gu, '').trim() || 'Proof card'
  const shareLabel = copiedImage ? 'Image copied. Opening X' : canWebShareFiles ? 'Share image' : 'Share on X'

  return (
    <ModalShell
      title={displayTitle}
      description="A shareable image of this proof entry."
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={handleCopySvg} className={`pv-btn-ghost${copiedSvg ? ' pvm-ok' : ''}`}>
            {copiedSvg ? (
              <>
                <CheckIcon /> SVG copied
              </>
            ) : (
              'Copy SVG'
            )}
          </button>
          <button type="button" onClick={handleShareSeamless} className="pv-btn" disabled={!svgString}>
            {shareLabel}
          </button>
        </>
      }
    >
      {svgString ? (
        <div className="pvm-preview pvm-preview-card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={displayImage} alt="Preview of the proof card image" />
        </div>
      ) : (
        <div className="pvm-empty">
          <strong>No card to preview</strong>
          The card image could not be generated for this entry.
        </div>
      )}

      <div className={`pvm-note${copiedImage ? ' pvm-note-ok' : ''}`} role="status" aria-live="polite">
        {copiedImage ? <CheckIcon size={16} /> : <InfoIcon />}
        <span>
          {canWebShareFiles
            ? 'Share image opens your device share sheet with the PNG attached.'
            : copiedImage
            ? 'The PNG is on your clipboard. Paste it into the X composer with Ctrl+V or Cmd+V.'
            : 'Share on X copies the PNG to your clipboard and opens the X composer, so you can paste the image into your post. If your browser blocks image copying, the file is downloaded instead.'}
        </span>
      </div>
    </ModalShell>
  )
}

function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 7.25v4M8 4.75v.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}
