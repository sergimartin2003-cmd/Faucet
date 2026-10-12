import { useEffect, useRef, useState } from 'react'
import {
  CandlestickSeries,
  ColorType,
  createChart,
  type CandlestickData,
  type IChartApi,
  type UTCTimestamp,
} from 'lightweight-charts'
import { ArrowDown, ArrowUp, CandlestickChart, CircleAlert, Clock3, RefreshCw, Search, Wifi, WifiOff } from 'lucide-react'

const API_BASE = 'https://api.binance.com/api/v3'
const QUOTE_FILTERS = ['TODOS', 'USDT', 'USDC', 'BTC', 'ETH', 'FDUSD']
const KNOWN_QUOTES = ['USDT', 'USDC', 'FDUSD', 'TUSD', 'USDP', 'BUSD', 'BTC', 'ETH', 'BNB', 'TRY', 'EUR', 'BRL', 'JPY', 'AUD', 'GBP', 'BIDR', 'IDRT', 'DAI', 'PLN', 'UAH', 'RUB', 'ZAR', 'ARS']
const INTERVALS = ['1m', '5m', '15m', '1h', '4h', '1d', '1w'] as const
type MarketInterval = typeof INTERVALS[number]
type FeedStatus = 'loading' | 'live' | 'polling' | 'error'
type Ticker24h = {
  symbol: string
  lastPrice: string
  priceChangePercent: string
  quoteVolume: string
}
type MarketTicker = {
  symbol: string
  lastPrice: number
  change: number
  quoteVolume: number
}
type Candle = CandlestickData<UTCTimestamp>
type KlineRow = [number, string, string, string, string, string]

const priceFormatter = (value: number) => new Intl.NumberFormat('en-US', {
  minimumFractionDigits: value >= 100 ? 2 : value >= 1 ? 3 : 5,
  maximumFractionDigits: value >= 100 ? 2 : value >= 1 ? 4 : 8,
}).format(value)

const volumeFormatter = (value: number) => new Intl.NumberFormat('en-US', {
  notation: 'compact', maximumFractionDigits: 2,
}).format(value)

function formatPair(symbol: string) {
  const quote = KNOWN_QUOTES.find((asset) => symbol.endsWith(asset))
  return quote ? `${symbol.slice(0, -quote.length)}/${quote}` : symbol
}

function quoteForSymbol(symbol: string) {
  return KNOWN_QUOTES.find((asset) => symbol.endsWith(asset))
}

function toCandles(rows: KlineRow[]): Candle[] {
  return rows.map(([openTime, open, high, low, close]) => ({
    time: Math.floor(openTime / 1000) as UTCTimestamp,
    open: Number(open),
    high: Number(high),
    low: Number(low),
    close: Number(close),
  }))
}

async function fetchCandles(symbol: string, interval: MarketInterval, limit: number, signal?: AbortSignal) {
  const params = new URLSearchParams({ symbol, interval, limit: String(limit) })
  const response = await fetch(`${API_BASE}/klines?${params}`, { signal })
  if (!response.ok) throw new Error(response.status === 429 ? 'Límite de consultas de Binance. Intenta de nuevo en un momento.' : `Binance respondió ${response.status}.`)
  return toCandles(await response.json() as KlineRow[])
}

