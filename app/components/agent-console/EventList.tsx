import type { AgentEvent } from '../../lib/agent/types'
import StatusPill from './StatusPill'
import { eventSummary, seq, type Tone } from './format'

export interface EventFlag {
  tone: Tone
  label: string
}

interface EventListProps {
  events: AgentEvent[]
  selectedIndex: number
  flags: Record<number, EventFlag | undefined>
  onSelect: (index: number) => void
}

export default function EventList({ events, selectedIndex, flags, onSelect }: EventListProps) {
  return (
    <section className="pv-card flex min-w-0 flex-col p-3 sm:p-4" aria-labelledby="ac-events-title">
      <div className="flex items-baseline justify-between gap-3 px-2 pb-3 pt-1">
        <h2 id="ac-events-title" className="pv-h2">
          Events <span className="pv-faint font-normal">({events.length})</span>
        </h2>
        <span className="pv-faint text-[12.5px]">Select an event to inspect it</span>
      </div>
      <ol className="flex max-h-[560px] flex-col gap-1 overflow-y-auto">
        {events.map((ev, idx) => {
          const flag = flags[idx]
          return (
            <li key={ev.eventId}>
              <button
                type="button"
                className={`ac-event ${flag ? `ac-event-${flag.tone}` : ''}`}
                aria-current={selectedIndex === idx ? 'true' : undefined}
                onClick={() => onSelect(idx)}
              >
                <span className="pv-mono pv-faint w-7 flex-none text-[12px]">{seq(ev.sequence)}</span>
                <span className="min-w-0 flex-1">
                  <span className="pv-mono block text-[11.5px] text-[#8a93a3]">{ev.eventType}</span>
                  <span className="block truncate text-[13.5px] text-[#dfe4ec]">{eventSummary(ev)}</span>
                </span>
                {flag ? <StatusPill tone={flag.tone}>{flag.label}</StatusPill> : null}
              </button>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
