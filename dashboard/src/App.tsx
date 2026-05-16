import { useState, useEffect, useRef, useCallback } from 'react'
import type { PriceData, MarketSnapshot, StreamEvent, GatewayStatus } from './types'
import { startMarketPolling } from './clients/MarketDataClient'
import { streamAgentQuery } from './clients/AgentClient'
import MarketPanel from './components/MarketPanel'
import EventStream from './components/EventStream'
import QueryInput from './components/QueryInput'

const WATCHLIST = ['NVDA', 'MSFT', 'GOOGL', 'AAPL', 'META']
const SPARKLINE_MAX_POINTS = 24
const AUTO_INSIGHT_THRESHOLD_PCT = 2.5
const AUTO_INSIGHT_COOLDOWN_MS = 20 * 60 * 1000 // 20 min per ticker

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export default function App() {
  const [market, setMarket] = useState<Record<string, MarketSnapshot>>({})
  const [events, setEvents] = useState<StreamEvent[]>([])
  const [isQuerying, setIsQuerying] = useState(false)
  const [gatewayStatus, setGatewayStatus] = useState<GatewayStatus>('connecting')
  const [clock, setClock] = useState(() => new Date())

  // Track which tickers had auto-insights generated recently
  const lastInsightAt = useRef<Record<string, number>>({})
  // Track streaming event content accumulator
  const streamingContent = useRef<Record<string, string>>({})

  // Clock tick
  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const pushEvent = useCallback((event: Omit<StreamEvent, 'id' | 'ts'>) => {
    const full: StreamEvent = { id: makeId(), ts: new Date(), ...event }
    setEvents(prev => [full, ...prev].slice(0, 300))
    return full.id
  }, [])

  const startStreamingEvent = useCallback((kind: StreamEvent['kind'], ticker?: string) => {
    const id = makeId()
    const ev: StreamEvent = { id, ts: new Date(), kind, content: '', streaming: true, ticker }
    setEvents(prev => [ev, ...prev].slice(0, 300))
    streamingContent.current[id] = ''
    return id
  }, [])

  const appendStreamingEvent = useCallback((id: string, chunk: string) => {
    streamingContent.current[id] = (streamingContent.current[id] ?? '') + chunk
    const content = streamingContent.current[id]
    setEvents(prev => prev.map(e => e.id === id ? { ...e, content } : e))
  }, [])

  const finalizeStreamingEvent = useCallback((id: string) => {
    delete streamingContent.current[id]
    setEvents(prev => prev.map(e => e.id === id ? { ...e, streaming: false } : e))
  }, [])

  // Stream a query to the agent and append results into the event stream
  const runAgentStream = useCallback(async (
    queryText: string,
    eventKind: StreamEvent['kind'],
    ticker?: string
  ) => {
    const id = startStreamingEvent(eventKind, ticker)
    let hasContent = false

    for await (const chunk of streamAgentQuery(queryText, 'dashboard-user')) {
      if (chunk.type === 'text') {
        appendStreamingEvent(id, chunk.content)
        hasContent = true
        if (gatewayStatus !== 'live') setGatewayStatus('live')
      } else if (chunk.type === 'error') {
        appendStreamingEvent(id, chunk.message)
        setGatewayStatus('error')
        break
      } else {
        break
      }
    }

    finalizeStreamingEvent(id)
    return hasContent
  }, [gatewayStatus, startStreamingEvent, appendStreamingEvent, finalizeStreamingEvent])

  // Trigger an auto-insight for a moving ticker
  const maybeAutoInsight = useCallback(async (ticker: string, changePct: number, price: number) => {
    const now = Date.now()
    const last = lastInsightAt.current[ticker] ?? 0
    if (now - last < AUTO_INSIGHT_COOLDOWN_MS) return

    lastInsightAt.current[ticker] = now

    const dir = changePct >= 0 ? 'up' : 'down'
    const sign = changePct >= 0 ? '+' : ''

    pushEvent({
      kind: 'alert',
      ticker,
      content: `${ticker} ${sign}${changePct.toFixed(2)}% ($${price.toFixed(2)}) — threshold crossed, requesting analysis`,
    })

    await runAgentStream(
      `${ticker} is ${dir} ${Math.abs(changePct).toFixed(2)}% today, trading at $${price.toFixed(2)}. In 2-3 sentences, what might be driving this move? Be specific and direct.`,
      'agent',
      ticker
    )
  }, [pushEvent, runAgentStream])

  // Handle incoming price batch from the polling client
  const handlePrices = useCallback((prices: PriceData[]) => {
    if (prices.length > 0) setGatewayStatus('live')

    setMarket(prev => {
      const next = { ...prev }
      for (const p of prices) {
        const existing = prev[p.ticker]
        const history = existing
          ? [...existing.history, p.price].slice(-SPARKLINE_MAX_POINTS)
          : [p.price]

        next[p.ticker] = {
          ticker: p.ticker,
          price: p.price,
          change_pct: p.change_pct,
          change_abs: p.change_abs,
          history,
          updatedAt: new Date(),
        }
      }
      return next
    })

    // Auto-insights for significant movers
    for (const p of prices) {
      if (Math.abs(p.change_pct) >= AUTO_INSIGHT_THRESHOLD_PCT) {
        maybeAutoInsight(p.ticker, p.change_pct, p.price)
      }
    }
  }, [maybeAutoInsight])

  // Start market polling on mount
  useEffect(() => {
    pushEvent({ kind: 'system', content: 'Sentinel dashboard connected — polling market data' })

    const stop = startMarketPolling(
      WATCHLIST,
      handlePrices,
      (err) => {
        setGatewayStatus('error')
        pushEvent({ kind: 'error', content: `Market data error: ${err.message}` })
      },
      30_000
    )
    return stop
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // User sends a manual query
  const handleQuery = useCallback(async (text: string) => {
    if (isQuerying) return
    setIsQuerying(true)

    pushEvent({ kind: 'query', content: text })

    await runAgentStream(text, 'agent')
    setIsQuerying(false)
  }, [isQuerying, pushEvent, runAgentStream])

  const fmtTime = clock.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'UTC',
  })

  const fmtDate = clock.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })

  return (
    <div className="workspace">
      <header className="header">
        <div className="header-left">
          <span className="header-logo">◈</span>
          <span className="header-title">SENTINEL</span>
          <span className="header-sub">Financial Agent Workspace</span>
        </div>
        <div className="header-right">
          <span className={`status-dot status-${gatewayStatus}`} />
          <span className="status-label">
            {gatewayStatus === 'live' ? 'LIVE' : gatewayStatus === 'connecting' ? 'CONNECTING' : 'ERROR'}
          </span>
          <span className="header-clock">{fmtDate} · {fmtTime} UTC</span>
        </div>
      </header>

      <div className="body">
        <MarketPanel market={market} watchlist={WATCHLIST} />
        <div className="main">
          <EventStream events={events} />
          <QueryInput onQuery={handleQuery} isQuerying={isQuerying} />
        </div>
      </div>
    </div>
  )
}
