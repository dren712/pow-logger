'use client'

import React, { useState, useRef, useCallback } from 'react'
import { CardTheme } from '@/app/lib/cardThemes'

export interface MetalCardProps {
  theme: CardTheme
  frontContent: React.ReactNode
  backContent?: React.ReactNode
  isFlipped?: boolean
  onFlipToggle?: () => void
  serialNumber?: string
  width?: string
  aspectRatio?: string
  interactive?: boolean
  className?: string
}

export default function MetalCard({
  theme,
  frontContent,
  backContent,
  isFlipped = false,
  onFlipToggle,
  serialNumber,
  width = '100%',
  aspectRatio = '1.586 / 1', // Standard ISO/IEC 7810 ID-1 credit card ratio (85.60 × 53.98 mm)
  interactive = true,
  className = '',
}: MetalCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [rotateX, setRotateX] = useState(0)
  const [rotateY, setRotateY] = useState(0)
  const [glintPos, setGlintPos] = useState({ x: 50, y: 50, opacity: 0 })
  const [isHovered, setIsHovered] = useState(false)

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!interactive || !cardRef.current) return
      const rect = cardRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const centerX = rect.width / 2
      const centerY = rect.height / 2

      // Maximum 8-degree subtle 3D tilt for physical metal realism
      const rX = ((y - centerY) / centerY) * -7
      const rY = ((x - centerX) / centerX) * 7

      const glintX = (x / rect.width) * 100
      const glintY = (y / rect.height) * 100

      setRotateX(rX)
      setRotateY(rY)
      setGlintPos({ x: glintX, y: glintY, opacity: 0.85 })
    },
    [interactive]
  )

  const handleMouseEnter = () => {
    if (!interactive) return
    setIsHovered(true)
  }

  const handleMouseLeave = () => {
    if (!interactive) return
    setIsHovered(false)
    setRotateX(0)
    setRotateY(0)
    setGlintPos((prev) => ({ ...prev, opacity: 0 }))
  }

  return (
    <div
      style={{
        perspective: '1200px',
        width: width,
        maxWidth: '540px',
        margin: '0 auto',
      }}
      className={className}
    >
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: aspectRatio,
          borderRadius: '16px',
          transformStyle: 'preserve-3d',
          transform: isFlipped
            ? `rotateY(${180 + rotateY}deg) rotateX(${rotateX}deg)`
            : `rotateY(${rotateY}deg) rotateX(${rotateX}deg)`,
          transition: isHovered
            ? 'transform 0.08s ease-out, box-shadow 0.2s ease'
            : 'transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.6s ease',
          boxShadow: isHovered
            ? `0 24px 48px -12px rgba(0, 0, 0, 0.8), 0 0 24px -4px ${theme.specularColor}`
            : '0 16px 32px -10px rgba(0, 0, 0, 0.65)',
          cursor: onFlipToggle ? 'pointer' : 'default',
          userSelect: 'none',
        }}
      >
        {/* ================= FRONT FACE ================= */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            borderRadius: '16px',
            background: theme.surfaceGradient,
            border: `1px solid ${theme.borderTone}`,
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxSizing: 'border-box',
            overflow: 'hidden',
          }}
        >
          {/* Procedural Metallic Grain / Texture Overlay */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              opacity: 0.18,
              backgroundImage: `repeating-linear-gradient(0deg, rgba(255,255,255,0.06), rgba(255,255,255,0.06) 1px, transparent 1px, transparent 3px), repeating-linear-gradient(90deg, rgba(0,0,0,0.15), rgba(0,0,0,0.15) 1px, transparent 1px, transparent 3px)`,
            }}
          />

          {/* Precision Machined Inner Bevel */}
          <div
            style={{
              position: 'absolute',
              inset: '6px',
              border: `1px solid ${theme.innerBorderTone}`,
              borderRadius: '11px',
              pointerEvents: 'none',
            }}
          />

          {/* Corner Rivet / Bolt Accents */}
          <div style={{ position: 'absolute', top: '10px', left: '10px', width: '4px', height: '4px', borderRadius: '50%', background: theme.borderTone, boxShadow: 'inset 0 1px 1px rgba(0,0,0,0.9)' }} />
          <div style={{ position: 'absolute', top: '10px', right: '10px', width: '4px', height: '4px', borderRadius: '50%', background: theme.borderTone, boxShadow: 'inset 0 1px 1px rgba(0,0,0,0.9)' }} />
          <div style={{ position: 'absolute', bottom: '10px', left: '10px', width: '4px', height: '4px', borderRadius: '50%', background: theme.borderTone, boxShadow: 'inset 0 1px 1px rgba(0,0,0,0.9)' }} />
          <div style={{ position: 'absolute', bottom: '10px', right: '10px', width: '4px', height: '4px', borderRadius: '50%', background: theme.borderTone, boxShadow: 'inset 0 1px 1px rgba(0,0,0,0.9)' }} />

          {/* Dynamic Specular Lighting Glint on Mouse Movement */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              background: `radial-gradient(circle 280px at ${glintPos.x}% ${glintPos.y}%, ${theme.specularColor}, transparent 70%)`,
              opacity: glintPos.opacity,
              transition: 'opacity 0.25s ease',
              mixBlendMode: 'screen',
            }}
          />

          {/* Card Front Content */}
          <div style={{ position: 'relative', zIndex: 2, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            {frontContent}
          </div>
        </div>

        {/* ================= BACK FACE ================= */}
        {backContent && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              borderRadius: '16px',
              background: theme.surfaceGradient,
              border: `1px solid ${theme.borderTone}`,
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxSizing: 'border-box',
              overflow: 'hidden',
            }}
          >
            {/* Procedural Grain Overlay */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                opacity: 0.18,
                backgroundImage: `repeating-linear-gradient(0deg, rgba(255,255,255,0.06), rgba(255,255,255,0.06) 1px, transparent 1px, transparent 3px), repeating-linear-gradient(90deg, rgba(0,0,0,0.15), rgba(0,0,0,0.15) 1px, transparent 1px, transparent 3px)`,
              }}
            />

            {/* Inner Bevel */}
            <div
              style={{
                position: 'absolute',
                inset: '6px',
                border: `1px solid ${theme.innerBorderTone}`,
                borderRadius: '11px',
                pointerEvents: 'none',
              }}
            />

            {/* Magnetic Stripe Aesthetic Band */}
            <div
              style={{
                position: 'absolute',
                top: '24px',
                left: 0,
                right: 0,
                height: '36px',
                background: 'linear-gradient(180deg, #050608 0%, #151820 50%, #050608 100%)',
                borderTop: '1px solid rgba(255,255,255,0.08)',
                borderBottom: '1px solid rgba(0,0,0,0.8)',
              }}
            />

            {/* Dynamic Specular Lighting Glint */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                background: `radial-gradient(circle 280px at ${100 - glintPos.x}% ${glintPos.y}%, ${theme.specularColor}, transparent 70%)`,
                opacity: glintPos.opacity,
                transition: 'opacity 0.25s ease',
                mixBlendMode: 'screen',
              }}
            />

            {/* Card Back Content */}
            <div style={{ position: 'relative', zIndex: 2, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', paddingTop: '42px' }}>
              {backContent}
            </div>
          </div>
        )}
      </div>

      {/* Serial & Flip Cue Footer */}
      {serialNumber && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '10px',
            padding: '0 4px',
            fontSize: '10px',
            fontFamily: 'var(--font-geist-mono), monospace',
            color: theme.technicalTextColor,
          }}
        >
          <span>SPEC: {theme.material.toUpperCase()} {'//'} MAT-REV.26</span>
          <span style={{ color: theme.accentTone, fontWeight: 700 }}>{serialNumber}</span>
        </div>
      )}
    </div>
  )
}
