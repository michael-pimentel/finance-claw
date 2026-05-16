import type { MarketSnapshot } from '../types'
import Sparkline from './Sparkline'

interface Props {
  market: Record<string, MarketSnapshot>
  watchlist: string[]
}

function fmtPrice(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtPct(n: number) {
  const sign = n >= 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}%`
}

function fmtAbs(n: number) {
  const sign = n >= 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}`
}

function changeClass(pct: number) {
  if (pct > 0.05) return 'up'
  if (pct < -0.05) return 'down'
  return 'flat'
}

function sparklineColor(pct: number) {
  if (pct > 0.05) return 'var(--green)'
  if (pct < -0.05) return 'var(--red)'
  return 'var(--text-dim)'
}

function fmtUpdated(d: Date) {
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'UTC' })
}

export default function MarketPanel({ market, watchlist }: Props) {
  const lastUpdated = Object.values(market)
    .map(s => s.updatedAt)
    .sort((a, b) => b.getTime() - a.getTime())[0]

  return (
    <aside className="market-panel">
      <div className="panel-header">
        WATCHLIST
        <span className="panel-header-badge">{watchlist.length}</span>
      </div>

      <div className="market-list">
        {watchlist.map(sym => {
          const snap = market[sym]
          if (!snap) {
            return (
              <div key={sym} className="ticker-row ticker-loading">
                <div className="ticker-top">
                  <span className="ticker-sym">{sym}</span>
                  <span className="ticker-price">—</span>
                </div>
                <div className="ticker-change">
                  <span className="change-badge flat">—</span>
                </div>
              </div>
            )
          }

          const cls = changeClass(snap.change_pct)
          return (
            <div key={sym} className="ticker-row">
              <div className="ticker-top">
                <span className="ticker-sym">{sym}</span>
                <span className="ticker-price">${fmtPrice(snap.price)}</span>
              </div>
              <div className="ticker-change">
                <span className={`change-badge ${cls}`}>{fmtPct(snap.change_pct)}</span>
                <span className="change-abs">{fmtAbs(snap.change_abs)}</span>
              </div>
              <div className="sparkline-wrap">
                <Sparkline
                  data={snap.history}
                  color={sparklineColor(snap.change_pct)}
                  width={snap.history.length > 1 ? 240 : 88}
                />
              </div>
            </div>
          )
        })}
      </div>

      <div className="market-footer">
        {lastUpdated
          ? `updated ${fmtUpdated(lastUpdated)} UTC`
          : 'awaiting market data…'}
      </div>
    </aside>
  )
}
