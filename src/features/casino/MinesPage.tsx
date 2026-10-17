import { useState } from 'react'
import { Dices } from 'lucide-react'
import { Button, Skeleton } from '../../ui'
import { formatMultiplier, minesMultiplier, payoutFor } from '../../lib/casino'
import { formatPoints } from '../../lib/game'
import { BetInput, GameHeader, GameLayout, InfoRow, Outcome, RecentBets } from './components'
import { useCanBet, useSessionGame } from './useInstantGame'
import type { SessionView } from './api'

type MinesView = SessionView & {
  mines_count: number
  revealed: number[]
  multiplier: number
  next_multiplier: number | null
  mines: number[] | null
  hit: number | null
}

export default function MinesPage() {
  const [bet, setBet] = useState(10)
  const [mines, setMines] = useState(3)
  const game = useSessionGame<MinesView>('mines')
  const canBet = useCanBet(bet)
  const view = game.view
  const playing = Boolean(view?.active)
  const revealed = new Set(view?.revealed ?? [])
  const mineSet = new Set(view?.mines ?? [])
  const multiplier = Number(view?.multiplier ?? 1)

  const reveal = (tile: number) => { if (playing && !revealed.has(tile) && !game.busy) void game.call('mines_reveal', { p_tile: tile }) }
  const randomTile = () => {
    const free = Array.from({ length: 25 }, (_, i) => i).filter((i) => !revealed.has(i))
    reveal(free[Math.floor(Math.random() * free.length)])
  }

  return <>
    <GameHeader game="mines" description="Hay minas escondidas en un tablero de 5×5. Cada gema que destapas sube el multiplicador; retírate cuando quieras, antes de pisar una mina." />
    <GameLayout
      controls={playing && view ? <>
        <div className="info-grid">
          <InfoRow label="Apuesta" value={`${formatPoints(view.bet)} pts`} />
          <InfoRow label="Minas" value={view.mines_count} />
          <InfoRow label="Multiplicador actual" value={formatMultiplier(multiplier)} />
          {view.next_multiplier !== null && <InfoRow label="Siguiente gema" value={formatMultiplier(Number(view.next_multiplier))} />}
        </div>
        <Button variant="secondary" disabled={game.busy} onClick={randomTile}><Dices size={16} />Casilla al azar</Button>
        <Button variant="primary" size="lg" className="btn-block" loading={game.busy} disabled={revealed.size === 0}
          onClick={() => void game.call('mines_cashout')}>Retirar {formatPoints(payoutFor(view.bet, multiplier))} pts</Button>
      </> : <>
        <BetInput value={bet} onChange={setBet} disabled={game.busy} />
        <div className="field">
          <label htmlFor="mines-count">Número de minas</label>
          <select id="mines-count" className="select" value={mines} disabled={game.busy} onChange={(event) => setMines(Number(event.target.value))}>
            {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="info-grid">
          <InfoRow label="Primera gema" value={formatMultiplier(minesMultiplier(mines, 1))} />
          <InfoRow label="Tablero completo" value={formatMultiplier(minesMultiplier(mines, 25 - mines))} />
        </div>
        <Button variant="primary" size="lg" className="btn-block" loading={game.busy} disabled={!canBet || game.loading}
          onClick={() => void game.call('mines_start', { p_bet: bet, p_mines: mines })}>Empezar</Button>
      </>}
      stage={game.loading ? <Skeleton height={360} /> : <div className="stack">
        <div className="mines-grid">
          {Array.from({ length: 25 }, (_, tile) => {
            const isGem = revealed.has(tile)
            const finished = view && !view.active
            const isMine = finished && mineSet.has(tile)
            const cls = isGem ? ' is-gem' : isMine ? ` is-mine${view?.hit === tile ? '' : ' is-faded'}` : finished ? ' is-faded' : ''
            return <button key={tile} type="button" className={`mine-tile${cls}`} disabled={!playing || isGem || game.busy} onClick={() => reveal(tile)} aria-label={`Casilla ${tile + 1}`}>
              {isGem ? '💎' : isMine ? '💣' : finished ? '💎' : ''}
            </button>
          })}
        </div>
        <div className="stage-center" style={{ minHeight: 64 }}>
          {view && !view.active && <Outcome bet={view.bet} payout={view.payout} multiplier={view.payout > 0 ? multiplier : 0} label="¡Mina!" />}
          {!view && <p className="muted">Elige tu apuesta y el número de minas para empezar.</p>}
        </div>
      </div>}
      below={<RecentBets game="mines" />}
    />
  </>
}
