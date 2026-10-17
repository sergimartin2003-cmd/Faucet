import { useEffect, useRef, useState } from 'react'
import { Button } from '../../ui'
import { formatMultiplier, multiplierChance, payoutFor } from '../../lib/casino'
import { formatPoints } from '../../lib/game'
import { locale, t } from '../../lib/i18n'
import { BetInput, GameHeader, GameLayout, InfoRow, Outcome, RecentBets } from './components'
import { reducedMotion, useCanBet, useInstantGame } from './useInstantGame'

type MultiplierResult = { point: number }

const W = 600
const H = 280
const rate = (point: number) => Math.max(0.45, Math.log(point) / 7)
const flightMs = (point: number) => Math.max(400, (Math.log(point) / rate(point)) * 1000)

function CrashChart({ point, cashout, runId }: { point: number | null; cashout: number; runId: number }) {
  const [elapsed, setElapsed] = useState(0)
  const frame = useRef(0)

  useEffect(() => {
    if (point === null) return
    const total = reducedMotion() ? 0 : flightMs(point)
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(total, now - start)
      setElapsed(t)
      if (t < total) frame.current = requestAnimationFrame(tick)
    }
    frame.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame.current)
  }, [point, runId])

  const k = point === null ? 0.45 : rate(point)
  const total = point === null ? 0 : flightMs(point)
  const done = point !== null && elapsed >= total
  const current = point === null ? 1 : done ? point : Math.min(point, Math.exp((k * elapsed) / 1000))
  const yMax = Math.max(2, current * 1.2, cashout * 1.1)
  const xMax = Math.max(4000, elapsed * 1.15)
  const samples = Array.from({ length: 48 }, (_, i) => (elapsed * i) / 47)
  const toX = (ms: number) => (ms / xMax) * W
  const toY = (m: number) => H - ((m - 1) / (yMax - 1)) * (H - 20)
  const line = samples.map((ms, i) => `${i ? 'L' : 'M'}${toX(ms).toFixed(1)},${toY(Math.min(current, Math.exp((k * ms) / 1000))).toFixed(1)}`).join(' ')
  const crashed = done && point !== null
  const cashedOut = point !== null && current >= cashout && point >= cashout

  return <div style={{ position: 'relative' }}>
    <svg className="crash-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="crash-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--accent)" stopOpacity=".35" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((f) => <line key={f} className="grid-line" x1={0} x2={W} y1={H * f} y2={H * f} />)}
      {cashout < yMax && <line className="crash-cashout-line" x1={0} x2={W} y1={toY(cashout)} y2={toY(cashout)} />}
      {elapsed > 0 && <>
        <path className="area" d={`${line} L${toX(elapsed).toFixed(1)},${H} L0,${H} Z`} />
        <path className={`curve${crashed ? ' is-crashed' : ''}`} d={line} />
      </>}
    </svg>
    <div className="crash-overlay">
      <div>
        <div className={`big-multiplier${crashed ? ' is-loss' : cashedOut ? ' is-win' : ''}`}>{formatMultiplier(Math.floor(current * 100) / 100)}</div>
        {crashed && <p className="muted">{t('¡Ha explotado!')}</p>}
        {!crashed && cashedOut && <p className="text-win">{t('Retirado a {value}', { value: formatMultiplier(cashout) })}</p>}
      </div>
    </div>
  </div>
}

export default function CrashPage() {
  const [bet, setBet] = useState(10)
  const [cashout, setCashout] = useState(2)
  const game = useInstantGame<{ p_bet: number; p_cashout: number }, MultiplierResult, { target: number }>('play_crash', (result) => flightMs(Number(result.result.point)) + 300)
  const canBet = useCanBet(bet)
  const point = game.result ? Number(game.result.result.point) : null
  const playedCashout = game.result ? Number(game.result.params.target) : cashout

  return <>
    <GameHeader game="crash" description={t('El multiplicador sube hasta que explota. Fija tu retirada automática: si el cohete llega a ella antes de explotar, cobras.')} />
    <GameLayout
      controls={<>
        <BetInput value={bet} onChange={setBet} disabled={game.busy} />
        <div className="field">
          <label htmlFor="crash-cashout">{t('Retirada automática')}</label>
          <input id="crash-cashout" className="input mono-num" type="number" min={1.01} max={10000} step={0.01} value={cashout} disabled={game.busy}
            onChange={(event) => setCashout(Math.min(10000, Math.max(1.01, Math.round(Number(event.target.value) * 100) / 100 || 1.01)))} />
        </div>
        <div className="info-grid">
          <InfoRow label={t('Probabilidad')} value={`${multiplierChance(cashout).toLocaleString(locale(), { maximumFractionDigits: 4 })}%`} />
          <InfoRow label={t('Premio si ganas')} value={t('{points} pts', { points: formatPoints(payoutFor(bet, cashout)) })} />
        </div>
        <Button variant="primary" size="lg" className="btn-block" loading={game.busy} disabled={!canBet}
          onClick={() => void game.run({ p_bet: bet, p_cashout: cashout })}>{t('Despegar')}</Button>
      </>}
      stage={<div className="stack">
        <CrashChart point={point} cashout={playedCashout} runId={game.result?.bet_id ?? 0} />
        {game.revealed && game.result && <div className="stage-center"><Outcome bet={game.result.bet} payout={game.result.payout} multiplier={Number(game.result.multiplier)} label={t('Explotó a {value}', { value: formatMultiplier(Number(game.result.result.point)) })} /></div>}
      </div>}
      below={<RecentBets game="crash" />}
    />
  </>
}
