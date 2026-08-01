'use client'

import { useState } from 'react'

interface NFTBadgeModalProps {
  isOpen: boolean
  onClose: () => void
  svgString: string
  title?: string
}

export default function NFTBadgeModal({ isOpen, onClose, svgString, title = 'PoWL NFT Proof Badge' }: NFTBadgeModalProps) {
  const [copied, setCopied] = useState(false)

  if (!isOpen) return null

  const encodedSvg = encodeURIComponent(svgString)
  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodedSvg}`

  const handleOpenNewTab = () => {
    const newWindow = window.open()
    if (newWindow) {
      newWindow.document.write(`<body style="margin:0;background:#060709;display:flex;justify-content:center;align-items:center;min-height:100vh;">${svgString}</body>`)
      newWindow.document.title = title
    } else {
      window.location.href = dataUrl
    }
  }

  const handleCopySvg = () => {
    navigator.clipboard.writeText(svgString)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(6, 7, 9, 0.85)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
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
          boxShadow: '0 0 40px rgba(0, 255, 136, 0.15)',
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

        {/* Mobile Guidance Banner */}
        <div
          style={{
            background: 'rgba(0, 229, 255, 0.08)',
            border: '1px solid rgba(0, 229, 255, 0.25)',
            color: '#00e5ff',
            borderRadius: '8px',
            padding: '8px 12px',
            marginBottom: '16px',
            fontSize: '11px',
            textAlign: 'center',
          }}
        >
          📱 <strong>Mobile / Phantom Browser:</strong> Long press badge image below to <strong>Save to Photos</strong> or tap <strong>Open in New Tab</strong>.
        </div>

        {/* SVG Display Image */}
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
            src={dataUrl}
            alt="PoWL NFT Proof Badge"
            style={{
              maxWidth: '100%',
              height: 'auto',
              borderRadius: '8px',
              userSelect: 'auto',
              WebkitUserSelect: 'auto',
            }}
          />
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={handleOpenNewTab}
            className="btn-primary"
            style={{
              flex: 1,
              fontSize: '12px',
              padding: '10px',
              borderColor: '#00ff88',
              color: '#00ff88',
              justifyContent: 'center',
            }}
          >
            🔗 Open Badge in New Tab ↗
          </button>

          <button
            onClick={handleCopySvg}
            className="btn-primary"
            style={{
              flex: 1,
              fontSize: '12px',
              padding: '10px',
              borderColor: '#00e5ff',
              color: '#00e5ff',
              justifyContent: 'center',
            }}
          >
            {copied ? '✓ SVG Copied!' : '📋 Copy SVG Code'}
          </button>
        </div>
      </div>
    </div>
  )
}
