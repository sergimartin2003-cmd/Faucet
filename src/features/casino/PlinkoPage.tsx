import { useEffect, useRef, useState } from 'react'
import { Button } from '../../ui'
import { PLINKO_TABLES, RISK_LABELS, payoutFor, type Risk } from '../../lib/casino'
import { formatPoints } from '../../lib/game'
import { BetInput, GameHeader, GameLayout, InfoRow, Outcome, RecentBets, Segmented } from './components'
import { reducedMotion, useCanBet, useInstantGame } from './useInstantGame'

const W = 600
const STEP_MS = 140

function bucketColor(multiplier: number) {
  if (multiplier >= 10) return '#ff6b76'
  if (multiplier >= 3) return '#ff9f43'
  if (multiplier >= 1.5) return '#ffd166'
  if (multiplier >= 1) return '#7bed9f'
  return '#5cc8ff'
}

function Board({ rows, path }: { rows: number; path: number[] | null }) {
  const gap = W / (rows + 2)
  const height = gap * (rows + 1)
  const instant = reducedMotion()
  const [progress, setProgress] = useState(0)
  const timer = useRef(0)
  const step = path && instant ? path.length : progress

  useEffect(() => {
    if (!path || instant) return
    let current = 0
    timer.current = window.setInterval(() => {
      current++
      setProgress(current)
      if (current >= path.length) window.clearInterval(timer.current)
    }, STEP_MS)
    return () => window.clearInterval(timer.current)
  }, [path, instant])

  // Ball position after `step` rows: x moves half a gap per right turn.
  const ball = path ? (() => {
    const done = Math.min(step, path.length)
    const rights = path.slice(0, done).reduce((sum, value) => sum + value, 0)
    const x = W / 2 + (rights - done / 2) * gap
    return { x, y: gap * 0.5 + done * gap }
  })() : null

  return <svg className="plinko-svg" viewBox={`0 0 ${W} ${height}`} aria-hidden="true">
    {Array.from({ length: rows }, (_, row) => Array.from({ length: row + 3 }, (_, i) => {
      const x = W / 2 + (i - (row + 2) / 2) * gap
      return <circle key={`${row}-${i}`} className="plinko-peg" cx={x} cy={gap + row * gap} r={Math.max(3, gap * 0.08)} />
    }))}
    {ball && <circle className="plinko-ball" cx={ball.x} cy={ball.y} r={Math.max(6, gap * 0.22)} style={{ transition: `cx ${STEP_MS}ms ease-in, cy ${STEP_MS}ms ease-in` }} />}
  </svg>
}

export default function PlinkoPage() {
  const [bet, setBet] = useState(10)
  const [rows, setRows] = useState(12)
  const [risk, setRisk] = useState<Risk>('medium')
  const game = useInstantGame<{ p_bet: number; p_rows: number; p_risk: Risk }, { path: number[]; bucket: number }, { rows: number; risk: Risk }>(
    'play_plinko', (result) => (result.params.rows + 1) * STEP_MS + 150)
  const canBet = useCanBet(bet)
  const shownRows = game.result && game.busy ? game.result.params.rows : rows
  const shownRisk = game.result && game.busy ? game.result.params.risk : risk
  const table = PLINKO_TABLES[shownRows][shownRisk]
  const hit = game.revealed && game.result && game.result.params.rows === shownRows ? game.result.result.bucket : null

  return <>
    <GameHeader game="plinko" description="La bola rebota fila a fila hasta caer en una casilla. Los extremos son raros pero pagan mucho; más filas y más riesgo, premios más extremos." />
    <GameLayout
      controls={<>
        <BetInput value={bet} onChange={setBet} disabled={game.busy} />
        <Segmented label="Riesgo" value={risk} disabled={game.busy} onChange={setRisk}
          options={(['low', 'medium', 'high'] as Risk[]).map((value) => ({ value, label: RISK_LABELS[value] }))} />
        <Segmented label="Filas" value={rows} disabled={game.busy} onChange={setRows} options={[8, 12, 16].map((value) => ({ value, label: String(value) }))} />
        <InfoRow label="Premio máximo" value={`${formatPoints(payoutFor(bet, Math.max(...PLINKO_TABLES[rows][risk])))} pts`} />
        <Button variant="primary" size="lg" className="btn-block" loading={game.busy} disabled={!canBet}
          onClick={() => void game.run({ p_bet: bet, p_rows: rows, p_risk: risk })}>Soltar bola</Button>
      </>}
      stage={<div className="stack">
        <Board key={game.result?.bet_id ?? 0} rows={shownRows} path={game.result && game.result.params.rows === shownRows ? game.result.result.path : null} />
        <div className="plinko-buckets" style={{ gridTemplateColumns: `repeat(${table.length}, minmax(0, 1fr))`, paddingInline: `${100 / (shownRows + 2) / 2}%` }}>
          {table.map((m, i) => <span key={i} className={`plinko-bucket${hit === i ? ' is-hit' : ''}`} style={{ background: bucketColor(m) }}>{m}×</span>)}
        </div>
        <div className="stage-center" style={{ minHeight: 64 }}>
          {game.revealed && game.result && <Outcome bet={game.result.bet} payout={game.result.payout} multiplier={Number(game.result.multiplier)} />}
        </div>
      </div>}
      below={<RecentBets game="plinko" />}
    />
  </>
}
