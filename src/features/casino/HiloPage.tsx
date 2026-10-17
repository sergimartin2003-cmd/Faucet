import { useState } from 'react'
import { ChevronDown, ChevronUp, SkipForward } from 'lucide-react'
import { Button, Skeleton } from '../../ui'
import { cardInfo, formatMultiplier, payoutFor } from '../../lib/casino'
import { formatPoints } from '../../lib/game'
import { BetInput, GameHeader, GameLayout, InfoRow, Outcome, RecentBets } from './components'
import { useCanBet, useSessionGame } from './useInstantGame'
import PlayingCard from './PlayingCard'
import type { SessionView } from './api'

type HiloView = SessionView & {
  card: number
  multiplier: number
  steps: { higher: number | null; lower: number | null }
  history: { card: number; guess: 'start' | 'higher' | 'lower' | 'skip'; correct?: boolean }[]
  guesses: number
  skips: number
}

const chance = (step: number | null) => (step ? `${((0.99 / step) * 100).toLocaleString('es-ES', { maximumFractionDigits: 1 })}%` : '—')

export default function HiloPage() {
  const [bet, setBet] = useState(10)
  const game = useSessionGame<HiloView>('hilo')
  const canBet = useCanBet(bet)
  const view = game.view
  const playing = Boolean(view?.active)
  const multiplier = Number(view?.multiplier ?? 1)
  const rank = view ? cardInfo(view.card).rank : null
  const guess = (choice: 'higher' | 'lower' | 'skip') => void game.call('hilo_guess', { p_choice: choice })

  return <>
    <GameHeader game="hilo" description="Adivina si la siguiente carta será mayor o igual, o menor o igual. Cada acierto multiplica tu apuesta; retírate cuando quieras." />
    <GameLayout
      controls={playing && view ? <>
        <div className="info-grid">
          <InfoRow label="Apuesta" value={`${formatPoints(view.bet)} pts`} />
          <InfoRow label="Multiplicador" value={formatMultiplier(multiplier)} />
          <InfoRow label="Aciertos" value={view.guesses} />
        </div>
        <Button variant="secondary" size="lg" disabled={game.busy || view.steps.higher === null} onClick={() => guess('higher')}>
          <ChevronUp size={18} />Mayor o igual a {rank} · {view.steps.higher ? formatMultiplier(Number(view.steps.higher)) : '—'}
        </Button>
        <span className="field-hint" style={{ textAlign: 'center' }}>Probabilidad {chance(view.steps.higher === null ? null : Number(view.steps.higher))}</span>
        <Button variant="secondary" size="lg" disabled={game.busy || view.steps.lower === null} onClick={() => guess('lower')}>
          <ChevronDown size={18} />Menor o igual a {rank} · {view.steps.lower ? formatMultiplier(Number(view.steps.lower)) : '—'}
        </Button>
        <span className="field-hint" style={{ textAlign: 'center' }}>Probabilidad {chance(view.steps.lower === null ? null : Number(view.steps.lower))}</span>
        <Button variant="ghost" disabled={game.busy} onClick={() => guess('skip')}><SkipForward size={16} />Saltar carta</Button>
        <Button variant="primary" size="lg" className="btn-block" loading={game.busy} disabled={view.guesses === 0}
          onClick={() => void game.call('hilo_cashout')}>Retirar {formatPoints(payoutFor(view.bet, multiplier))} pts</Button>
      </> : <>
        <BetInput value={bet} onChange={setBet} disabled={game.busy} />
        <p className="muted">El As es la carta más baja y el Rey la más alta. Los empates cuentan a tu favor.</p>
        <Button variant="primary" size="lg" className="btn-block" loading={game.busy} disabled={!canBet || game.loading}
          onClick={() => void game.call('hilo_start', { p_bet: bet })}>Empezar</Button>
      </>}
      stage={game.loading ? <Skeleton height={360} /> : <div className="stage-center">
        <PlayingCard key={view ? `${view.session_id}-${view.history.length}` : 'none'} card={view ? view.card : null} size="large"
          state={view && !view.active ? (view.payout > 0 ? 'correct' : 'wrong') : undefined} />
        {view && view.history.length > 1 && <div className="hilo-history">
          {view.history.map((entry, i) => <PlayingCard key={i} card={entry.card} size="small" state={entry.correct === undefined ? undefined : entry.correct ? 'correct' : 'wrong'} />)}
        </div>}
        {view && !view.active && <Outcome bet={view.bet} payout={view.payout} multiplier={view.payout > 0 ? multiplier : 0} label="Has fallado" />}
        {!view && <p className="muted">Elige tu apuesta para sacar la primera carta.</p>}
      </div>}
      below={<RecentBets game="hilo" />}
    />
  </>
}
