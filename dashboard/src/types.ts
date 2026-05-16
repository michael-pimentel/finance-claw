export interface PriceData {
  ticker: string
  price: number
  change_pct: number
  change_abs: number
  currency: string
  timestamp: string
}

export interface PriceFetchResult {
  prices: PriceData[]
  errors: Array<{ ticker: string; error: string }>
}

export type EventKind = 'market' | 'agent' | 'query' | 'alert' | 'system' | 'error'

export interface StreamEvent {
  id: string
  kind: EventKind
  ts: Date
  ticker?: string
  content: string
  streaming?: boolean
}

export interface MarketSnapshot {
  ticker: string
  price: number
  change_pct: number
  change_abs: number
  history: number[]
  updatedAt: Date
}

export type GatewayStatus = 'connecting' | 'live' | 'error'
