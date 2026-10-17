import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Eraser } from 'lucide-react'
import { Button } from '../../ui'
import { MAX_BET, ROULETTE_WHEEL, rouletteColor, rouletteHits, type RouletteBet, type RouletteKind } from '../../lib/casino'
import { formatPoints } from '../../lib/game'
import { t } from '../../lib/i18n'
import { BetInput, GameHeader, GameLayout, InfoRow, Outcome, RecentBets } from './components'
import { reducedMotion, useInstantGame } from './useInstantGame'
import { useFaucetStatus } from '../faucet/useFaucetStatus'

const CELL = 64
const LAPS = 5

function Strip({ number }: { number: number | null }) {
  const box = useRef<HTMLDivElement>(null)
  const [offset, setOffset] = useState(0)
  const [jitter] = useState(() => Math.round((Math.random() - 0.5) * 30))
  const cells = Array.from({ length: ROULETTE_WHEEL.length * (LAPS + 2) }, (_, i) => ROULETTE_WHEEL[i % ROULETTE_WHEEL.length])
  const animate = !reducedMotion()

  useEffect(() => {
    if (number === null || !box.current) return
    const width = box.current.clientWidth
    const index = LAPS * ROULETTE_WHEEL.length + ROULETTE_WHEEL.indexOf(number)
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setOffset(index * CELL + 4 + 30 + jitter - width / 2)))
    return () => cancelAnimationFrame(id)
  }, [number, jitter])

  return <div className="roulette-strip" ref={box}>
    <span className="roulette-strip-pointer" />
    <div className="roulette-strip-track" style={{ transform: `translateX(${-offset}px)`, transition: animate ? 'transform 3s cubic-bezier(.12,.7,.1,1)' : 'none' }}>
      {cells.map((n, i) => <span key={i} className={`r-cell r-${rouletteColor(n)}`}>{n}</span>)}
    </div>
  </div>
}

type Spot = { kind: RouletteKind; value?: number }
const keyOf = (spot: Spot) => `${spot.kind}:${spot.value ?? ''}`

const OUTSIDE: { spot: Spot; label: () => string; className?: string }[] = [
  { spot: { kind: 'low' }, label: () => '1–18' },
  { spot: { kind: 'even' }, label: () => t('Par') },
  { spot: { kind: 'red' }, label: () => t('Rojo'), className: 'r-red' },
  { spot: { kind: 'black' }, label: () => t('Negro'), className: 'r-black' },
  { spot: { kind: 'odd' }, label: () => t('Impar') },
  { spot: { kind: 'high' }, label: () => '19–36' },
]

export default function RoulettePage() {
  const [chip, setChip] = useState(5)
  const [bets, setBets] = useState<Record<string, RouletteBet>>({})
  const [history, setHistory] = useState<string[]>([])
  const game = useInstantGame<{ p_bets: RouletteBet[] }, { number: number }>('play_roulette', 3300)
  const { points } = useFaucetStatus()
  const total = Object.values(bets).reduce((sum, bet) => sum + bet.amount, 0)
  const result = game.result?.result.number ?? null
  const shownHit = game.revealed ? result : null

  const spin = async () => {
    const next = await game.run({ p_bets: Object.values(bets) })
    if (next) setHistory((old) => [String(next.result.number), ...old].slice(0, 12))
  }

  const place = (spot: Spot) => {
    if (game.busy || total + chip > MAX_BET) return
    const key = keyOf(spot)
    setBets((old) => ({ ...old, [key]: { ...spot, amount: (old[key]?.amount ?? 0) + chip } }))
  }
  const chipOn = (spot: Spot) => bets[keyOf(spot)]?.amount
  const cellClass = (spot: Spot, base: string) => `rb-cell ${base}${shownHit !== null && rouletteHits(spot, shownHit) ? ' is-hit' : ''}`
  const cell = (spot: Spot, label: string, base: string, style?: CSSProperties) =>
    <button key={keyOf(spot)} type="button" className={cellClass(spot, base)} style={style} disabled={game.busy} onClick={() => place(spot)} aria-label={t('Apostar a {spot}', { spot: label })}>
      {label}{chipOn(spot) ? <span className="rb-chip">{chipOn(spot)}</span> : null}
    </button>

  return <>
    <GameHeader game="roulette" description={t('Ruleta europea con un solo cero. Elige el valor de la ficha y colócala en el tablero: pleno 36×, docenas y columnas 3×, colores y mitades 2×.')} />
    <GameLayout
      controls={<>
        <BetInput label={t('Valor de la ficha')} value={chip} onChange={setChip} disabled={game.busy} />
        <div className="info-grid">
          <InfoRow label={t('Apuesta total')} value={t('{points} pts', { points: formatPoints(total) })} />
          <InfoRow label={t('Fichas en mesa')} value={Object.keys(bets).length} />
        </div>
        <div className="row-inline" style={{ gap: 8 }}>
          <Button size="sm" disabled={game.busy || total === 0} onClick={() => setBets({})}><Eraser size={14} />{t('Quitar fichas')}</Button>
          <Button size="sm" variant="ghost" disabled={game.busy || total === 0} onClick={() => setBets((old) => Object.fromEntries(Object.entries(old).map(([k, b]) => [k, { ...b, amount: b.amount * 2 }])))}>{t('2× fichas')}</Button>
        </div>
        <Button variant="primary" size="lg" className="btn-block" loading={game.busy} disabled={total === 0 || points === null || total > points}
          onClick={() => void spin()}>{t('Girar')}</Button>
        {history.length > 0 && <div className="row-inline" style={{ flexWrap: 'wrap', gap: 4 }}>
          {history.map((n, i) => <span key={i} className={`r-cell r-${rouletteColor(Number(n))}`} style={{ width: 30, height: 30, fontSize: 12, borderRadius: 7 }}>{n}</span>)}
        </div>}
      </>}
      stage={<div className="stack">
        <Strip key={game.result?.bet_id ?? 0} number={result} />
        <div className="stage-center" style={{ minHeight: 64 }}>
          {game.revealed && game.result && <Outcome bet={game.result.bet} payout={game.result.payout} multiplier={Number(game.result.multiplier)} label={t('Ha salido el {number}', { number: String(result) })} />}
        </div>
        <div className="roulette-wrap">
          <div>
            <div className="roulette-board">
              {cell({ kind: 'number', value: 0 }, '0', 'r-green', { gridRow: '1 / 4', gridColumn: 1 })}
              {Array.from({ length: 36 }, (_, i) => i + 1).map((n) => {
                const row = 3 - ((n - 1) % 3)
                const col = Math.floor((n - 1) / 3) + 2
                return cell({ kind: 'number', value: n }, String(n), `r-${rouletteColor(n)}`, { gridRow: row, gridColumn: col })
              })}
              {[3, 2, 1].map((column, i) => cell({ kind: 'column', value: column }, '2:1', 'rb-outside', { gridRow: i + 1, gridColumn: 14 }))}
            </div>
            <div className="roulette-dozens">
              {[1, 2, 3].map((dozen) => cell({ kind: 'dozen', value: dozen }, `${(dozen - 1) * 12 + 1}–${dozen * 12}`, 'rb-outside'))}
            </div>
            <div className="roulette-outside">
              {OUTSIDE.map(({ spot, label, className }) => cell(spot, label(), className ?? 'rb-outside'))}
            </div>
          </div>
        </div>
      </div>}
      below={<RecentBets game="roulette" />}
    />
  </>
}
