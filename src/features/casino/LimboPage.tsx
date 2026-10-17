import { useEffect, useRef, useState } from 'react'
import { Button } from '../../ui'
import { formatMultiplier, multiplierChance, payoutFor } from '../../lib/casino'
import { formatPoints } from '../../lib/game'
import { locale, t } from '../../lib/i18n'
import { BetInput, GameHeader, GameLayout, InfoRow, Outcome, RecentBets } from './components'
import { reducedMotion, useCanBet, useInstantGame } from './useInstantGame'

type MultiplierResult = { point: number }

// Counts the displayed multiplier up to the server's point.
function useCountUp(target: number | null, duration: number) {
  const [value, setValue] = useState<number | null>(null)
  const frame = useRef(0)
  const instant = reducedMotion()
  useEffect(() => {
    if (target === null || instant) return
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - (1 - t) ** 3
      setValue(1 + (target - 1) * eased)
      if (t < 1) frame.current = requestAnimationFrame(tick)
    }
    frame.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame.current)
  }, [target, duration, instant])
  return instant ? target : value
}

export default function LimboPage() {
  const [bet, setBet] = useState(10)
  const [target, setTarget] = useState(2)
  const game = useInstantGame<{ p_bet: number; p_target: number }, MultiplierResult>('play_limbo', 650)
  const canBet = useCanBet(bet)
  const point = game.result ? Number(game.result.result.point) : null
  const shown = useCountUp(point === null ? null : Math.min(point, 10000), 600)

  return <>
    <GameHeader game="limbo" description={t('Fija un multiplicador objetivo. Si el número que sale es igual o mayor, cobras tu apuesta por ese multiplicador.')} />
    <GameLayout
      controls={<>
        <BetInput value={bet} onChange={setBet} disabled={game.busy} />
        <div className="field">
          <label htmlFor="limbo-target">{t('Multiplicador objetivo')}</label>
          <input id="limbo-target" className="input mono-num" type="number" min={1.01} max={10000} step={0.01} value={target} disabled={game.busy}
            onChange={(event) => setTarget(Math.min(10000, Math.max(1.01, Math.round(Number(event.target.value) * 100) / 100 || 1.01)))} />
        </div>
        <div className="info-grid">
          <InfoRow label={t('Probabilidad')} value={`${multiplierChance(target).toLocaleString(locale(), { maximumFractionDigits: 4 })}%`} />
          <InfoRow label={t('Premio si ganas')} value={t('{points} pts', { points: formatPoints(payoutFor(bet, target)) })} />
        </div>
        <Button variant="primary" size="lg" className="btn-block" loading={game.busy} disabled={!canBet}
          onClick={() => void game.run({ p_bet: bet, p_target: target })}>{t('Jugar')}</Button>
      </>}
      stage={<div className="stage-center">
        <div className={`big-multiplier${game.revealed && game.result ? (game.result.payout > 0 ? ' is-win' : ' is-loss') : ''}`}>
          {formatMultiplier(shown === null ? 1 : Math.floor(shown * 100) / 100)}
        </div>
        <p className="muted">{t('Objetivo: {value}', { value: formatMultiplier(target) })}</p>
        {game.revealed && game.result && <Outcome bet={game.result.bet} payout={game.result.payout} multiplier={Number(game.result.multiplier)} />}
      </div>}
      below={<RecentBets game="limbo" />}
    />
  </>
}
