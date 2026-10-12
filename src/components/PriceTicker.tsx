import { useQuery } from '@tanstack/react-query'
import { ArrowDown, ArrowUp } from 'lucide-react'

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'LINKUSDT']
const HOSTS = ['https://api.binance.com/api/v3', 'https://data-api.binance.vision/api/v3']

type Row = { symbol: string; lastPrice: string; priceChangePercent: string }

async function fetchTickers(): Promise<Row[]> {
  const query = new URLSearchParams({ symbols: JSON.stringify(SYMBOLS) })
  let lastError: unknown
  for (const host of HOSTS) {
    try {
      const response = await fetch(`${host}/ticker/24hr?${query}`)
      if (response.ok) return (await response.json()) as Row[]
      lastError = new Error(String(response.status))
    } catch (error) {
      lastError = error
    }
  }
  throw lastError
}

const price = new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 })

export default function PriceTicker() {
  const { data } = useQuery({ queryKey: ['price-ticker'], queryFn: fetchTickers, refetchInterval: 60_000, staleTime: 30_000, retry: 0 })
  if (!data || data.length === 0) return null

  const items = data.map((row) => {
    const change = Number(row.priceChangePercent)
    return <span className="ticker-item" key={row.symbol}>
      <b>{row.symbol.replace('USDT', '')}</b>
      <span className="mono-num">{price.format(Number(row.lastPrice))}</span>
      <em className={change >= 0 ? 'up' : 'down'}>{change >= 0 ? <ArrowUp size={11} /> : <ArrowDown size={11} />}{Math.abs(change).toFixed(2)}%</em>
    </span>
  })

  return <div className="ticker" role="region" aria-label="Precios de mercado (Binance, 24 h)">
    <div className="ticker-track">
      <div className="ticker-group">{items}</div>
      <div className="ticker-group" aria-hidden="true">{items}</div>
    </div>
  </div>
}