export default function MarketExplorer({ search }: { search: string }) {
  const [tickers, setTickers] = useState<MarketTicker[]>([])
  const [quoteAsset, setQuoteAsset] = useState('USDT')
  const [selectedSymbol, setSelectedSymbol] = useState('BTCUSDT')
  const [interval, setInterval] = useState<MarketInterval>('1h')
  const [sortBy, setSortBy] = useState<'volume' | 'change' | 'name'>('change')
  const [marketSearch, setMarketSearch] = useState('')
  const [status, setStatus] = useState<FeedStatus>('loading')
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [liveQuote, setLiveQuote] = useState<{ symbol: string; price: number } | null>(null)
  const [marketCount, setMarketCount] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    let firstLoad = true

    const loadTickers = async () => {
      try {
        const response = await fetch(`${API_BASE}/ticker/24hr`, { signal: controller.signal })
        if (!response.ok) throw new Error(response.status === 429 ? 'Límite de consultas de Binance. Intenta en 60 segundos.' : `Binance respondió ${response.status}.`)
        const rows = await response.json() as Ticker24h[]
        const parsed = rows
          .map((ticker) => ({
            symbol: ticker.symbol,
            lastPrice: Number(ticker.lastPrice),
            change: Number(ticker.priceChangePercent),
            quoteVolume: Number(ticker.quoteVolume),
          }))
          .filter((ticker) => Number.isFinite(ticker.lastPrice) && ticker.lastPrice > 0)
        setTickers(parsed)
        setMarketCount(parsed.length)
        setLastUpdated(new Date())
        setError('')
        if (firstLoad) setStatus('live')
        firstLoad = false
      } catch (loadError) {
        if (controller.signal.aborted) return
        setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar los mercados.')
        setStatus('error')
        firstLoad = false
      }
    }

    void loadTickers()
    const timer = window.setInterval(() => void loadTickers(), 30_000)
    return () => {
      controller.abort()
      window.clearInterval(timer)
    }
  }, [reloadToken])

  const filteredMarkets = tickers
    .filter((ticker) => quoteAsset === 'TODOS' || ticker.symbol.endsWith(quoteAsset))
    .filter((ticker) => ticker.symbol.toLowerCase().includes((marketSearch || search).trim().toLowerCase()))
    .sort((first, second) => sortBy === 'change'
      ? second.change - first.change
      : sortBy === 'name'
        ? first.symbol.localeCompare(second.symbol)
        : second.quoteVolume - first.quoteVolume)

  const activeSymbol = filteredMarkets.some((ticker) => ticker.symbol === selectedSymbol)
    ? selectedSymbol
    : filteredMarkets[0]?.symbol ?? selectedSymbol
  const selectedTicker = tickers.find((ticker) => ticker.symbol === activeSymbol)
  const selectedPrice = liveQuote?.symbol === activeSymbol ? liveQuote.price : selectedTicker?.lastPrice
  const biggestMover = filteredMarkets.reduce<MarketTicker | null>((best, ticker) => !best || ticker.change > best.change ? ticker : best, null)

  return (
    <section className="market-page">
      <div className="market-page-heading">
        <div>
          <div className="eyebrow"><span className={status === 'live' ? 'live-dot' : 'market-status-dot'} /> MERCADOS SPOT <span className="live-data-tag">DATOS REALES</span></div>
          <h1>Mercados cripto</h1>
          <p>Precios y velas de mercado en vivo desde Binance Spot.</p>
        </div>
        <div className="market-feed-info">
          <span className={`feed-state feed-${status}`}>{status === 'live' ? <><Wifi size={13} /> En vivo</> : status === 'polling' ? <><RefreshCw size={13} /> Sondeo</> : status === 'error' ? <><WifiOff size={13} /> Sin conexión</> : <><RefreshCw size={13} /> Conectando</>}</span>
          <button className="date-select market-refresh" aria-label="Actualizar mercados" onClick={() => { setStatus('loading'); setReloadToken((token) => token + 1) }}><RefreshCw size={14} />Actualizar</button>
        </div>
      </div>

      <div className="market-stats">
        <div className="market-stat"><span>ACTIVOS DISPONIBLES</span><strong>{marketCount ? marketCount.toLocaleString('en-US') : '—'}</strong><small>pares spot en el exchange</small></div>
        <div className="market-stat"><span>PAR SELECCIONADO</span><strong>{selectedTicker ? formatPair(selectedTicker.symbol) : '—'}</strong><small>{selectedTicker ? `${volumeFormatter(selectedTicker.quoteVolume)} ${quoteForSymbol(selectedTicker.symbol) ?? ''} vol. 24 h` : 'esperando datos'}</small></div>
        <div className="market-stat"><span>MAYOR SUBIDA 24 H</span><strong className="market-positive">{biggestMover ? `+${biggestMover.change.toFixed(2)}%` : '—'}</strong><small>{biggestMover ? formatPair(biggestMover.symbol) : 'esperando datos'}</small></div>
        <div className="market-stat market-stat-source"><span>FUENTE</span><strong>Binance Spot</strong><small>{lastUpdated ? `Actualizado ${lastUpdated.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : 'Esperando cotizaciones'}</small></div>
      </div>

      {error && <div className="market-error" role="alert"><CircleAlert size={16} /><span>{error}</span><button onClick={() => { setStatus('loading'); setReloadToken((token) => token + 1) }}>Reintentar</button></div>}

      <div className="market-workspace">
        <div className="market-chart-panel">
          <div className="market-chart-heading">
            <div className="selected-market-name"><span className="market-coin-mark"><CandlestickChart size={18} /></span><div><strong>{formatPair(activeSymbol)}</strong><small>Spot · {quoteForSymbol(activeSymbol) ?? 'par'}</small></div></div>
            <div className="selected-market-price"><strong>{selectedPrice ? priceFormatter(selectedPrice) : '—'} <small>{quoteForSymbol(activeSymbol) ?? ''}</small></strong><span className={selectedTicker && selectedTicker.change >= 0 ? 'market-positive' : 'market-negative'}>{selectedTicker ? `${selectedTicker.change >= 0 ? '+' : ''}${selectedTicker.change.toFixed(2)}%` : 'Cargando'}</span></div>
          </div>
          <div className="chart-toolbar">
            <div className="interval-tabs" role="group" aria-label="Intervalo de velas">{INTERVALS.map((item) => <button key={item} className={interval === item ? 'interval-active' : ''} onClick={() => setInterval(item)}>{item}</button>)}</div>
            <span className="chart-source"><span /> OHLC · Binance</span>
          </div>
          <LiveCandleChart symbol={activeSymbol} interval={interval} onPrice={(price) => setLiveQuote({ symbol: activeSymbol, price })} onFeedStatus={setStatus} />
          <div className="market-chart-footer"><span><Clock3 size={13} /> Cada vela representa {interval}</span><span>UTC · Datos públicos</span></div>
        </div>

        <aside className="market-list-panel">
          <div className="market-list-heading"><div><span className="section-kicker">SPOT · PARES</span><h2>Todos los mercados</h2></div><span className="market-list-count">{filteredMarkets.length}</span></div>
          <div className="quote-tabs" role="group" aria-label="Moneda de cotización">{QUOTE_FILTERS.map((quote) => <button key={quote} className={quoteAsset === quote ? 'quote-active' : ''} onClick={() => setQuoteAsset(quote)}>{quote === 'TODOS' ? 'Todos' : quote}</button>)}</div>
          <div className="market-list-tools"><label><Search size={14} /><span className="sr-only">Filtrar pares</span><input placeholder="Filtrar pares..." value={marketSearch} onChange={(event) => setMarketSearch(event.target.value)} aria-label="Filtrar pares por símbolo" /></label><button className="market-sort" onClick={() => setSortBy((sort) => sort === 'volume' ? 'change' : sort === 'change' ? 'name' : 'volume')} title="Cambiar orden">{sortBy === 'volume' ? 'Volumen' : sortBy === 'change' ? 'Cambio' : 'Nombre'} <ArrowDown size={12} /></button></div>
          <div className="market-list-columns"><span>PAR</span><span>PRECIO / VOL. 24 H</span><span>24 H</span></div>
          <div className="market-list-scroll">
            {status === 'loading' && !filteredMarkets.length && <div className="market-list-state"><RefreshCw size={16} />Cargando pares spot...</div>}
            {status === 'error' && !filteredMarkets.length && <div className="market-list-state"><WifiOff size={16} />No hay datos disponibles</div>}
            {filteredMarkets.map((ticker) => <button key={ticker.symbol} className={`market-row ${activeSymbol === ticker.symbol ? 'market-row-selected' : ''}`} onClick={() => setSelectedSymbol(ticker.symbol)}>
              <span className="market-pair"><i>{ticker.symbol.slice(0, 1)}</i><strong>{formatPair(ticker.symbol)}</strong></span>
              <span className="market-row-price"><strong>{priceFormatter(ticker.lastPrice)}</strong><small>{volumeFormatter(ticker.quoteVolume)} {quoteForSymbol(ticker.symbol) ?? ''}</small></span>
              <span className={`market-row-change ${ticker.change >= 0 ? 'market-positive' : 'market-negative'}`}>{ticker.change >= 0 ? <ArrowUp size={10} /> : <ArrowDown size={10} />}{Math.abs(ticker.change).toFixed(2)}%</span>
            </button>)}
            {!filteredMarkets.length && status !== 'loading' && status !== 'error' && <div className="market-list-state">No se encontraron pares</div>}
          </div>
          <div className="market-list-foot">Precios en {quoteAsset} · volumen 24 h</div>
        </aside>
      </div>
      <div className="market-disclaimer">Los datos proceden de Binance Spot y pueden retrasarse. No es una recomendación de inversión. Los pares disponibles dependen del mercado y la jurisdicción.</div>
    </section>
  )
}

function LiveCandleChart({ symbol, interval, onPrice, onFeedStatus }: {
  symbol: string
  interval: MarketInterval
  onPrice: (price: number) => void
  onFeedStatus: (status: FeedStatus) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const callbackRef = useRef({ onPrice, onFeedStatus })
  const [chartError, setChartError] = useState('')
  const [chartLoading, setChartLoading] = useState(true)

  useEffect(() => { callbackRef.current = { onPrice, onFeedStatus } }, [onPrice, onFeedStatus])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let chart: IChartApi | undefined
    let socket: WebSocket | undefined
    let fallbackTimer: number | undefined
    let disposed = false
    const controller = new AbortController()
    setChartError('')
    setChartLoading(true)
    callbackRef.current.onFeedStatus('loading')

    const chartHeight = Math.max(container.clientHeight, 320)
    chart = createChart(container, {
      width: container.clientWidth,
      height: chartHeight,
      layout: { background: { type: ColorType.Solid, color: '#142137' }, textColor: '#91a4bf', fontFamily: 'Inter Variable, sans-serif', fontSize: 11 },
      grid: { vertLines: { color: '#b5d1f00b' }, horzLines: { color: '#b5d1f00b' } },
      rightPriceScale: { borderColor: '#2c3e59', scaleMargins: { top: 0.12, bottom: 0.12 } },
      timeScale: { borderColor: '#2c3e59', timeVisible: true, secondsVisible: false, rightOffset: 8 },
      crosshair: { vertLine: { color: '#8eadd177', labelBackgroundColor: '#304765' }, horzLine: { color: '#8eadd177', labelBackgroundColor: '#304765' } },
    })
    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#6eafff', downColor: '#ef9372', borderVisible: false,
      wickUpColor: '#6eafff', wickDownColor: '#ef9372',
    })
    const resizeObserver = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width
      if (width && chart) chart.applyOptions({ width })
    })
    resizeObserver.observe(container)

    const updateLatest = async () => {
      try {
        const recent = await fetchCandles(symbol, interval, 2, controller.signal)
        if (disposed || !recent.length) return
        series.update(recent[recent.length - 1])
        callbackRef.current.onPrice(recent[recent.length - 1].close)
      } catch {
        if (!disposed) callbackRef.current.onFeedStatus('error')
      }
    }

    const connectStream = () => {
      if (disposed) return
      try {
        socket = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@kline_${interval}`)
        socket.onopen = () => callbackRef.current.onFeedStatus('live')
        socket.onmessage = (event) => {
          const payload = JSON.parse(event.data) as { k?: { t: number; o: string; h: string; l: string; c: string } }
          const candle = payload.k
          if (!candle || disposed) return
          const close = Number(candle.c)
          series.update({ time: Math.floor(candle.t / 1000) as UTCTimestamp, open: Number(candle.o), high: Number(candle.h), low: Number(candle.l), close })
          callbackRef.current.onPrice(close)
          callbackRef.current.onFeedStatus('live')
        }
        socket.onerror = () => socket?.close()
        socket.onclose = () => {
          if (disposed) return
          callbackRef.current.onFeedStatus('polling')
          fallbackTimer = window.setInterval(() => void updateLatest(), 15_000)
          void updateLatest()
        }
      } catch {
        callbackRef.current.onFeedStatus('polling')
        fallbackTimer = window.setInterval(() => void updateLatest(), 15_000)
      }
    }

    void fetchCandles(symbol, interval, 300, controller.signal)
      .then((candles) => {
        if (disposed) return
        if (!candles.length) throw new Error('Binance no devolvió velas para este par.')
        series.setData(candles)
        chart?.timeScale().fitContent()
        setChartLoading(false)
        callbackRef.current.onPrice(candles[candles.length - 1].close)
        connectStream()
      })
      .catch((loadError: unknown) => {
        if (disposed) return
        setChartLoading(false)
        setChartError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el gráfico.')
        callbackRef.current.onFeedStatus('error')
      })

    return () => {
      disposed = true
      controller.abort()
      resizeObserver.disconnect()
      if (fallbackTimer) window.clearInterval(fallbackTimer)
      socket?.close()
      chart?.remove()
    }
  }, [symbol, interval])

  return <div className="live-chart-wrap">
    <div ref={containerRef} className="live-candle-chart" aria-label={`Gráfico de velas ${symbol}, intervalo ${interval}`} />
    {chartLoading && <div className="chart-overlay"><RefreshCw size={17} />Cargando velas reales...</div>}
    {chartError && <div className="chart-overlay chart-overlay-error"><CircleAlert size={18} /><strong>No se pudo cargar este gráfico</strong><span>{chartError}</span></div>}
  </div>
}