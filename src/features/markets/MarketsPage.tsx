import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  createChart,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts'
import { ArrowDown, ArrowUp, ChevronsUpDown, Info, RefreshCw, Search, SearchX, WifiOff } from 'lucide-react'
import { Alert, Badge, Button, Card, EmptyState, Skeleton } from '../../ui'
import { useResolvedTheme } from '../../lib/theme'
import './markets.css'

const API_HOSTS = ['https://api.binance.com/api/v3', 'https://data-api.binance.vision/api/v3']
const QUOTES = ['USDT', 'USDC', 'BTC', 'ETH'] as const
type Quote = typeof QUOTES[number]
const INTERVALS = [
  { value: '15m', label: '15 min' },
  { value: '1h', label: '1 h' },
  { value: '4h', label: '4 h' },
  { value: '1d', label: '1 d' },
  { value: '1w', label: '1 sem' },
] as const
type MarketInterval = typeof INTERVALS[number]['value']
type SortKey = 'pair' | 'price' | 'change' | 'volume'
type SortDirection = 'asc' | 'desc'

const TICKER_REFRESH_MS = 30_000
const CANDLE_REFRESH_MS = 20_000
const ROW_LIMIT = 100
const SKELETON_ROWS = 8

type Ticker24h = { symbol: string; lastPrice: string; priceChangePercent: string; quoteVolume: string }
type MarketTicker = { symbol: string; base: string; quote: Quote; price: number; change: number; volume: number }
type KlineRow = [number, string, string, string, string, ...unknown[]]

class MarketsApiError extends Error {}

function describeError(error: unknown, fallback: string) {
  if (error instanceof MarketsApiError) return error.message
  if (error instanceof TypeError) return 'No se pudo conectar con Binance. Revisa tu conexión o inténtalo de nuevo en unos minutos.'
  return fallback
}

async function binanceGet<T>(path: string, signal: AbortSignal): Promise<T> {
  let lastError: unknown
  for (const host of API_HOSTS) {
    try {
      const response = await fetch(`${host}${path}`, { signal })
      if (response.ok) return await response.json() as T
      if (response.status === 429 || response.status === 418) {
        throw new MarketsApiError('Binance limita temporalmente las consultas. Espera un minuto y reintenta.')
      }
      if (response.status === 451) {
        lastError = new MarketsApiError('Binance no está disponible desde tu región.')
        continue
      }
      lastError = new MarketsApiError(`Binance respondió con el error ${response.status}.`)
      if (response.status < 500) throw lastError
    } catch (error) {
      if (signal.aborted || error instanceof MarketsApiError) throw error
      lastError = error
    }
  }
  throw lastError
}

function quoteOf(symbol: string): Quote | undefined {
  return QUOTES.find((quote) => symbol.endsWith(quote) && symbol.length > quote.length)
}

function parseTickers(rows: Ticker24h[]): MarketTicker[] {
  const parsed: MarketTicker[] = []
  for (const row of rows) {
    const quote = quoteOf(row.symbol)
    if (!quote) continue
    const price = Number(row.lastPrice)
    const volume = Number(row.quoteVolume)
    if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(volume) || volume <= 0) continue
    parsed.push({ symbol: row.symbol, base: row.symbol.slice(0, -quote.length), quote, price, change: Number(row.priceChangePercent) || 0, volume })
  }
  return parsed
}

function parseCandles(rows: KlineRow[]): CandlestickData<UTCTimestamp>[] {
  return rows.map(([openTime, open, high, low, close]) => ({
    time: Math.floor(openTime / 1000) as UTCTimestamp,
    open: Number(open), high: Number(high), low: Number(low), close: Number(close),
  }))
}

const priceFormats = new Map<number, Intl.NumberFormat>()
function formatPrice(value: number) {
  const digits = value >= 1000 ? 2 : value >= 1 ? 4 : value >= 0.01 ? 5 : 8
  let format = priceFormats.get(digits)
  if (!format) {
    format = new Intl.NumberFormat('es-ES', { minimumFractionDigits: Math.min(2, digits), maximumFractionDigits: digits, useGrouping: true })
    priceFormats.set(digits, format)
  }
  return format.format(value)
}

const volumeFormat = new Intl.NumberFormat('es-ES', { notation: 'compact', maximumFractionDigits: 2 })
const percentFormat = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const formatVolume = (value: number) => volumeFormat.format(value)
const formatChange = (value: number) => `${value > 0 ? '+' : ''}${percentFormat.format(value)}%`
const changeClass = (value: number) => (value > 0 ? 'mk-up' : value < 0 ? 'mk-down' : 'mk-flat')

