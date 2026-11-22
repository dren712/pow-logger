'use client'

import { useState, useMemo, useEffect, useRef } from 'react'

import { toLocalDateString, PROTOCOL_TIMEZONE } from '@/app/lib/milestones'

interface LogEntry {
  id: number
  created_at: string
  [key: string]: unknown
}

interface ContributionHeatmapProps {
  logs: LogEntry[]
}

interface DayCell {
  dateStr: string
  formattedDate: string
  count: number
  dayOfWeek: number
  monthName: string
  isFirstDayOfMonth: boolean
}

const CELL = 10
const GAP = 3
const COLUMN = CELL + GAP
const LABEL_WIDTH = 32
const MONO = 'var(--font-geist-mono), monospace'
const LEVELS = [
  { bg: '#151a22', border: '#1f2630' },
  { bg: 'rgba(46,229,157,0.22)', border: 'rgba(46,229,157,0.18)' },
  { bg: 'rgba(46,229,157,0.45)', border: 'rgba(46,229,157,0.3)' },
  { bg: 'rgba(46,229,157,0.7)', border: 'rgba(46,229,157,0.5)' },
  { bg: '#2ee59d', border: '#2ee59d' },
]

export default function ContributionHeatmap({ logs }: ContributionHeatmapProps) {
  const [hoveredDay, setHoveredDay] = useState<DayCell | null>(null)
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  // Number of week columns that fit the container; null until measured (renders the full year).
  const [fitWeeks, setFitWeeks] = useState<number | null>(null)

  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const measure = () => setFitWeeks(Math.max(8, Math.floor((el.clientWidth - LABEL_WIDTH) / COLUMN)))
    measure()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const { weeks } = useMemo(() => {
    // Build count map using canonical protocol timezone
    const countMap: Record<string, number> = {}
    logs.forEach((l) => {
      const key = toLocalDateString(l.created_at, PROTOCOL_TIMEZONE)
      if (key !== '1970-01-01') {
        countMap[key] = (countMap[key] || 0) + 1
      }
    })

    // Protocol Day-of-Week helper (Sun=0, Mon=1, ..., Sat=6 in PROTOCOL_TIMEZONE)
    const getProtocolDayOfWeek = (d: Date): number => {
      const dayStr = new Intl.DateTimeFormat('en-US', { timeZone: PROTOCOL_TIMEZONE, weekday: 'short' }).format(d)
      const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
      return map[dayStr] ?? 0
    }

    // Protocol Today string & noon instant (IST)
    const todayProtocolStr = toLocalDateString(new Date(), PROTOCOL_TIMEZONE)
    const todayNoon = new Date(`${todayProtocolStr}T12:00:00.000+05:30`)

    // Compute start date: 364 days ago, aligned to previous Sunday in PROTOCOL_TIMEZONE
    const startInstant = new Date(todayNoon.getTime() - 364 * 86400000)
    while (getProtocolDayOfWeek(startInstant) !== 0) {
      startInstant.setTime(startInstant.getTime() - 86400000)
    }

    const dayCells: DayCell[] = []
    const currInstant = new Date(startInstant.getTime())
    let lastYearMonth = ''

    const monthFormatter = new Intl.DateTimeFormat('en-US', { timeZone: PROTOCOL_TIMEZONE, month: 'short' })
    const yearMonthFormatter = new Intl.DateTimeFormat('en-US', { timeZone: PROTOCOL_TIMEZONE, year: 'numeric', month: '2-digit' })
    const dateFormatter = new Intl.DateTimeFormat('en-US', { timeZone: PROTOCOL_TIMEZONE, month: 'short', day: 'numeric', year: 'numeric' })

    while (toLocalDateString(currInstant, PROTOCOL_TIMEZONE) <= todayProtocolStr) {
      const key = toLocalDateString(currInstant, PROTOCOL_TIMEZONE)
      const monthName = monthFormatter.format(currInstant)
      const yearMonthKey = yearMonthFormatter.format(currInstant)
      const isFirstDayOfMonth = yearMonthKey !== lastYearMonth
      if (isFirstDayOfMonth) lastYearMonth = yearMonthKey

      dayCells.push({
        dateStr: key,
        formattedDate: dateFormatter.format(currInstant),
        count: countMap[key] || 0,
        dayOfWeek: getProtocolDayOfWeek(currInstant),
        monthName,
        isFirstDayOfMonth,
      })

      currInstant.setTime(currInstant.getTime() + 86400000)
    }

    // Group into 7-day week columns
    const weeksArr: DayCell[][] = []
    let currentWeek: DayCell[] = []

    dayCells.forEach((day) => {
      currentWeek.push(day)
      if (currentWeek.length === 7) {
        weeksArr.push(currentWeek)
        currentWeek = []
      }
    })
    if (currentWeek.length > 0) {
      weeksArr.push(currentWeek)
    }

    // Extract month label positions above specific week columns
    const monthLabelsArr: { name: string; colIndex: number }[] = []
    let prevMonth = ''

    weeksArr.forEach((w, wIdx) => {
      const firstDayInWeek = w[0]
      if (firstDayInWeek && firstDayInWeek.monthName !== prevMonth) {
        monthLabelsArr.push({ name: firstDayInWeek.monthName, colIndex: wIdx })
        prevMonth = firstDayInWeek.monthName
      }
    })

    return {
      weeks: weeksArr,
      monthLabels: monthLabelsArr,
    }
  }, [logs])

  const displayedWeeks = useMemo(() => {
    return fitWeeks !== null && fitWeeks < weeks.length ? weeks.slice(-fitWeeks) : weeks
  }, [weeks, fitWeeks])

  const displayedMonthLabels = useMemo(() => {
    const labels: { name: string; colIndex: number }[] = []
    let prevMonth = ''
    displayedWeeks.forEach((w, wIdx) => {
      const firstDayInWeek = w[0]
      if (firstDayInWeek && firstDayInWeek.monthName !== prevMonth) {
        labels.push({ name: firstDayInWeek.monthName, colIndex: wIdx })
        prevMonth = firstDayInWeek.monthName
      }
    })
    return labels
  }, [displayedWeeks])

  const getCellColor = (count: number) => LEVELS[Math.min(count, LEVELS.length - 1)]

  const shownCount = useMemo(
    () => displayedWeeks.reduce((sum, w) => sum + w.reduce((s, d) => s + d.count, 0), 0),
    [displayedWeeks]
  )
  const fullYear = displayedWeeks.length >= weeks.length
  const rangeLabel = fullYear ? 'year' : `${displayedWeeks.length} weeks`

  const handleMouseEnter = (day: DayCell, e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setHoveredDay(day)
    setTooltipPos({
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
    })
  }

  const handleMouseLeave = () => {
    setHoveredDay(null)
    setTooltipPos(null)
  }

  const cellStyle = (level: { bg: string; border: string }): React.CSSProperties => ({
    width: CELL,
    height: CELL,
    borderRadius: 2.5,
    background: level.bg,
    border: `1px solid ${level.border}`,
    flexShrink: 0,
  })

  return (
    <section
      style={{
        position: 'relative',
        width: '100%',
        minWidth: 0,
        background: '#0c0f14',
        border: '1px solid #1c222c',
        borderRadius: 16,
        padding: '18px 20px',
      }}
      aria-label="Proof activity"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <h3 style={{ color: '#e8ecf2', fontSize: 15, fontWeight: 650, margin: 0 }}>
          {shownCount} {shownCount === 1 ? 'proof' : 'proofs'} in the last {rangeLabel}
        </h3>
        <span style={{ color: '#5c6473', fontSize: 12 }}>Days in IST</span>
      </div>

      <div ref={boxRef} style={{ width: '100%', overflow: 'hidden' }}>
        <div
          role="img"
          aria-label={`Activity calendar: ${shownCount} ${shownCount === 1 ? 'proof' : 'proofs'} in the last ${rangeLabel}`}
          style={{ width: LABEL_WIDTH + displayedWeeks.length * COLUMN - GAP, maxWidth: '100%' }}
        >
          {/* Month labels */}
          <div style={{ marginLeft: LABEL_WIDTH, marginBottom: 6, height: 14, position: 'relative' }}>
            {displayedMonthLabels.map((m, i) => {
              const next = displayedMonthLabels[i + 1]
              // Skip a label that would collide with the next one (partial first month).
              if (next && next.colIndex - m.colIndex < 3) return null
              return (
                <span
                  key={`${m.name}-${m.colIndex}`}
                  style={{ position: 'absolute', left: m.colIndex * COLUMN, color: '#8a93a3', fontSize: 10, fontFamily: MONO }}
                >
                  {m.name}
                </span>
              )
            })}
          </div>

          <div style={{ display: 'flex' }}>
            <div
              aria-hidden="true"
              style={{
                display: 'grid',
                gridTemplateRows: `repeat(7, ${CELL}px)`,
                gap: GAP,
                color: '#5c6473',
                fontSize: 9,
                fontFamily: MONO,
                lineHeight: `${CELL}px`,
                width: LABEL_WIDTH,
                flexShrink: 0,
              }}
            >
              <span></span>
              <span>Mon</span>
              <span></span>
              <span>Wed</span>
              <span></span>
              <span>Fri</span>
              <span></span>
            </div>

            <div style={{ display: 'flex', gap: GAP }}>
              {displayedWeeks.map((week, wIdx) => (
                <div key={wIdx} style={{ display: 'flex', flexDirection: 'column', gap: GAP }}>
                  {week.map((day) => (
                    <div
                      key={day.dateStr}
                      onMouseEnter={(e) => handleMouseEnter(day, e)}
                      onMouseLeave={handleMouseLeave}
                      style={cellStyle(getCellColor(day.count))}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 8,
          marginTop: 14,
          fontSize: 11,
          color: '#5c6473',
        }}
      >
        <span>One square per day, brighter means more signed proofs.</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }} aria-hidden="true">
          <span>Less</span>
          {LEVELS.map((l, i) => (
            <div key={i} style={cellStyle(l)} />
          ))}
          <span>More</span>
        </div>
      </div>

      {hoveredDay && tooltipPos && (
        <div
          style={{
            position: 'fixed',
            left: tooltipPos.x,
            top: tooltipPos.y,
            transform: 'translate(-50%, -100%)',
            background: '#1a2029',
            border: '1px solid #2c3442',
            color: '#c3cad6',
            padding: '6px 10px',
            borderRadius: 8,
            fontSize: 12,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            boxShadow: '0 6px 18px rgba(0,0,0,0.45)',
            zIndex: 9999,
          }}
        >
          <strong style={{ color: hoveredDay.count > 0 ? '#2ee59d' : '#e8ecf2', fontWeight: 600 }}>
            {hoveredDay.count === 0 ? 'No' : hoveredDay.count} {hoveredDay.count === 1 ? 'proof' : 'proofs'}
          </strong>{' '}
          on {hoveredDay.formattedDate}
        </div>
      )}
    </section>
  )
}
