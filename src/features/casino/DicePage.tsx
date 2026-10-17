import { useState } from 'react'
import { Button } from '../../ui'
import { diceMultiplier, formatMultiplier, payoutFor } from '../../lib/casino'
import { formatPoints } from '../../lib/game'
import { locale, t } from '../../lib/i18n'
import { BetInput, GameHeader, GameLayout, InfoRow, Outcome, RecentBets, Segmented } from './components'
import { useCanBet, useInstantGame } from './useInstantGame'

type DiceResult = { roll: number }

export default function DicePage() {
  const [bet, setBet] = useState(10)
  const [target, setTarget] = useState(50)
  const [over, setOver] = useState(true)
  const game = useInstantGame<{ p_bet: number; p_target: number; p_over: boolean }, DiceResult>('play_dice', 700)
  const canBet = useCanBet(bet)

  const chance = over ? 100 - target : target
  const multiplier = diceMultiplier(target, over)
  const roll = game.result ? Number(game.result.result.roll) : null
  const winZone = over
    ? `linear-gradient(90deg, var(--danger) 0 ${target}%, var(--success) ${target}% 100%)`
    : `linear-gradient(90deg, var(--success) 0 ${target}%, var(--danger) ${target}% 100%)`

  const setClampedTarget = (value: number) => setTarget(Math.min(98, Math.max(2, Math.round(value * 100) / 100)))

  return <>
    <GameHeader game="dice" description={t('Sale un número del 0,00 al 100,00. Elige si saldrá por encima o por debajo de tu objetivo: cuanto menos probable, más paga.')} />
    <GameLayout
      controls={<>
        <BetInput value={bet} onChange={setBet} disabled={game.busy} />
        <Segmented label={t('Condición')} value={over ? 'over' : 'under'} disabled={game.busy} onChange={(value) => setOver(value === 'over')}
          options={[{ value: 'under', label: t('Por debajo') }, { value: 'over', label: t('Por encima') }]} />
        <div className="field">
          <label htmlFor="dice-target">{t('Objetivo')}</label>
          <input id="dice-target" className="input mono-num" type="number" min={2} max={98} step={0.01} value={target} disabled={game.busy}
            onChange={(event) => setClampedTarget(Number(event.target.value))} />
        </div>
        <div className="info-grid">
          <InfoRow label={t('Probabilidad')} value={`${chance.toLocaleString(locale(), { maximumFractionDigits: 2 })}%`} />
          <InfoRow label={t('Multiplicador')} value={formatMultiplier(multiplier)} />
          <InfoRow label={t('Premio si ganas')} value={t('{points} pts', { points: formatPoints(payoutFor(bet, multiplier)) })} />
        </div>
        <Button variant="primary" size="lg" className="btn-block" loading={game.busy} disabled={!canBet}
          onClick={() => void game.run({ p_bet: bet, p_target: target, p_over: over })}>{t('Tirar')}</Button>
      </>}
      stage={<div className="stack">
        <div className="stage-center">
          <div className={`dice-result${game.revealed && game.result ? (game.result.win ? ' is-win' : ' is-loss') : ''}`}>
            {roll === null ? '–' : roll.toLocaleString(locale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          {game.revealed && game.result && <Outcome bet={game.result.bet} payout={game.result.payout} multiplier={Number(game.result.multiplier)} />}
        </div>
        <div>
          <div className="dice-track" style={{ background: winZone }}>
            {roll !== null && <span className="dice-marker" style={{ left: `${roll}%` }}>{roll.toFixed(2)}</span>}
          </div>
          <input className="dice-range" type="range" min={2} max={98} step={1} value={target} disabled={game.busy} aria-label={t('Objetivo')}
            onChange={(event) => setClampedTarget(Number(event.target.value))} />
          <div className="dice-scale"><span>0</span><span>25</span><span>50</span><span>75</span><span>100</span></div>
        </div>
      </div>}
      below={<RecentBets game="dice" />}
    />
  </>
}
