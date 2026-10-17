import { useState } from 'react'
import { Hand, Layers, Plus } from 'lucide-react'
import { Button, Skeleton } from '../../ui'
import { blackjackTotal } from '../../lib/casino'
import { formatPoints } from '../../lib/game'
import { t } from '../../lib/i18n'
import { BetInput, GameHeader, GameLayout, InfoRow, Outcome, RecentBets } from './components'
import { useCanBet, useSessionGame } from './useInstantGame'
import { useFaucetStatus } from '../faucet/useFaucetStatus'
import PlayingCard from './PlayingCard'
import type { SessionView } from './api'

type BlackjackView = SessionView & {
  player: number[]
  player_total: number
  dealer: number[]
  dealer_total: number
  can_double: boolean
  doubled: boolean
}

function outcomeLabel(outcome: string) {
  switch (outcome) {
    case 'blackjack': return t('¡Blackjack!')
    case 'win': return t('Ganas la mano')
    case 'push': return t('Empate')
    case 'lose': return t('Gana el crupier')
    case 'bust': return t('Te has pasado')
    case 'dealer_blackjack': return t('Blackjack del crupier')
    default: return undefined
  }
}

export default function BlackjackPage() {
  const [bet, setBet] = useState(10)
  const game = useSessionGame<BlackjackView>('blackjack')
  const canBet = useCanBet(bet)
  const { points } = useFaucetStatus()
  const view = game.view
  const playing = Boolean(view?.active)
  const act = (action: 'hit' | 'stand' | 'double') => void game.call('blackjack_action', { p_action: action })
  const dealerCards = view ? (view.active ? [...view.dealer, null] : view.dealer) : []
  const soft = (cards: number[]) => cards.some((c) => c % 13 === 0) && blackjackTotal(cards) <= 21 && cards.reduce((s, c) => s + Math.min((c % 13) + 1, 10), 0) + 10 === blackjackTotal(cards)

  return <>
    <GameHeader game="blackjack" description={t('Llega lo más cerca posible de 21 sin pasarte. El blackjack paga 3:2, el crupier se planta en 17 y puedes doblar con las dos primeras cartas.')} />
    <GameLayout
      controls={playing && view ? <>
        <div className="info-grid">
          <InfoRow label={t('Apuesta')} value={t('{points} pts', { points: formatPoints(view.bet) })} />
          <InfoRow label={t('Tu mano')} value={soft(view.player) ? t('Blanda {total}', { total: view.player_total }) : view.player_total} />
        </div>
        <Button variant="secondary" size="lg" disabled={game.busy} onClick={() => act('hit')}><Plus size={16} />{t('Pedir carta')}</Button>
        <Button variant="secondary" size="lg" disabled={game.busy} onClick={() => act('stand')}><Hand size={16} />{t('Plantarse')}</Button>
        <Button variant="secondary" size="lg" disabled={game.busy || !view.can_double || points === null || points < view.bet} onClick={() => act('double')}><Layers size={16} />{t('Doblar ({points} pts más)', { points: formatPoints(view.bet) })}</Button>
      </> : <>
        <BetInput value={bet} onChange={setBet} disabled={game.busy} />
        <p className="muted">{t('Baraja infinita, sin seguro ni división de pares.')}</p>
        <Button variant="primary" size="lg" className="btn-block" loading={game.busy} disabled={!canBet || game.loading}
          onClick={() => void game.call('blackjack_start', { p_bet: bet })}>{t('Repartir')}</Button>
      </>}
      stage={game.loading ? <Skeleton height={360} /> : <div className="stack" style={{ gap: 'var(--space-6)' }}>
        <div className="stack" style={{ gap: 'var(--space-2)' }}>
          <div className="hand-label">{t('Crupier')} {view && <span className="hand-total">{view.dealer_total}</span>}</div>
          <div className="card-row">{dealerCards.map((card, i) => <PlayingCard key={i} card={card} />)}</div>
        </div>
        <div className="stage-center" style={{ minHeight: 64 }}>
          {view && !view.active && <Outcome bet={view.bet} payout={view.payout} label={outcomeLabel(view.outcome) ?? t('Fin de la mano')} />}
          {view && !view.active && view.payout > view.bet && <span className="muted">{outcomeLabel(view.outcome)}</span>}
          {!view && <p className="muted">{t('Haz tu apuesta y pulsa Repartir.')}</p>}
        </div>
        <div className="stack" style={{ gap: 'var(--space-2)' }}>
          <div className="card-row">{(view?.player ?? []).map((card, i) => <PlayingCard key={i} card={card} />)}</div>
          <div className="hand-label">{t('Tú')} {view && <span className="hand-total">{view.player_total}</span>}{view?.doubled && <span className="badge badge-accent">{t('Doblada')}</span>}</div>
        </div>
      </div>}
      below={<RecentBets game="blackjack" />}
    />
  </>
}
