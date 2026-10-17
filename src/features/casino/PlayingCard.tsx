import { cardInfo } from '../../lib/casino'

export default function PlayingCard({ card, size, state }: { card: number | null; size?: 'small' | 'large'; state?: 'correct' | 'wrong' }) {
  const sizeClass = size ? ` is-${size}` : ''
  const stateClass = state ? ` is-${state}` : ''
  if (card === null) return <div className={`playing-card is-back${sizeClass}`} aria-label="Carta boca abajo" />
  const { rank, suit, red } = cardInfo(card)
  return <div className={`playing-card${red ? ' is-red' : ''}${sizeClass}${stateClass}`} aria-label={`${rank} de ${suit}`}>
    <span className="pc-corner">{rank}</span>
    <span className="pc-suit">{suit}</span>
  </div>
}
