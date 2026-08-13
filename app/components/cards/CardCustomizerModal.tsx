'use client'

import React, { useState } from 'react'
import PassportCard from './PassportCard'
import { CARD_THEMES, CardTheme } from '@/app/lib/cardThemes'
import { BuilderReputation } from '@/app/lib/types'

export interface CardCustomizerModalProps {
  reputation: BuilderReputation
  currentTheme: CardTheme
  onThemeSelect: (theme: CardTheme) => void
  onClose: () => void
}

export default function CardCustomizerModal({
  reputation,
  currentTheme,
  onThemeSelect,
  onClose,
}: CardCustomizerModalProps) {
  const [selectedTheme, setSelectedTheme] = useState<CardTheme>(currentTheme)
  const [copiedLink, setCopiedLink] = useState(false)
  const [copiedConfig, setCopiedConfig] = useState(false)

  const handleSelectTheme = (theme: CardTheme) => {
    setSelectedTheme(theme)
    onThemeSelect(theme)
  }

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/u/${reputation.wallet}?theme=${selectedTheme.id}`
    : `https://provn-sol.vercel.app/u/${reputation.wallet}?theme=${selectedTheme.id}`

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const handleCopyConfig = () => {
    navigator.clipboard.writeText(JSON.stringify(selectedTheme, null, 2))
    setCopiedConfig(true)
    setTimeout(() => setCopiedConfig(false), 2000)
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 150,
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        className="terminal-card"
        style={{
          maxWidth: '860px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: '#090b10',
          border: '1px solid #1c2438',
          borderRadius: '16px',
          padding: '24px',
          boxSizing: 'border-box',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid #161c2c',
            paddingBottom: '16px',
            marginBottom: '20px',
          }}
        >
          <div>
            <h2
              style={{
                color: '#00ff88',
                fontFamily: 'var(--font-geist-mono), monospace',
                fontSize: '18px',
                margin: 0,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span>⚙️</span> PROVN Metallic Card Studio
            </h2>
            <p style={{ color: '#889', fontSize: '11px', margin: '4px 0 0 0' }}>
              Custom digital metal finishes for your verifiable Builder Passport. Cryptographic proof remains frozen.
            </p>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#667',
              fontSize: '18px',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Studio Body: Preview & Controls */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', marginBottom: '24px' }}>
          {/* Card Live Preview */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '100%', maxWidth: '420px' }}>
              <PassportCard reputation={reputation} theme={selectedTheme} showControls={true} />
            </div>
            <div
              style={{
                marginTop: '12px',
                fontSize: '10px',
                fontFamily: 'var(--font-geist-mono), monospace',
                color: '#667',
                textAlign: 'center',
              }}
            >
              Hover to tilt • Click flip button to inspect reverse side
            </div>
          </div>

          {/* Theme & Material Selectors */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <div
                style={{
                  fontSize: '11px',
                  fontFamily: 'var(--font-geist-mono), monospace',
                  color: '#aaa',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  marginBottom: '10px',
                  fontWeight: 700,
                }}
              >
                Select Material Finish
              </div>

              {/* Grid of Materials */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {Object.values(CARD_THEMES).map((th) => {
                  const isSelected = selectedTheme.id === th.id
                  return (
                    <button
                      key={th.id}
                      onClick={() => handleSelectTheme(th)}
                      style={{
                        background: isSelected ? 'rgba(0, 255, 136, 0.1)' : '#0d111a',
                        border: isSelected ? `1.5px solid ${th.accentTone}` : '1px solid #1a2234',
                        borderRadius: '8px',
                        padding: '10px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                        <span
                          style={{
                            fontSize: '12px',
                            fontWeight: 700,
                            color: isSelected ? th.accentTone : '#eee',
                            fontFamily: 'var(--font-geist-mono), monospace',
                          }}
                        >
                          {th.name}
                        </span>
                        <span
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: th.accentTone,
                            display: 'inline-block',
                          }}
                        />
                      </div>
                      <div style={{ fontSize: '9px', color: '#778', lineHeight: '1.3' }}>
                        {th.material.toUpperCase()} {'//'} {th.lighting.toUpperCase()}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Selected Theme Specs Box */}
            <div
              style={{
                background: '#07080c',
                border: '1px solid #161c2c',
                borderRadius: '8px',
                padding: '12px',
                fontSize: '11px',
                fontFamily: 'var(--font-geist-mono), monospace',
              }}
            >
              <div style={{ color: selectedTheme.accentTone, fontWeight: 700, marginBottom: '4px' }}>
                {selectedTheme.name}
              </div>
              <p style={{ color: '#889', fontSize: '10px', margin: '0 0 8px 0', lineHeight: '1.4' }}>
                {selectedTheme.description}
              </p>
              <div style={{ display: 'flex', gap: '12px', fontSize: '9px', color: '#556' }}>
                <span>TEXTURE: {selectedTheme.pattern.toUpperCase()}</span>
                <span>LIGHT: {selectedTheme.lighting.toUpperCase()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div
          style={{
            borderTop: '1px solid #161c2c',
            paddingTop: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleCopyLink}
              className="btn-primary"
              style={{
                padding: '8px 14px',
                fontSize: '11px',
                background: '#0d111a',
                border: '1px solid #1c2438',
                color: copiedLink ? '#00ff88' : '#00e5ff',
              }}
            >
              {copiedLink ? '✓ Link Copied' : '🔗 Copy Share URL with Theme'}
            </button>

            <a
              href={`/api/passport-card/${reputation.wallet}?theme=${selectedTheme.id}`}
              download={`provn-card-${selectedTheme.id}-${reputation.wallet.slice(0, 8)}.svg`}
              className="btn-primary"
              style={{
                padding: '8px 14px',
                fontSize: '11px',
                background: '#0d111a',
                border: '1px solid #1c2438',
                color: '#ffb800',
                textDecoration: 'none',
              }}
            >
              🖼️ Download SVG Card
            </a>

            <button
              onClick={handleCopyConfig}
              className="btn-primary"
              style={{
                padding: '8px 14px',
                fontSize: '11px',
                background: '#0d111a',
                border: '1px solid #1c2438',
                color: copiedConfig ? '#00ff88' : '#aaa',
              }}
            >
              {copiedConfig ? '✓ Config Copied' : '📋 Copy JSON Spec'}
            </button>
          </div>

          <button
            onClick={onClose}
            className="btn-primary"
            style={{
              padding: '8px 20px',
              fontSize: '12px',
              fontWeight: 800,
            }}
          >
            Apply Theme
          </button>
        </div>
      </div>
    </div>
  )
}
