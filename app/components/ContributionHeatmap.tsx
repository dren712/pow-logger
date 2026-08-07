'use client'

import { useState, useMemo, useEffect } from 'react'

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

export default function ContributionHeatmap({ logs }: ContributionHeatmapProps) {
  const [hoveredDay, setHoveredDay] = useState<DayCell | null>(null)
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640)
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const { weeks, monthLabels, totalContributions } = useMemo(() => {
    const today = new Date()
    today.setHours(23, 59, 59, 999)

    // Build count map
    const countMap: Record<string, number> = {}
    logs.forEach((l) => {
      const d = new Date(l.created_at)
      if (!isNaN(d.getTime())) {
        const key = d.toISOString().split('T')[0]
        countMap[key] = (countMap[key] || 0) + 1
      }
    })

    // Compute start date: 52 weeks ago, aligned to the previous Sunday (matching GitHub)
    const startDate = new Date(today)
    startDate.setDate(startDate.getDate() - 364)
    // Align to Sunday (day 0)
    while (startDate.getDay() !== 0) {
      startDate.setDate(startDate.getDate() - 1)
    }

    const dayCells: DayCell[] = []
    const currentDate = new Date(startDate)
    let lastMonth = -1

    while (currentDate <= today) {
      const key = currentDate.toISOString().split('T')[0]
      const currentMonth = currentDate.getMonth()
      const isFirstDayOfMonth = currentMonth !== lastMonth
      if (isFirstDayOfMonth) lastMonth = currentMonth

      dayCells.push({
        dateStr: key,
        formattedDate: currentDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
        count: countMap[key] || 0,
        dayOfWeek: currentDate.getDay(),
        monthName: currentDate.toLocaleDateString('en-US', { month: 'short' }),
        isFirstDayOfMonth,
      })

      currentDate.setDate(currentDate.getDate() + 1)
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
      totalContributions: logs.length,
    }
  }, [logs])

  const displayedWeeks = useMemo(() => {
    return isMobile ? weeks.slice(-18) : weeks
  }, [weeks, isMobile])

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

  const getCellColor = (count: number) => {
    if (count === 0) return { bg: '#161b22', border: '#21262d' }
    if (count === 1) return { bg: '#0e4429', border: 'rgba(0,255,136,0.2)' }
    if (count === 2) return { bg: '#006d32', border: 'rgba(0,255,136,0.4)' }
    if (count === 3) return { bg: '#26a641', border: 'rgba(0,255,136,0.6)' }
    return { bg: '#39d353', border: '#00ff88', shadow: '0 0 8px rgba(0,255,136,0.5)' }
  }

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

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* Top Header Summary */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h3
            style={{
              color: '#e6edf3',
              fontSize: '14px',
              fontWeight: 700,
              margin: 0,
              fontFamily: 'var(--font-geist-mono), monospace',
            }}
          >
            {totalContributions} {totalContributions === 1 ? 'contribution' : 'contributions'} in the last {isMobile ? '4 months' : 'year'}
          </h3>
        </div>

        <span
          style={{
            color: '#7d8590',
            fontSize: '11px',
            fontFamily: 'var(--font-geist-mono), monospace',
          }}
        >
          {new Date().getFullYear() - 1}–{new Date().getFullYear()}
        </span>
      </div>

      {/* Main Heatmap Box */}
      <div
        className="heatmap-scroll-container"
        style={{
          background: '#0d1117',
          border: '1px solid #30363d',
          borderRadius: '6px',
          padding: '16px',
          overflowX: 'auto',
          maxWidth: '100%',
        }}
      >
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: isMobile ? 'center' : 'flex-start' }}>
          {/* Month Labels Row */}
          <div style={{ display: 'flex', marginLeft: '32px', marginBottom: '6px', height: '16px', position: 'relative', width: `${displayedWeeks.length * 13}px` }}>
            {displayedMonthLabels.map((m) => (
              <span
                key={`${m.name}-${m.colIndex}`}
                style={{
                  position: 'absolute',
                  left: `${m.colIndex * 13}px`,
                  color: '#7d8590',
                  fontSize: '10px',
                  fontFamily: 'var(--font-geist-mono), monospace',
                  fontWeight: 600,
                }}
              >
                {m.name}
              </span>
            ))}
          </div>

          {/* Grid Container (Day labels on left + week columns) */}
          <div style={{ display: 'flex', gap: '8px' }}>
            {/* Day of Week Labels (Mon, Wed, Fri) */}
            <div
              style={{
                display: 'grid',
                gridTemplateRows: 'repeat(7, 10px)',
                gap: '3px',
                color: '#7d8590',
                fontSize: '9px',
                fontFamily: 'var(--font-geist-mono), monospace',
                lineHeight: '10px',
                width: '24px',
                textAlign: 'right',
                paddingRight: '4px',
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

            {/* Weeks Columns */}
            <div style={{ display: 'flex', gap: '3px' }}>
              {displayedWeeks.map((week, wIdx) => (
                <div key={wIdx} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {week.map((day) => {
                    const colorStyle = getCellColor(day.count)
                    return (
                      <div
                        key={day.dateStr}
                        onMouseEnter={(e) => handleMouseEnter(day, e)}
                        onMouseLeave={handleMouseLeave}
                        style={{
                          width: '10px',
                          height: '10px',
                          borderRadius: '2px',
                          background: colorStyle.bg,
                          border: `1px solid ${colorStyle.border}`,
                          boxShadow: colorStyle.shadow || 'none',
                          cursor: 'pointer',
                          transition: 'transform 0.1s ease',
                        }}
                      />
                    )
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Heatmap Legend */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '12px',
              paddingTop: '8px',
              fontSize: '11px',
              color: '#7d8590',
              fontFamily: 'var(--font-geist-mono), monospace',
              width: '100%',
            }}
          >
            <span style={{ fontSize: '10px', color: '#555' }}>
              Immutable Cryptographic Proofs • Solana &amp; Arweave
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px' }}>
              <span>Less</span>
              <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#161b22', border: '1px solid #21262d' }} />
              <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#0e4429', border: '1px solid rgba(0,255,136,0.2)' }} />
              <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#006d32', border: '1px solid rgba(0,255,136,0.4)' }} />
              <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#26a641', border: '1px solid rgba(0,255,136,0.6)' }} />
              <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#39d353', border: '1px solid #00ff88', boxShadow: '0 0 6px rgba(0,255,136,0.5)' }} />
              <span>More</span>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Interactive Tooltip */}
      {hoveredDay && tooltipPos && (
        <div
          style={{
            position: 'fixed',
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y}px`,
            transform: 'translate(-50%, -100%)',
            background: '#2d333b',
            border: '1px solid #444c56',
            color: '#adbac7',
            padding: '6px 10px',
            borderRadius: '6px',
            fontSize: '11px',
            fontFamily: 'var(--font-geist-mono), monospace',
            fontWeight: 600,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            zIndex: 9999,
          }}
        >
          <span style={{ color: hoveredDay.count > 0 ? '#39d353' : '#7d8590' }}>
            {hoveredDay.count === 0 ? 'No' : hoveredDay.count} {hoveredDay.count === 1 ? 'log' : 'logs'}
          </span>{' '}
          on {hoveredDay.formattedDate}
        </div>
      )}
    </div>
  )
}
