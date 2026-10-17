import { useEffect, useRef, useState } from 'react'
import { Button } from '../../ui'
import { WHEEL_TABLES, formatMultiplier, payoutFor, riskLabel, type Risk } from '../../lib/casino'
import { formatPoints } from '../../lib/game'
import { t } from '../../lib/i18n'
import { BetInput, GameHeader, GameLayout, InfoRow, Outcome, RecentBets, Segmented } from './components'
import { useCanBet, useInstantGame } from './useInstantGame'

const SEGMENTS = 20
const SLICE = 360 / SEGMENTS
const R = 150

function colorFor(multiplier: number) {
  if (multiplier === 0) return '#26394a'
  if (multiplier < 1.5) return '#5cc8ff'
  if (multiplier < 2) return '#46dca0'
  if (multiplier < 3) return '#ffd166'
  if (multiplier < 10) return '#ff9f43'
  return '#ff6b76'
}

function slicePath(index: number) {
  const a0 = ((index * SLICE - 90) * Math.PI) / 180
  const a1 = (((index + 1) * SLICE - 90) * Math.PI) / 180
  const p = (a: number, r: number) => `${(R + r * Math.cos(a)).toFixed(2)},${(R + r * Math.sin(a)).toFixed(2)}`
  return `M${p(a0, 52)} L${p(a0, R - 4)} A${R - 4},${R - 4} 0 0 1 ${p(a1, R - 4)} L${p(a1, 52)} A52,52 0 0 0 ${p(a0, 52)} Z`
}

export default function WheelPage() {
  const [bet, setBet] = useState(10)
  const [risk, setRisk] = useState<Risk>('medium')
  const [rotation, setRotation] = useState(0)
  const last = useRef(0)
  const game = useInstantGame<{ p_bet: number; p_risk: Risk }, { segment: number }, { risk: Risk }>('play_wheel', 3300)
  const canBet = useCanBet(bet)
  const shownRisk = game.result && (game.busy || game.revealed) ? game.result.params.risk : risk
  const table = WHEEL_TABLES[shownRisk]
  const legend = [...new Set(table)].sort((a, b) => a - b)

  useEffect(() => {
    if (!game.result) return
    // Land the middle of the winning slice under the pointer, always spinning forward.
    const target = (360 - (game.result.result.segment * SLICE + SLICE / 2)) % 360
    const base = last.current - (last.current % 360) + 360 * 5
    last.current = base + target
    setRotation(last.current)
  }, [game.result])

  return <>
    <GameHeader game="wheel" description={t('Gira la rueda y cobra el multiplicador donde se detenga. Con riesgo alto, casi todo es cero salvo una casilla de 19,8×.')} />
    <GameLayout
      controls={<>
        <BetInput value={bet} onChange={setBet} disabled={game.busy} />
        <Segmented label={t('Riesgo')} value={risk} disabled={game.busy} onChange={setRisk}
          options={(['low', 'medium', 'high'] as Risk[]).map((value) => ({ value, label: riskLabel(value) }))} />
        <InfoRow label={t('Premio máximo')} value={t('{points} pts', { points: formatPoints(payoutFor(bet, Math.max(...WHEEL_TABLES[risk]))) })} />
        <Button variant="primary" size="lg" className="btn-block" loading={game.busy} disabled={!canBet} onClick={() => void game.run({ p_bet: bet, p_risk: risk })}>{t('Girar')}</Button>
      </>}
      stage={<div className="stage-center">
        <div className="wheel-wrap">
          <span className="wheel-pointer" />
          <svg className="wheel-svg" viewBox={`0 0 ${R * 2} ${R * 2}`} style={{ transform: `rotate(${rotation}deg)` }} aria-hidden="true">
            {table.map((m, i) => <path key={i} d={slicePath(i)} fill={colorFor(m)} stroke="var(--bg)" strokeWidth={2} />)}
            <circle cx={R} cy={R} r={48} fill="var(--surface-solid)" stroke="var(--border-strong)" />
          </svg>
        </div>
        <div className="wheel-legend">
          {legend.map((m) => <span key={m}><i style={{ background: colorFor(m) }} />{formatMultiplier(m)} · {table.filter((x) => x === m).length}/20</span>)}
        </div>
        {game.revealed && game.result && <Outcome bet={game.result.bet} payout={game.result.payout} multiplier={Number(game.result.multiplier)} />}
      </div>}
      below={<RecentBets game="wheel" />}
    />
  </>
}
