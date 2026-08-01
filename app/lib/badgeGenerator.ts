export function wrapText(text: string, maxCharsPerLine: number = 55): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let currentLine = ''

  words.forEach((word) => {
    if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
      currentLine = (currentLine + ' ' + word).trim()
    } else {
      if (currentLine) lines.push(currentLine)
      currentLine = word
    }
  })
  if (currentLine) lines.push(currentLine)
  return lines.slice(0, 4) // max 4 lines
}

export function generateNFTBadgeSVG(
  walletAddress: string,
  streak: number,
  logContent?: string,
  category: string = 'Development',
  irysTxId?: string
): string {
  const walletShort =
    walletAddress.length > 8
      ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`
      : walletAddress

  const cleanContent = logContent
    ? logContent.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    : 'Cryptographically verified Proof-of-Work Log on Solana & Arweave'

  const lines = wrapText(cleanContent, 55)
  const txShort = irysTxId ? `${irysTxId.slice(0, 6)}...${irysTxId.slice(-6)}` : 'PERMANENT_DB'

  const textTspans = lines
    .map((line, i) => `<tspan x="56" dy="${i === 0 ? 0 : 20}">${line}</tspan>`)
    .join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="340" viewBox="0 0 600 340" fill="none">
  <!-- Background -->
  <rect width="600" height="340" rx="16" fill="#060709" stroke="#00ff88" stroke-width="2" stroke-opacity="0.3"/>
  <rect x="1" y="1" width="598" height="338" rx="15" fill="url(#bg_grad)"/>
  
  <!-- Cyberpunk Corners -->
  <path d="M 12 24 L 12 12 L 24 12" stroke="#00ff88" stroke-width="3" fill="none"/>
  <path d="M 576 24 L 576 12 L 564 12" stroke="#00ff88" stroke-width="3" fill="none"/>
  <path d="M 12 316 L 12 328 L 24 328" stroke="#00ff88" stroke-width="3" fill="none"/>
  <path d="M 576 316 L 576 328 L 564 328" stroke="#00ff88" stroke-width="3" fill="none"/>

  <!-- Top Header -->
  <text x="36" y="44" fill="#00ff88" font-family="monospace" font-size="16" font-weight="800" letter-spacing="1">PoWL PROTOCOL 🗿</text>
  <text x="564" y="44" fill="#00e5ff" font-family="monospace" font-size="11" text-anchor="end" font-weight="700">VERIFIED cNFT PROOF</text>

  <!-- Divider -->
  <line x1="36" y1="58" x2="564" y2="58" stroke="#1a202c" stroke-width="1"/>

  <!-- Builder & Streak Info -->
  <text x="36" y="90" fill="#888888" font-family="monospace" font-size="11" text-transform="uppercase">BUILDER ATTRIBUTION</text>
  <text x="36" y="114" fill="#ffb800" font-family="monospace" font-size="20" font-weight="800">${walletShort}</text>

  <rect x="420" y="78" width="144" height="46" rx="8" fill="#0c0e12" stroke="#00ff88" stroke-opacity="0.4"/>
  <text x="492" y="96" fill="#888888" font-family="monospace" font-size="9" text-anchor="middle" letter-spacing="1">ACTIVE STREAK</text>
  <text x="492" y="116" fill="#00ff88" font-family="monospace" font-size="16" font-weight="900" text-anchor="middle">🔥 ${streak} DAYS</text>

  <!-- Log Category Badge -->
  <rect x="36" y="138" width="110" height="24" rx="4" fill="rgba(0,255,136,0.1)" stroke="rgba(0,255,136,0.3)"/>
  <text x="91" y="154" fill="#00ff88" font-family="monospace" font-size="11" font-weight="700" text-anchor="middle">${category}</text>

  <!-- Content Box -->
  <rect x="36" y="174" width="528" height="84" rx="8" fill="#0a0c10" stroke="#161b26"/>
  <text x="56" y="202" fill="#e0e0e0" font-family="monospace" font-size="12">${textTspans}</text>

  <!-- Bottom Details -->
  <line x1="36" y1="274" x2="564" y2="274" stroke="#161b26" stroke-width="1"/>
  <text x="36" y="298" fill="#555555" font-family="monospace" font-size="10">CHAIN: Solana Mainnet/Devnet</text>
  <text x="260" y="298" fill="#555555" font-family="monospace" font-size="10">STORAGE: Arweave (Irys)</text>
  <text x="564" y="298" fill="#00e5ff" font-family="monospace" font-size="10" text-anchor="end">TX: ${txShort}</text>

  <defs>
    <radialGradient id="bg_grad" cx="50%" cy="0%" r="80%">
      <stop offset="0%" stop-color="#00ff88" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="#060709" stop-opacity="0"/>
    </radialGradient>
  </defs>
</svg>`
}

