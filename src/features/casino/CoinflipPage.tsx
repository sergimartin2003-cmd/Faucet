import { useState, type CSSProperties } from 'react'
import { Button } from '../../ui'
import { payoutFor } from '../../lib/casino'
import { formatPoints } from '../../lib/game'
import { t } from '../../lib/i18n'
import { BetInput, GameHeader, GameLayout, InfoRow, Outcome, RecentBets, Segmented } from './components'
import { useCanBet, useInstantGame } from './useInstantGame'

type Side = 'heads' | 'tails'
const sideLabel = (side: Side) => (side === 'heads' ? t('Cara') : t('Cruz'))

export default function CoinflipPage() {
  const [bet, setBet] = useState(10)
  const [side, setSide] = useState<Side>('heads')
  const game = useInstantGame<{ p_bet: number; p_side: Side }, { side: Side }>('play_coinflip', 1250)
  const canBet = useCanBet(bet)
  const landed = game.result?.result.side
  // Whole turns plus half a turn when it lands on tails.
  const end = landed ? `${(landed === 'tails' ? 180 : 0) + 360 * 5}deg` : '0deg'

  return <>
    <GameHeader game="coinflip" description={t('Elige cara o cruz. Si aciertas, cobras 1,98 veces tu apuesta.')} />
    <GameLayout
      controls={<>
        <BetInput value={bet} onChange={setBet} disabled={game.busy} />
        <Segmented label={t('Tu lado')} value={side} disabled={game.busy} onChange={setSide}
          options={[{ value: 'heads', label: sideLabel('heads') }, { value: 'tails', label: sideLabel('tails') }]} />
        <div className="info-grid">
          <InfoRow label={t('Probabilidad')} value="50%" />
          <InfoRow label={t('Premio si ganas')} value={t('{points} pts', { points: formatPoints(payoutFor(bet, 1.98)) })} />
        </div>
        <Button variant="primary" size="lg" className="btn-block" loading={game.busy} disabled={!canBet}
          onClick={() => void game.run({ p_bet: bet, p_side: side })}>{t('Lanzar moneda')}</Button>
      </>}
      stage={<div className="stage-center">
        <div key={game.result?.bet_id ?? 0} className={`coin${landed ? ' is-flipping' : ''}`} style={{ '--end': end, '--turns': 5, transform: landed ? `rotateY(${end})` : undefined } as CSSProperties}>
          <div className="coin-face heads">{t('CARA')}</div>
          <div className="coin-face tails">{t('CRUZ')}</div>
        </div>
        {game.revealed && game.result && <>
          <p className="muted">{t('Ha salido')} <strong>{sideLabel(game.result.result.side)}</strong></p>
          <Outcome bet={game.result.bet} payout={game.result.payout} multiplier={Number(game.result.multiplier)} />
        </>}
      </div>}
      below={<RecentBets game="coinflip" />}
    />
  </>
}
