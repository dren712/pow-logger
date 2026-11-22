'use client'

import React, { useState } from 'react'
import PassportCard from './PassportCard'
import ModalShell, { CheckIcon } from '../modals-cards/ModalShell'
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

  const themes = Object.values(CARD_THEMES)

  const onOptionKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const dir =
      e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!dir) return
    e.preventDefault()
    const idx = themes.findIndex((t) => t.id === selectedTheme.id)
    const next = themes[(idx + dir + themes.length) % themes.length]
    handleSelectTheme(next)
    document.getElementById(`card-finish-${next.id}`)?.focus()
  }

  return (
    <ModalShell
      title="Card finish"
      description="Choose the material for your passport card. The change applies as you select."
      size="lg"
      onClose={onClose}
      footer={
        <>
          <div className="pvm-footer-start">
            <button type="button" onClick={handleCopyLink} className={`pv-btn-ghost${copiedLink ? ' pvm-ok' : ''}`}>
              {copiedLink ? (
                <>
                  <CheckIcon /> Link copied
                </>
              ) : (
                'Copy share link'
              )}
            </button>
            <button type="button" onClick={handleCopyConfig} className={`pv-btn-ghost${copiedConfig ? ' pvm-ok' : ''}`}>
              {copiedConfig ? (
                <>
                  <CheckIcon /> JSON copied
                </>
              ) : (
                'Copy theme JSON'
              )}
            </button>
          </div>
          <a
            href={`/api/passport-card/${reputation.wallet}?theme=${selectedTheme.id}`}
            download={`provn-card-${selectedTheme.id}-${reputation.wallet.slice(0, 8)}.svg`}
            className="pv-btn-ghost"
          >
            Download SVG
          </a>
          <button type="button" onClick={onClose} className="pv-btn">
            Done
          </button>
        </>
      }
    >
      <div className="pvm-studio">
        <div>
          <div style={{ width: '100%', maxWidth: '440px', margin: '0 auto' }}>
            <PassportCard reputation={reputation} theme={selectedTheme} showControls={true} />
          </div>
          <p className="pv-faint" style={{ margin: '12px 0 0', fontSize: '12px', textAlign: 'center' }}>
            Hover or drag to tilt. Flip the card to see the back.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', minWidth: 0 }}>
          <div>
            <div id="card-finish-label" className="pvm-label" style={{ marginBottom: '10px' }}>
              Finish
            </div>
            <div className="pvm-options" role="radiogroup" aria-labelledby="card-finish-label" onKeyDown={onOptionKeyDown}>
              {themes.map((th) => {
                const isSelected = selectedTheme.id === th.id
                return (
                  <button
                    key={th.id}
                    id={`card-finish-${th.id}`}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    tabIndex={isSelected ? 0 : -1}
                    onClick={() => handleSelectTheme(th)}
                    className="pvm-option"
                  >
                    <span
                      className="pvm-swatch"
                      style={{ background: th.surfaceGradient, ['--swatch-accent' as string]: th.accentTone }}
                      aria-hidden="true"
                    />
                    <span style={{ minWidth: 0 }}>
                      <span className="pvm-option-name" style={{ display: 'block' }}>{th.name}</span>
                      <span className="pvm-option-sub" style={{ display: 'block' }}>{th.material.replace(/_/g, ' ')}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="pvm-note" style={{ display: 'block' }} aria-live="polite">
            <div style={{ fontWeight: 600, color: 'var(--pv-text)' }}>{selectedTheme.name}</div>
            <p style={{ margin: '2px 0 0' }} className="pv-muted">
              {selectedTheme.description}
            </p>
          </div>
        </div>
      </div>
    </ModalShell>
  )
}
