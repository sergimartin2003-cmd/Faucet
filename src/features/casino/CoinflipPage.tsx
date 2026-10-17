import { useState, type CSSProperties } from 'react'
import { Button } from '../../ui'
import { payoutFor } from '../../lib/casino'
import { formatPoints } from '../../lib/game'
import { BetInput, GameHeader, GameLayout, InfoRow, Outcome, RecentBets, Segmented } from './components'
import { useCanBet, useInstantGame } from './useInstantGame'

type Side = 'heads' | 'tails'
const LABEL: Record<Side, string> = { heads: 'Cara', tails: 'Cruz' }

export default function CoinflipPage() {
  const [bet, setBet] = useState(10)
  const [side, setSide] = useState<Side>('heads')
  const game = useInstantGame<{ p_bet: number; p_side: Side }, { side: Side }>('play_coinflip', 1250)
  const canBet = useCanBet(bet)
  const landed = game.result?.result.side
  // Whole turns plus half a turn when it lands on tails.
  const end = landed ? `${(landed === 'tails' ? 180 : 0) + 360 * 5}deg` : '0deg'

  return <>
    <GameHeader game="coinflip" description="Elige cara o cruz. Si aciertas, cobras 1,98 veces tu apuesta." />
    <GameLayout
      controls={<>
        <BetInput value={bet} onChange={setBet} disabled={game.busy} />
        <Segmented label="Tu lado" value={side} disabled={game.busy} onChange={setSide}
          options={[{ value: 'heads', label: 'Cara' }, { value: 'tails', label: 'Cruz' }]} />
        <div className="info-grid">
          <InfoRow label="Probabilidad" value="50%" />
          <InfoRow label="Premio si ganas" value={`${formatPoints(payoutFor(bet, 1.98))} pts`} />
        </div>
        <Button variant="primary" size="lg" className="btn-block" loading={game.busy} disabled={!canBet}
          onClick={() => void game.run({ p_bet: bet, p_side: side })}>Lanzar moneda</Button>
      </>}
      stage={<div className="stage-center">
        <div key={game.result?.bet_id ?? 0} className={`coin${landed ? ' is-flipping' : ''}`} style={{ '--end': end, '--turns': 5, transform: landed ? `rotateY(${end})` : undefined } as CSSProperties}>
          <div className="coin-face heads">CARA</div>
          <div className="coin-face tails">CRUZ</div>
        </div>
        {game.revealed && game.result && <>
          <p className="muted">Ha salido <strong>{LABEL[game.result.result.side]}</strong></p>
          <Outcome bet={game.result.bet} payout={game.result.payout} multiplier={Number(game.result.multiplier)} />
        </>}
      </div>}
      below={<RecentBets game="coinflip" />}
    />
  </>
}