function compareTickers(a: MarketTicker, b: MarketTicker, key: SortKey) {
  switch (key) {
    case 'pair': return a.base.localeCompare(b.base)
    case 'price': return a.price - b.price
    case 'change': return a.change - b.change
    default: return a.volume - b.volume
  }
}

export default function MarketsPage() {
  const [tickers, setTickers] = useState<MarketTicker[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)
  const [quote, setQuote] = useState<Quote>('USDT')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({ key: 'volume', direction: 'desc' })
  const [selectedSymbol, setSelectedSymbol] = useState('BTCUSDT')
  const [interval, setInterval] = useState<MarketInterval>('1h')

  useEffect(() => {
    const controller = new AbortController()
    const load = async () => {
      try {
        const rows = await binanceGet<Ticker24h[]>('/ticker/24hr', controller.signal)
        if (controller.signal.aborted) return
        setTickers(parseTickers(rows))
        setLastUpdated(new Date())
        setError(null)
      } catch (loadError) {
        if (controller.signal.aborted) return
        setError(describeError(loadError, 'No se pudieron cargar los mercados.'))
      } finally {
        if (!controller.signal.aborted) setRefreshing(false)
      }
    }
    void load()
    const timer = window.setInterval(() => { if (!document.hidden) void load() }, TICKER_REFRESH_MS)
    return () => {
      controller.abort()
      window.clearInterval(timer)
    }
  }, [reloadToken])

  const retry = () => {
    setRefreshing(true)
    setReloadToken((token) => token + 1)
  }

  const rows = useMemo(() => {
    if (!tickers) return []
    const needle = query.trim().toLowerCase().replace('/', '')
    const direction = sort.direction === 'asc' ? 1 : -1
    return tickers
      .filter((ticker) => ticker.quote === quote && (!needle || ticker.symbol.toLowerCase().includes(needle)))
      .sort((a, b) => compareTickers(a, b, sort.key) * direction)
  }, [tickers, quote, query, sort])

  const visibleRows = rows.slice(0, ROW_LIMIT)
  const selected = tickers?.find((ticker) => ticker.symbol === selectedSymbol)
  const loading = tickers === null && error === null

  const toggleSort = (key: SortKey) => setSort((current) => current.key === key
    ? { key, direction: current.direction === 'desc' ? 'asc' : 'desc' }
    : { key, direction: key === 'pair' ? 'asc' : 'desc' })

  const sortHeader = (key: SortKey, label: string, className: string) => {
    const active = sort.key === key
    const Icon = !active ? ChevronsUpDown : sort.direction === 'asc' ? ArrowUp : ArrowDown
    return <th scope="col" className={className} aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className={`mk-sort${active ? ' mk-sort-active' : ''}`} onClick={() => toggleSort(key)}>{label}<Icon size={12} aria-hidden="true" /></button>
    </th>
  }

  return (
    <div className="mk-page">
      <Card pad={false} className="mk-chart-card">
        <div className="mk-chart-head">
          <div className="mk-selected">
            <div className="mk-selected-name">
              <strong>{selected ? `${selected.base}/${selected.quote}` : formatSymbol(selectedSymbol)}</strong>
              <span className="muted">Spot</span>
            </div>
            {selected
              ? <div className="mk-selected-price">
                <span className="mk-price tnum">{formatPrice(selected.price)} <small>{selected.quote}</small></span>
                <Badge tone={selected.change > 0 ? 'success' : selected.change < 0 ? 'danger' : 'neutral'}>{formatChange(selected.change)} 24 h</Badge>
              </div>
              : loading
                ? <div className="mk-selected-price"><Skeleton width={120} height={26} /><Skeleton width={72} height={22} /></div>
                : <span className="faint">Sin cotización disponible</span>}
          </div>
          <div className="tabs mk-tabs" role="group" aria-label="Intervalo de velas">
            {INTERVALS.map((item) => <button key={item.value} type="button" className="tab" aria-pressed={interval === item.value} onClick={() => setInterval(item.value)}>{item.label}</button>)}
          </div>
        </div>
        <CandleChart symbol={selectedSymbol} interval={interval} />
        <div className="mk-chart-foot">
          <span>Cada vela representa {INTERVALS.find((item) => item.value === interval)?.label}. Hora UTC.</span>
        </div>
      </Card>

      <Card pad={false} className="mk-list-card">
        <div className="mk-toolbar">
          <div className="mk-search">
            <Search size={15} aria-hidden="true" />
            <input className="input" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar par, p. ej. SOL" aria-label="Buscar par por símbolo" autoComplete="off" spellCheck={false} />
          </div>
          <div className="tabs mk-tabs" role="group" aria-label="Moneda de cotización">
            {QUOTES.map((item) => <button key={item} type="button" className="tab" aria-pressed={quote === item} onClick={() => setQuote(item)}>{item}</button>)}
          </div>
          <div className="mk-refresh">
            <span className="faint mk-updated" aria-live="off">{lastUpdated ? `Actualizado ${lastUpdated.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : ''}</span>
            <Button size="sm" variant="secondary" onClick={retry} loading={refreshing} aria-label="Actualizar mercados">{!refreshing && <RefreshCw size={14} aria-hidden="true" />}Actualizar</Button>
          </div>
        </div>

        {error && tickers && <div className="mk-alert"><Alert tone="warning">{error} Se muestran los últimos datos recibidos.</Alert></div>}

        {!tickers && error
          ? <EmptyState
            icon={<WifiOff size={28} aria-hidden="true" />}
            title="No se pudieron cargar los mercados"
            description={error}
            action={<Button size="sm" variant="primary" onClick={retry} loading={refreshing}>Reintentar</Button>} />
          : <div className="table-wrap mk-scroll">
            <table className="table mk-table">
              <caption className="sr-only">Mercados spot de Binance cotizados en {quote}</caption>
              <thead>
                <tr>
                  {sortHeader('pair', 'Par', 'mk-col-pair')}
                  {sortHeader('price', 'Precio', 'num')}
                  {sortHeader('change', '24 h', 'num')}
                  {sortHeader('volume', 'Volumen 24 h', 'num mk-col-volume')}
                </tr>
              </thead>
              <tbody>
                {loading && Array.from({ length: SKELETON_ROWS }, (_, index) => <tr key={index} aria-hidden="true">
                  <td><Skeleton width={86} height={16} /></td>
                  <td className="num"><Skeleton width={80} height={16} style={{ marginLeft: 'auto' }} /></td>
                  <td className="num"><Skeleton width={56} height={16} style={{ marginLeft: 'auto' }} /></td>
                  <td className="num mk-col-volume"><Skeleton width={64} height={16} style={{ marginLeft: 'auto' }} /></td>
                </tr>)}
                {visibleRows.map((ticker) => {
                  const isSelected = ticker.symbol === selectedSymbol
                  return <tr key={ticker.symbol} className="mk-row" data-selected={isSelected} onClick={() => setSelectedSymbol(ticker.symbol)}>
                    <td className="mk-col-pair">
                      <button type="button" className="mk-pair" aria-current={isSelected ? 'true' : undefined} aria-label={`Ver gráfico de ${ticker.base}/${ticker.quote}`} onClick={(event) => { event.stopPropagation(); setSelectedSymbol(ticker.symbol) }}>
                        <span className="mk-base">{ticker.base}</span><span className="mk-quote">/{ticker.quote}</span>
                      </button>
                      <span className="mk-vol-inline tnum">Vol. {formatVolume(ticker.volume)}</span>
                    </td>
                    <td className="num">{formatPrice(ticker.price)}</td>
                    <td className={`num ${changeClass(ticker.change)}`}>{formatChange(ticker.change)}</td>
                    <td className="num mk-col-volume muted">{formatVolume(ticker.volume)} {ticker.quote}</td>
                  </tr>
                })}
              </tbody>
            </table>
            {!loading && !rows.length && <EmptyState icon={<SearchX size={28} aria-hidden="true" />} title="Sin resultados" description={query ? `Ningún par ${quote} coincide con "${query}".` : `No hay pares ${quote} disponibles.`} />}
          </div>}

        {tickers && rows.length > 0 && <div className="mk-list-foot faint">
          {rows.length > ROW_LIMIT ? `Mostrando los ${ROW_LIMIT} primeros de ${rows.length} pares. Usa el buscador para encontrar otros.` : `${rows.length} ${rows.length === 1 ? 'par' : 'pares'}`}
        </div>}
      </Card>

      <p className="mk-note"><Info size={14} aria-hidden="true" />Datos públicos de Binance, solo informativos. No es asesoramiento financiero.</p>
    </div>
  )
}

function formatSymbol(symbol: string) {
  const quote = quoteOf(symbol)
  return quote ? `${symbol.slice(0, -quote.length)}/${quote}` : symbol
}

function readChartColors() {
  const styles = getComputedStyle(document.documentElement)
  const read = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback
  return {
    surface: read('--surface', '#10131a'),
    text: read('--text-muted', '#9aa3b5'),
    border: read('--border', '#232a38'),
    borderStrong: read('--border-strong', '#323b4d'),
    up: read('--success', '#3fb68b'),
    down: read('--danger', '#ef5b61'),
    accent: read('--accent', '#5b8def'),
    font: read('--font', 'system-ui, sans-serif'),
  }
}

function themedOptions() {
  const c = readChartColors()
  return {
    layout: { background: { type: ColorType.Solid, color: c.surface }, textColor: c.text, fontFamily: c.font, fontSize: 12 },
    grid: { vertLines: { color: c.border }, horzLines: { color: c.border } },
    rightPriceScale: { borderColor: c.border },
    timeScale: { borderColor: c.border },
    crosshair: {
      mode: CrosshairMode.Normal,
      vertLine: { color: c.text, labelBackgroundColor: c.accent },
      horzLine: { color: c.text, labelBackgroundColor: c.accent },
    },
  }
}

function themedSeries() {
  const c = readChartColors()
  return { upColor: c.up, downColor: c.down, wickUpColor: c.up, wickDownColor: c.down, borderVisible: false }
}

type ChartState = { key: string; error: string | null }

function CandleChart({ symbol, interval }: { symbol: string; interval: MarketInterval }) {
  const theme = useResolvedTheme()
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const [retryToken, setRetryToken] = useState(0)
  const [state, setState] = useState<ChartState>({ key: '', error: null })
  const key = `${symbol}|${interval}|${retryToken}`

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      ...themedOptions(),
      localization: { locale: 'es-ES' },
      rightPriceScale: { ...themedOptions().rightPriceScale, scaleMargins: { top: 0.1, bottom: 0.1 } },
      timeScale: { ...themedOptions().timeScale, timeVisible: true, secondsVisible: false, rightOffset: 6 },
    })
    chartRef.current = chart
    seriesRef.current = chart.addSeries(CandlestickSeries, themedSeries())
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (rect && rect.width > 0 && rect.height > 0) chart.applyOptions({ width: rect.width, height: rect.height })
    })
    observer.observe(container)
    return () => {
      observer.disconnect()
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
    }
  }, [])

  useEffect(() => {
    chartRef.current?.applyOptions(themedOptions())
    seriesRef.current?.applyOptions(themedSeries())
  }, [theme])

  useEffect(() => {
    const controller = new AbortController()
    let loaded = false
    const load = async () => {
      try {
        const rows = await binanceGet<KlineRow[]>(`/klines?${new URLSearchParams({ symbol, interval, limit: loaded ? '2' : '300' })}`, controller.signal)
        const series = seriesRef.current
        if (controller.signal.aborted || !series) return
        const candles = parseCandles(rows)
        if (!candles.length) throw new MarketsApiError('Binance no devolvió velas para este par.')
        if (loaded) {
          for (const candle of candles) series.update(candle)
        } else {
          series.setData(candles)
          chartRef.current?.timeScale().fitContent()
          loaded = true
          setState({ key, error: null })
        }
      } catch (loadError) {
        if (controller.signal.aborted || loaded) return
        setState({ key, error: describeError(loadError, 'No se pudo cargar el gráfico.') })
      }
    }
    void load()
    const timer = window.setInterval(() => { if (!document.hidden && loaded) void load() }, CANDLE_REFRESH_MS)
    return () => {
      controller.abort()
      window.clearInterval(timer)
    }
  }, [symbol, interval, key])

  const loading = state.key !== key
  const failed = !loading && state.error !== null

  return <div className="mk-chart-wrap">
    <div ref={containerRef} className="mk-chart" role="img" aria-label={`Gráfico de velas de ${formatSymbol(symbol)}, intervalo ${interval}`} />
    {loading && <div className="mk-chart-overlay" role="status" aria-label="Cargando gráfico">
      <div className="mk-chart-skeleton" aria-hidden="true">
        {[52, 70, 44, 82, 60, 90, 48, 66, 76, 40, 58, 72].map((height, index) => <Skeleton key={index} width="100%" height={`${height}%`} />)}
      </div>
    </div>}
    {failed && <div className="mk-chart-overlay">
      <EmptyState
        icon={<WifiOff size={28} aria-hidden="true" />}
        title="No se pudo cargar el gráfico"
        description={state.error ?? undefined}
        action={<Button size="sm" variant="secondary" onClick={() => setRetryToken((token) => token + 1)}>Reintentar</Button>} />
    </div>}
  </div>
}
