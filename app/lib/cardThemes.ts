/**
 * PROVN Protocol — Metallic Card Theme & Material Engine
 *
 * Data-driven material system for aerospace-grade digital metal credentials.
 * Zero external textures or paid dependencies. Pure procedural CSS/SVG rendering.
 */

export type MaterialType =
  | 'steel'
  | 'titanium'
  | 'obsidian'
  | 'chrome'
  | 'platinum'
  | 'carbon'
  | 'reactor'
  | 'solar'
  | 'deep_space'
  | 'prototype'
  | 'iridium'

export type PatternType = 'brushed' | 'machined_grid' | 'perforated' | 'crosshatch' | 'raw_matte' | 'circuit'
export type LightingType = 'specular_sharp' | 'diffuse_soft' | 'dual_rim' | 'edge_beam'

export interface CardTheme {
  id: string
  name: string
  material: MaterialType
  description: string
  baseTone: string
  surfaceGradient: string
  borderTone: string
  innerBorderTone: string
  accentTone: string
  highlightTone: string
  engraveTone: string
  specularColor: string
  textColorPrimary: string
  textColorSecondary: string
  technicalTextColor: string
  pattern: PatternType
  lighting: LightingType
  badgeBg: string
  badgeText: string
  rarityColor: string
}

export const CARD_THEMES: Record<string, CardTheme> = {
  steel: {
    id: 'steel',
    name: 'Raw Steel',
    material: 'steel',
    description: 'Industrial brushed cold steel with high-precision engineering bevels.',
    baseTone: '#12141a',
    surfaceGradient:
      'linear-gradient(135deg, #1e222d 0%, #151820 40%, #252a37 70%, #12141b 100%)',
    borderTone: 'rgba(180, 195, 215, 0.35)',
    innerBorderTone: 'rgba(255, 255, 255, 0.08)',
    accentTone: '#00ff88',
    highlightTone: '#ffffff',
    engraveTone: 'rgba(0, 0, 0, 0.85)',
    specularColor: 'rgba(210, 225, 250, 0.3)',
    textColorPrimary: '#f0f4fc',
    textColorSecondary: '#8d98af',
    technicalTextColor: '#5e687e',
    pattern: 'brushed',
    lighting: 'specular_sharp',
    badgeBg: 'rgba(0, 255, 136, 0.12)',
    badgeText: '#00ff88',
    rarityColor: '#b4c3d7',
  },
  titanium: {
    id: 'titanium',
    name: 'Aerospace Titanium',
    material: 'titanium',
    description: 'Ultra-durable micro-machined titanium alloy with controlled ambient sheen.',
    baseTone: '#181b22',
    surfaceGradient:
      'linear-gradient(145deg, #242934 0%, #1a1d26 45%, #2a313f 80%, #171922 100%)',
    borderTone: 'rgba(160, 190, 220, 0.45)',
    innerBorderTone: 'rgba(255, 255, 255, 0.12)',
    accentTone: '#00e5ff',
    highlightTone: '#f5f9ff',
    engraveTone: 'rgba(10, 12, 18, 0.9)',
    specularColor: 'rgba(0, 229, 255, 0.25)',
    textColorPrimary: '#ffffff',
    textColorSecondary: '#94a2b8',
    technicalTextColor: '#64748b',
    pattern: 'machined_grid',
    lighting: 'dual_rim',
    badgeBg: 'rgba(0, 229, 255, 0.12)',
    badgeText: '#00e5ff',
    rarityColor: '#00e5ff',
  },
  obsidian: {
    id: 'obsidian',
    name: 'Black Obsidian',
    material: 'obsidian',
    description: 'Deep non-reflective stealth obsidian metal with razor-sharp micro edges.',
    baseTone: '#08090c',
    surfaceGradient:
      'linear-gradient(150deg, #12141b 0%, #08090c 50%, #151720 85%, #050608 100%)',
    borderTone: 'rgba(255, 255, 255, 0.18)',
    innerBorderTone: 'rgba(255, 255, 255, 0.05)',
    accentTone: '#ffb800',
    highlightTone: '#e2e8f0',
    engraveTone: 'rgba(0, 0, 0, 0.95)',
    specularColor: 'rgba(255, 255, 255, 0.15)',
    textColorPrimary: '#f8fafc',
    textColorSecondary: '#71717a',
    technicalTextColor: '#52525b',
    pattern: 'perforated',
    lighting: 'edge_beam',
    badgeBg: 'rgba(255, 184, 0, 0.12)',
    badgeText: '#ffb800',
    rarityColor: '#ffb800',
  },
  chrome: {
    id: 'chrome',
    name: 'Mirror Chrome',
    material: 'chrome',
    description: 'High-contrast polished chrome with razor specular reflections.',
    baseTone: '#1e2129',
    surfaceGradient:
      'linear-gradient(135deg, #3d4353 0%, #1c1f27 30%, #50586d 60%, #181a21 100%)',
    borderTone: 'rgba(240, 248, 255, 0.65)',
    innerBorderTone: 'rgba(255, 255, 255, 0.25)',
    accentTone: '#ffffff',
    highlightTone: '#ffffff',
    engraveTone: 'rgba(15, 18, 24, 0.95)',
    specularColor: 'rgba(255, 255, 255, 0.45)',
    textColorPrimary: '#ffffff',
    textColorSecondary: '#cbd5e1',
    technicalTextColor: '#94a3b8',
    pattern: 'brushed',
    lighting: 'specular_sharp',
    badgeBg: 'rgba(255, 255, 255, 0.15)',
    badgeText: '#ffffff',
    rarityColor: '#ffffff',
  },
  platinum: {
    id: 'platinum',
    name: 'Noble Platinum',
    material: 'platinum',
    description: 'Prestige noble platinum with ultra-clean grain and high-depth shadows.',
    baseTone: '#161922',
    surfaceGradient:
      'linear-gradient(140deg, #2a303f 0%, #181b24 50%, #343c4e 80%, #14161f 100%)',
    borderTone: 'rgba(220, 235, 255, 0.5)',
    innerBorderTone: 'rgba(255, 255, 255, 0.15)',
    accentTone: '#a78bfa',
    highlightTone: '#f1f5f9',
    engraveTone: 'rgba(12, 14, 20, 0.9)',
    specularColor: 'rgba(167, 139, 250, 0.25)',
    textColorPrimary: '#f8fafc',
    textColorSecondary: '#94a3b8',
    technicalTextColor: '#64748b',
    pattern: 'crosshatch',
    lighting: 'diffuse_soft',
    badgeBg: 'rgba(167, 139, 250, 0.12)',
    badgeText: '#a78bfa',
    rarityColor: '#a78bfa',
  },
  carbon: {
    id: 'carbon',
    name: 'Forged Carbon',
    material: 'carbon',
    description: 'Motorsport-grade forged carbon fiber matrix with matte satin finish.',
    baseTone: '#0d0e12',
    surfaceGradient:
      'linear-gradient(135deg, #171920 0%, #0d0e12 50%, #1e2029 80%, #0a0b0e 100%)',
    borderTone: 'rgba(100, 110, 130, 0.35)',
    innerBorderTone: 'rgba(255, 255, 255, 0.05)',
    accentTone: '#f43f5e',
    highlightTone: '#e2e8f0',
    engraveTone: 'rgba(0, 0, 0, 0.95)',
    specularColor: 'rgba(244, 63, 94, 0.2)',
    textColorPrimary: '#f1f5f9',
    textColorSecondary: '#71717a',
    technicalTextColor: '#52525b',
    pattern: 'perforated',
    lighting: 'edge_beam',
    badgeBg: 'rgba(244, 63, 94, 0.12)',
    badgeText: '#f43f5e',
    rarityColor: '#f43f5e',
  },
  reactor: {
    id: 'reactor',
    name: 'Sub-Zero Reactor',
    material: 'reactor',
    description: 'Dark tactical hardware with cryo-luminescent instrumentation channels.',
    baseTone: '#0a1017',
    surfaceGradient:
      'linear-gradient(145deg, #101c2b 0%, #091119 50%, #15263a 85%, #060b10 100%)',
    borderTone: 'rgba(0, 229, 255, 0.4)',
    innerBorderTone: 'rgba(0, 229, 255, 0.1)',
    accentTone: '#00e5ff',
    highlightTone: '#e0f7fa',
    engraveTone: 'rgba(3, 8, 14, 0.95)',
    specularColor: 'rgba(0, 229, 255, 0.35)',
    textColorPrimary: '#e0f7fa',
    textColorSecondary: '#78909c',
    technicalTextColor: '#455a64',
    pattern: 'circuit',
    lighting: 'dual_rim',
    badgeBg: 'rgba(0, 229, 255, 0.12)',
    badgeText: '#00e5ff',
    rarityColor: '#00e5ff',
  },
  solar: {
    id: 'solar',
    name: 'Solar Forge',
    material: 'solar',
    description: 'Heavy brushed brass & tempered gold alloy with warm specular highlights.',
    baseTone: '#16130b',
    surfaceGradient:
      'linear-gradient(140deg, #2e2413 0%, #15120a 50%, #3d3018 85%, #100e07 100%)',
    borderTone: 'rgba(255, 190, 60, 0.45)',
    innerBorderTone: 'rgba(255, 215, 100, 0.15)',
    accentTone: '#fbbf24',
    highlightTone: '#fef3c7',
    engraveTone: 'rgba(15, 11, 4, 0.95)',
    specularColor: 'rgba(251, 191, 36, 0.3)',
    textColorPrimary: '#fffbeb',
    textColorSecondary: '#a89d84',
    technicalTextColor: '#786f5c',
    pattern: 'brushed',
    lighting: 'specular_sharp',
    badgeBg: 'rgba(251, 191, 36, 0.12)',
    badgeText: '#fbbf24',
    rarityColor: '#fbbf24',
  },
  deep_space: {
    id: 'deep_space',
    name: 'Deep Space Orbital',
    material: 'deep_space',
    description: 'Astronautics satellite hull composite with dark indigo telemetry markings.',
    baseTone: '#0c0e18',
    surfaceGradient:
      'linear-gradient(145deg, #181d33 0%, #0b0d18 50%, #1f2746 85%, #080912 100%)',
    borderTone: 'rgba(129, 140, 248, 0.4)',
    innerBorderTone: 'rgba(129, 140, 248, 0.1)',
    accentTone: '#818cf8',
    highlightTone: '#e0e7ff',
    engraveTone: 'rgba(5, 7, 15, 0.95)',
    specularColor: 'rgba(129, 140, 248, 0.3)',
    textColorPrimary: '#f5f7ff',
    textColorSecondary: '#8a94b8',
    technicalTextColor: '#5b6589',
    pattern: 'machined_grid',
    lighting: 'dual_rim',
    badgeBg: 'rgba(129, 140, 248, 0.12)',
    badgeText: '#818cf8',
    rarityColor: '#818cf8',
  },
  prototype: {
    id: 'prototype',
    name: 'Hardware Prototype',
    material: 'prototype',
    description: 'Experimental unmachined foundry billet with raw serial engravings.',
    baseTone: '#15171a',
    surfaceGradient:
      'linear-gradient(135deg, #22252a 0%, #141519 45%, #2a2e35 80%, #101215 100%)',
    borderTone: 'rgba(255, 100, 40, 0.45)',
    innerBorderTone: 'rgba(255, 255, 255, 0.08)',
    accentTone: '#ff6600',
    highlightTone: '#ffffff',
    engraveTone: 'rgba(0, 0, 0, 0.9)',
    specularColor: 'rgba(255, 102, 0, 0.25)',
    textColorPrimary: '#ffffff',
    textColorSecondary: '#9aa0ac',
    technicalTextColor: '#6b7280',
    pattern: 'raw_matte',
    lighting: 'edge_beam',
    badgeBg: 'rgba(255, 102, 0, 0.12)',
    badgeText: '#ff6600',
    rarityColor: '#ff6600',
  },
}

export const DEFAULT_CARD_THEME: CardTheme = CARD_THEMES.steel

export function getCardTheme(themeId?: string): CardTheme {
  if (!themeId) return DEFAULT_CARD_THEME
  return CARD_THEMES[themeId] || DEFAULT_CARD_THEME
}
