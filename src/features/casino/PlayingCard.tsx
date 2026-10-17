import { cardInfo } from '../../lib/casino'
import { t } from '../../lib/i18n'

export default function PlayingCard({ card, size, state }: { card: number | null; size?: 'small' | 'large'; state?: 'correct' | 'wrong' }) {
  const sizeClass = size ? ` is-${size}` : ''
  const stateClass = state ? ` is-${state}` : ''
  if (card === null) return <div className={`playing-card is-back${sizeClass}`} aria-label={t('Carta boca abajo')} />
  const { rank, suit, red } = cardInfo(card)
  return <div className={`playing-card${red ? ' is-red' : ''}${sizeClass}${stateClass}`} aria-label={t('{rank} de {suit}', { rank, suit })}>
    <span className="pc-corner">{rank}</span>
    <span className="pc-suit">{suit}</span>
  </div>
}