export function generateSingleLogNFTBadgeSVG(
  walletAddress: string,
  logId: number | string,
  content: string,
  category: string = 'Development',
  skills: string[] = [],
  dateStr: string = 'Just now',
  irysTxId?: string
): string {
  const walletShort =
    walletAddress.length > 8
      ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`
      : walletAddress

  const cleanContent = content
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

  const lines = wrapText(cleanContent, 60)
  const txShort = irysTxId ? `${irysTxId.slice(0, 8)}...${irysTxId.slice(-6)}` : 'PERMANENT_DB'

  let catColor = '#00ff88'
  let catBg = 'rgba(0,255,136,0.1)'
  let catBorder = 'rgba(0,255,136,0.3)'
  const catLower = category.toLowerCase()
  if (catLower.includes('debug')) {
    catColor = '#ffb800'
    catBg = 'rgba(255,184,0,0.1)'
    catBorder = 'rgba(255,184,0,0.3)'
  } else if (catLower.includes('security') || catLower.includes('auth')) {
    catColor = '#ff4444'
    catBg = 'rgba(255,68,68,0.1)'
    catBorder = 'rgba(255,68,68,0.3)'
  } else if (catLower.includes('research')) {
    catColor = '#00e5ff'
    catBg = 'rgba(0,229,255,0.1)'
    catBorder = 'rgba(0,229,255,0.3)'
  }

  const skillsText = skills.length > 0 ? skills.slice(0, 4).join(' · ') : 'Solana · Irys'

  const textTspans = lines
    .map((line, i) => `<tspan x="56" dy="${i === 0 ? 0 : 22}">${line}</tspan>`)
    .join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="380" viewBox="0 0 640 380" fill="none">
  <!-- Outer Card Frame -->
  <rect width="640" height="380" rx="16" fill="#060709" stroke="${catColor}" stroke-width="2" stroke-opacity="0.4"/>
  <rect x="1" y="1" width="638" height="378" rx="15" fill="url(#log_bg_grad)"/>
  
  <!-- Cyberpunk Accents -->
  <path d="M 14 28 L 14 14 L 28 14" stroke="${catColor}" stroke-width="3" fill="none"/>
  <path d="M 626 28 L 626 14 L 612 14" stroke="${catColor}" stroke-width="3" fill="none"/>
  <path d="M 14 352 L 14 366 L 28 366" stroke="${catColor}" stroke-width="3" fill="none"/>
  <path d="M 626 352 L 626 366 L 612 366" stroke="${catColor}" stroke-width="3" fill="none"/>

  <!-- Top Header Bar -->
  <text x="36" y="44" fill="#00ff88" font-family="monospace" font-size="16" font-weight="900" letter-spacing="1">PoWL PROOF ENTRY #${logId} 🗿</text>
  <text x="604" y="44" fill="#00e5ff" font-family="monospace" font-size="11" text-anchor="end" font-weight="700">Ed25519 VERIFIED cNFT</text>

  <line x1="36" y1="58" x2="604" y2="58" stroke="#1a202c" stroke-width="1"/>

  <!-- Metadata Row -->
  <text x="36" y="88" fill="#888888" font-family="monospace" font-size="10" text-transform="uppercase">BUILDER ATTRIBUTION</text>
  <text x="36" y="110" fill="#ffb800" font-family="monospace" font-size="18" font-weight="800">${walletShort}</text>

  <text x="280" y="88" fill="#888888" font-family="monospace" font-size="10" text-transform="uppercase">TIMESTAMP</text>
  <text x="280" y="110" fill="#cccccc" font-family="monospace" font-size="13" font-weight="600">${dateStr}</text>

  <!-- Category Badge -->
  <rect x="480" y="80" width="124" height="30" rx="6" fill="${catBg}" stroke="${catBorder}"/>
  <text x="542" y="100" fill="${catColor}" font-family="monospace" font-size="11" font-weight="800" text-anchor="middle">${category}</text>

  <!-- Actual Log Content Body -->
  <rect x="36" y="136" width="568" height="150" rx="10" fill="#0a0c10" stroke="#181e2b"/>
  <text x="56" y="168" fill="#f0f3f8" font-family="monospace" font-size="13" font-weight="500">${textTspans}</text>

  <!-- Skills Tags -->
  <text x="56" y="262" fill="#00ff88" font-family="monospace" font-size="11" font-weight="700">TAGS: ${skillsText}</text>

  <!-- Footer Information -->
  <line x1="36" y1="306" x2="604" y2="306" stroke="#161b26" stroke-width="1"/>
  <text x="36" y="336" fill="#666666" font-family="monospace" font-size="10">IMMUTABLE PROOF: Solana &amp; Arweave (Irys)</text>
  <text x="604" y="336" fill="#00e5ff" font-family="monospace" font-size="10" text-anchor="end">PROOF_TX: ${txShort}</text>
  <text x="36" y="356" fill="#444444" font-family="monospace" font-size="9">VERIFY LIVE: pow-logger.vercel.app/u/${walletAddress}</text>

  <defs>
    <radialGradient id="log_bg_grad" cx="50%" cy="0%" r="90%">
      <stop offset="0%" stop-color="${catColor}" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="#060709" stop-opacity="0"/>
    </radialGradient>
  </defs>
</svg>`
}

export function triggerSVGDownload(svgString: string, filename: string) {
  const isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android|Mobile/i.test(navigator.userAgent)

  if (isMobile) {
    // Mobile WebKit / Phantom Browser Fallback
    const encodedSvg = encodeURIComponent(svgString)
    const dataUrl = `data:image/svg+xml;charset=utf-8,${encodedSvg}`
    window.location.href = dataUrl
  } else {
    // Desktop Programmatic Anchor Download
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }
}

export function downloadNFTBadge(
  walletAddress: string,
  streak: number,
  logContent?: string,
  category: string = 'Development',
  irysTxId?: string
) {
  const svgString = generateNFTBadgeSVG(walletAddress, streak, logContent, category, irysTxId)
  triggerSVGDownload(svgString, `PoWL-NFT-Profile-${walletAddress.slice(0, 6)}.svg`)
}

export function downloadSingleLogNFT(
  walletAddress: string,
  logId: number | string,
  content: string,
  category: string = 'Development',
  skills: string[] = [],
  dateStr: string = 'Just now',
  irysTxId?: string
) {
  const svgString = generateSingleLogNFTBadgeSVG(
    walletAddress,
    logId,
    content,
    category,
    skills,
    dateStr,
    irysTxId
  )
  triggerSVGDownload(svgString, `PoWL-Log-${logId}-Proof.svg`)
}
