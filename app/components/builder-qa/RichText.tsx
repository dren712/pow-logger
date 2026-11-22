import { Fragment } from 'react'

// GitHub text often carries emoji and `:shortcode:` markers that render as
// missing glyphs or raw text. Strip them so descriptions read as plain copy.
export function cleanText(input: string | null | undefined): string {
  if (!input) return ''
  return input
    .replace(/:[a-z0-9_+-]{2,40}:/gi, ' ')
    .replace(/[\p{Extended_Pictographic}\p{Regional_Indicator}\u{FE0F}\u{200D}\u{20E3}\u{1F3FB}-\u{1F3FF}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/^[\s\-–—·|:]+/, '')
    .trim()
}

// Cleaned text with `backtick` spans rendered as inline code.
export default function RichText({ text, codeClassName = 'pv-code' }: { text: string | null | undefined; codeClassName?: string }) {
  const parts = cleanText(text).split(/`([^`]+)`/)
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? <code key={i} className={codeClassName}>{part}</code> : <Fragment key={i}>{part}</Fragment>
      )}
    </>
  )
}
