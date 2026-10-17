import type { CSSProperties } from 'react'
import { ArrowUpDown, Bomb, Cherry, CircleDot, Coins, Dice5, Disc3, Grid3x3, Rocket, ShieldCheck, Spade, Target, Triangle, type LucideIcon } from 'lucide-react'
import Link from '../../lib/Link'
import { formatPoints } from '../../lib/game'
import { GAME_RTP, GAME_SLUGS, formatMultiplier, gameLabel, type CasinoGame } from '../../lib/casino'
import { locale, t } from '../../lib/i18n'
import { Badge, PageHeader, Skeleton, Stat } from '../../ui'
import { usePrivacy } from '../../app/sessionContext'
import { useCasinoStats } from './api'
import './casino.css'

const GAMES: { game: CasinoGame; icon: LucideIcon; text: () => string; tone: string }[] = [
  { game: 'dice', icon: Dice5, text: () => t('Elige tu probabilidad y tira.'), tone: '#34e0c0' },
  { game: 'crash', icon: Rocket, text: () => t('Retira antes de que explote.'), tone: '#ff6b76' },
  { game: 'mines', icon: Bomb, text: () => t('Destapa gemas, esquiva minas.'), tone: '#46dca0' },
  { game: 'plinko', icon: Triangle, text: () => t('Deja caer la bola.'), tone: '#ff7ab6' },
  { game: 'blackjack', icon: Spade, text: () => t('Llega a 21 sin pasarte.'), tone: '#9a8bff' },
  { game: 'roulette', icon: CircleDot, text: () => t('Ruleta europea de un cero.'), tone: '#ff9f43' },
  { game: 'slots', icon: Cherry, text: () => t('Tres rodillos, hasta 500×.'), tone: '#ffd166' },
  { game: 'limbo', icon: Target, text: () => t('Fija un multiplicador objetivo.'), tone: '#5cc8ff' },
  { game: 'hilo', icon: ArrowUpDown, text: () => t('¿Mayor o menor?'), tone: '#7bed9f' },
  { game: 'keno', icon: Grid3x3, text: () => t('Elige hasta 10 números.'), tone: '#a29bfe' },
  { game: 'wheel', icon: Disc3, text: () => t('Gira la rueda de la fortuna.'), tone: '#fdcb6e' },
  { game: 'coinflip', icon: Coins, text: () => t('Cara o cruz al 50%.'), tone: '#ffb54a' },
]

export default function CasinoLobby() {
  const stats = useCasinoStats()
  const { hidden } = usePrivacy()
  const mask = (value: number) => (hidden ? '•••' : formatPoints(value))

  return <>
    <PageHeader title={t('Casino')} description={t('Doce juegos que se resuelven en el servidor y que puedes verificar tú mismo. Se juega con tus puntos.')} />
    <section className="casino-hero">
      <div className="grid-stats">
        {stats.isLoading ? [0, 1, 2, 3].map((key) => <Skeleton key={key} height={64} />) : <>
          <Stat label={t('Jugadas')} value={formatPoints(stats.data?.bets ?? 0)} />
          <Stat label={t('Apostado')} value={mask(stats.data?.wagered ?? 0)} unit="pts" />
          <Stat label={t('Balance neto')} value={hidden ? '•••' : `${(stats.data?.profit ?? 0) > 0 ? '+' : ''}${formatPoints(stats.data?.profit ?? 0)}`} unit="pts" />
          <Stat label={t('Mejor multiplicador')} value={formatMultiplier(Number(stats.data?.best_multiplier ?? 0))} />
        </>}
      </div>
      <p className="casino-disclaimer">
        {t('Se juega con tus puntos, que tienen valor real (1.000 puntos = 1 USD). Solo para mayores de 18 años: juega con responsabilidad y apuesta solo lo que estés dispuesto a perder.')}
        {' '}<Link to="/dashboard/casino/juego-justo" className="link-button row-inline"><ShieldCheck size={13} />{t('Cómo verificar cada jugada')}</Link>
      </p>
    </section>
    <div className="game-grid">
      {GAMES.map(({ game, icon: Icon, text, tone }) => <Link key={game} to={`/dashboard/casino/${GAME_SLUGS[game]}`} className="game-tile" style={{ '--tone': tone } as CSSProperties}>
        <span className="game-icon"><Icon size={26} /></span>
        <h3>{gameLabel(game)}</h3>
        <p>{text()}</p>
        <Badge>RTP {GAME_RTP[game].toLocaleString(locale())}%</Badge>
      </Link>)}
    </div>
  </>
}
