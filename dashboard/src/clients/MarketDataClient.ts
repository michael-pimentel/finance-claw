import type { PriceData, PriceFetchResult } from '../types'

/**
 * Fetches current prices via the gateway's /tools/invoke endpoint,
 * which calls the finance-tools plugin's fetch_prices tool (Finnhub-backed).
 */
export async function fetchMarketPrices(tickers: string[]): Promise<PriceFetchResult> {
  let response: Response

  try {
    response = await fetch('/api/tools/invoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool: 'fetch_prices',
        args: { tickers },
      }),
    })
  } catch {
    throw new Error('Gateway unreachable')
  }

  if (!response.ok) {
    throw new Error(`fetch_prices failed: HTTP ${response.status}`)
  }

  const raw = (await response.json()) as Record<string, unknown>

  // The plugin returns: { content: [{type:"text", text:"..."}], details: {prices,errors} }
  // The gateway may wrap it differently — handle both shapes defensively
  const inner =
    (raw['details'] as Record<string, unknown> | undefined) ??
    (raw['result'] as Record<string, unknown> | undefined) ??
    raw

  const prices = (inner['prices'] as PriceData[] | undefined) ?? []
  const errors = (inner['errors'] as Array<{ ticker: string; error: string }> | undefined) ?? []

  return { prices, errors }
}

/**
 * Polls fetchMarketPrices on an interval. Returns a cleanup function.
 */
export function startMarketPolling(
  tickers: string[],
  onPrices: (prices: PriceData[]) => void,
  onError: (err: Error) => void,
  intervalMs = 30_000
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
    if (!stopped) {
      timer = setTimeout(poll, intervalMs)
    }
  }

  poll()
  return () => {
    stopped = true
    if (timer !== null) clearTimeout(timer)
  }
}
