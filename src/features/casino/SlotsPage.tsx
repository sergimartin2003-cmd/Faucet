import { useEffect, useState } from 'react'
import { Button } from '../../ui'
import { SLOT_ICONS, SLOT_SYMBOLS, payoutFor, slotSymbol, type SlotSymbol } from '../../lib/casino'
import { formatPoints } from '../../lib/game'
import { BetInput, GameHeader, GameLayout, InfoRow, Outcome, RecentBets } from './components'
import { reducedMotion, useCanBet, useInstantGame } from './useInstantGame'

const SPIN_CELLS = 24
const SYMBOL_HEIGHT = 150

function Reel({ symbol, delay, win }: { symbol: SlotSymbol | null; delay: number; win: boolean }) {
  const [strip] = useState<SlotSymbol[]>(() => symbol === null ? ['seven'] : [...Array.from({ length: SPIN_CELLS }, () => slotSymbol(Math.random())), symbol])
  const [offset, setOffset] = useState(0)
  const animate = !reducedMotion()

  useEffect(() => {
    if (symbol === null) return
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setOffset(SPIN_CELLS * SYMBOL_HEIGHT)))
    return () => cancelAnimationFrame(id)
  }, [symbol])

  return <div className={`slot-reel${win ? ' is-win' : ''}`}>
    <div className="slot-strip" style={{ transform: `translateY(${-offset}px)`, transition: animate ? `transform ${1.1 + delay}s cubic-bezier(.2,.8,.25,1)` : 'none' }}>
      {strip.map((s, i) => <span key={i} className="slot-symbol" aria-hidden={i !== strip.length - 1}>{SLOT_ICONS[s]}</span>)}
    </div>
  </div>
}

export default function SlotsPage() {
  const [bet, setBet] = useState(10)
  const game = useInstantGame<{ p_bet: number }, { reels: SlotSymbol[] }>('play_slots', 2000)
  const canBet = useCanBet(bet)
  const reels = game.result?.result.reels ?? null
  const won = game.revealed && Boolean(game.result && game.result.payout > 0)

  return <>
    <GameHeader game="slots" description="Tres rodillos y una línea de pago. Tres símbolos iguales pagan hasta 500×; las cerezas en los primeros rodillos también premian." />
    <GameLayout
      controls={<>
        <BetInput value={bet} onChange={setBet} disabled={game.busy} />
        <div className="info-grid paytable">
          {[...SLOT_SYMBOLS].reverse().map((s) => <div key={s.symbol} className="paytable-row"><span>{s.icon} {s.icon} {s.icon}</span><strong>{s.three}×</strong></div>)}
          <div className="paytable-row"><span>🍒 🍒 ·</span><strong>4×</strong></div>
          <div className="paytable-row"><span>🍒 · ·</span><strong>1×</strong></div>
        </div>
        <InfoRow label="Premio máximo" value={`${formatPoints(payoutFor(bet, 500))} pts`} />
        <Button variant="primary" size="lg" className="btn-block" loading={game.busy} disabled={!canBet} onClick={() => void game.run({ p_bet: bet })}>Girar</Button>
      </>}
      stage={<div className="stage-center">
        <div className="slots-machine">
          {[0, 1, 2].map((i) => <Reel key={`${game.result?.bet_id ?? 0}-${i}`} symbol={reels ? reels[i] : null} delay={i * 0.4} win={won} />)}
        </div>
        {game.revealed && game.result && <Outcome bet={game.result.bet} payout={game.result.payout} multiplier={Number(game.result.multiplier)} />}
      </div>}
      below={<RecentBets game="slots" />}
    />
  </>
}
