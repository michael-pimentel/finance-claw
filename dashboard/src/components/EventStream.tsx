import { useEffect, useRef } from 'react'
import type { StreamEvent, EventKind } from '../types'

interface Props {
  events: StreamEvent[]
}

const BADGE_LABEL: Record<EventKind, string> = {
  market: 'MARKET',
  agent:  'AGENT',
  query:  'QUERY',
  alert:  'ALERT',
  system: 'SYS',
  error:  'ERROR',
}

function fmtTs(d: Date) {
  return d.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'UTC',
  })
}

function EventEntry({ ev }: { ev: StreamEvent }) {
  return (
    <div className="event-entry">
      <span className="event-ts">{fmtTs(ev.ts)}</span>
      <span className={`event-badge badge-${ev.kind}`}>
        {ev.ticker ? ev.ticker : BADGE_LABEL[ev.kind]}
      </span>
      <span className={`event-body${ev.streaming ? ' streaming' : ''}`}>
        {ev.content || (ev.streaming ? '' : '—')}
      </span>
    </div>
  )
}

export default function EventStream({ events }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const userScrolled = useRef(false)

  // Auto-scroll to top (newest entry) only when user hasn't scrolled up
  useEffect(() => {
    if (userScrolled.current) return
    listRef.current?.scrollTo({ top: 0 })
  }, [events])

  const handleScroll = () => {
    const el = listRef.current
    if (!el) return
    // If user scrolled down (past newest entries), mark as scrolled
    userScrolled.current = el.scrollTop > 40
  }

  return (
    <section className="event-stream">
      <div className="event-stream-header">
        AGENT FEED
        <span className="event-stream-count">{events.length}</span>
      </div>

      <div className="event-list" ref={listRef} onScroll={handleScroll}>
        {events.length === 0 ? (
          <div className="event-empty">
            Waiting for agent events… market poll starts in a moment.
          </div>
        ) : (
          events.map(ev => <EventEntry key={ev.id} ev={ev} />)
        )}
        <div ref={bottomRef} />
      </div>
    </section>
  )
}
