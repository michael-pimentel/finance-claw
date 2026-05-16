import type { PriceData, PriceFetchResult } from '../types'

declare const __FINNHUB_TOKEN__: string

interface FinnhubQuote {
  c: number   // current price
  d: number   // change abs
  dp: number  // change pct
  t: number   // timestamp (unix seconds)
}

async function fetchQuote(ticker: string): Promise<PriceData> {
  const url = `/api/finnhub/quote?symbol=${encodeURIComponent(ticker)}&token=${__FINNHUB_TOKEN__}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Finnhub HTTP ${res.status}`)
  const data = (await res.json()) as FinnhubQuote
  if (data.c === 0 && data.dp === null) throw new Error('ticker not found')
  return {
    ticker,
    price: data.c,
    change_pct: data.dp ?? 0,
    change_abs: data.d ?? 0,
    currency: 'USD',
    timestamp: new Date(data.t * 1000).toISOString(),
  }
}

export async function fetchMarketPrices(tickers: string[]): Promise<PriceFetchResult> {
  const settled = await Promise.allSettled(tickers.map(fetchQuote))
  const prices: PriceData[] = []
  const errors: Array<{ ticker: string; error: string }> = []
  settled.forEach((result, i) => {
    const ticker = tickers[i]!
    if (result.status === 'fulfilled') prices.push(result.value)
    else errors.push({ ticker, error: result.reason instanceof Error ? result.reason.message : String(result.reason) })
  })
  return { prices, errors }
}

export function startMarketPolling(
  tickers: string[],
  onPrices: (prices: PriceData[]) => void,
  onError: (err: Error) => void,
  intervalMs = 30_000,
): () => void {
  let stopped = false
  let timer: ReturnType<typeof setTimeout> | null = null

  const poll = async () => {
    try {
      const result = await fetchMarketPrices(tickers)
      if (!stopped) onPrices(result.prices)
    } catch (err) {
      if (!stopped) onError(err instanceof Error ? err : new Error(String(err)))
    }
    if (!stopped) timer = setTimeout(poll, intervalMs)
  }

  poll()
  return () => {
    stopped = true
    if (timer !== null) clearTimeout(timer)
  }
}
