export interface RankCard {
  username: string
  score: number | null
  tier: string
  rank: number | null
  theme?: 'light' | 'dark'
}

function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, ch => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[ch]!)
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '')
}

export function renderRankCard({ username, score, tier, rank, theme = 'dark' }: RankCard): string {
  const light = theme === 'light'
  const bg = light ? '#f8fafc' : '#11151c'
  const fg = light ? '#11151c' : '#e8ecf2'
  const accent = light ? '#087b50' : '#2ee59d'
  const scoreText = score !== null && Number.isFinite(score) ? `${Math.max(0, Math.min(100, Math.round(score)))}/100` : '—'
  const rankText = rank !== null && Number.isInteger(rank) && rank > 0 ? `#${rank}` : 'Unranked'
  const title = escapeXml(`@${username} · ${tier} · ${rankText}`)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="240" viewBox="0 0 480 240" role="img" aria-label="${title}">
<title>${title}</title><rect x="1" y="1" width="478" height="238" rx="18" fill="${bg}" stroke="${accent}"/>
<g font-family="Arial,sans-serif" fill="${fg}"><text x="28" y="40" font-size="13" fill="${accent}">PROVN · VERIFIED BUILDER</text>
<text x="28" y="82" font-size="24">@${escapeXml(username)}</text>
<text x="28" y="137" font-size="36" font-weight="bold">${scoreText}</text>
<text x="28" y="170" font-size="18">${escapeXml(tier)}</text>
<text x="28" y="212" font-size="14">Leaderboard: ${rankText}</text></g></svg>`
}
