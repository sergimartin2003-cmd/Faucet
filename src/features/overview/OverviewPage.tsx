import { useMemo, useState, type CSSProperties } from 'react'
import { ArrowRight, ArrowUpFromLine, ClipboardList, Dices, ShieldCheck, Users } from 'lucide-react'
import Link from '../../lib/Link'
import { Card, CardHeader, EmptyState, PageHeader, ProgressBar, Skeleton, Stat } from '../../ui'
import { buildActivityGrid, describeLedgerEntry, formatPoints, levelFromXp, summarizeLedger, XP_PER_LEVEL } from '../../lib/game'
import { MIN_WITHDRAWAL_POINTS, POINTS_PER_USD, REFERRAL_REWARD_POINTS, formatUsd, pointsToUsd } from '../../lib/payouts'
import { useHistory, useLedger } from '../../lib/queries'
import { useAccountPrefs } from '../../lib/accountPrefs'
import { usePrivacy } from '../../app/sessionContext'
import { useFaucetStatus } from '../faucet/useFaucetStatus'
import ActivityHeatmap from './ActivityHeatmap'

const EARN_TILES = [
  { to: '/dashboard/ofertas', icon: ClipboardList, title: 'Encuestas y ofertas', text: 'Encuestas remuneradas, apps y juegos de BitLabs.', reward: 'Según la tarea', tone: 'var(--violet)' },
  { to: '/dashboard/referidos', icon: Users, title: 'Invita amigos', text: 'Cuando completen su primera oferta.', reward: `+${REFERRAL_REWARD_POINTS} pts`, tone: 'var(--amber)' },
  { to: '/dashboard/retirar', icon: ArrowUpFromLine, title: 'Retira en crypto', text: 'USDT, Binance Pay, LTC, TRX o DOGE.', reward: `Desde ${formatUsd(pointsToUsd(MIN_WITHDRAWAL_POINTS))}`, tone: '#5cc8ff' },
  { to: '/dashboard/casino', icon: Dices, title: 'Casino', text: 'Doce juegos con resultados verificables.', reward: 'Juego responsable', tone: '#ff7ab6' },
]

const dateTime = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' })

export default function OverviewPage() {
  const balance = useFaucetStatus()
  const ledger = useLedger()
  const recent = useHistory('')
  const { prefs } = useAccountPrefs()
  const { hidden } = usePrivacy()
  const mask = (value: string) => (hidden ? '•••' : value)

  const [now] = useState(() => new Date())
  const summary = useMemo(() => (ledger.data ? summarizeLedger(ledger.data, now) : null), [ledger.data, now])
  const grid = useMemo(() => (ledger.data ? buildActivityGrid(ledger.data, 112, now) : null), [ledger.data, now])
  const level = levelFromXp(summary?.total ?? 0)
  const points = balance.points ?? 0
  const recentRows = recent.data?.pages[0]?.slice(0, 6) ?? []
  const greeting = prefs.displayName ? `Hola, ${prefs.displayName}` : 'Resumen'

  return <>
    <PageHeader title={greeting} description={`Completa ofertas y encuestas y retira en crypto. ${formatPoints(POINTS_PER_USD)} puntos = 1 USD.`}
      actions={<Link to="/dashboard/ofertas" className="btn btn-primary">Ganar puntos<ArrowRight size={16} /></Link>} />
    <div className="grid-stats">
      <Card><Stat label="Saldo" value={balance.isLoading ? <Skeleton width={80} height={28} /> : mask(formatPoints(points))} unit="puntos" hint={mask(formatUsd(pointsToUsd(points)))} /></Card>
      <Card><Stat label="Para retirar" value={points >= MIN_WITHDRAWAL_POINTS ? 'Disponible' : mask(formatPoints(MIN_WITHDRAWAL_POINTS - points))} unit={points >= MIN_WITHDRAWAL_POINTS ? undefined : 'pts restantes'}
        hint={<><ProgressBar value={(points / MIN_WITHDRAWAL_POINTS) * 100} label="Progreso hasta el mínimo de retiro" /><span style={{ display: 'block', marginTop: 6 }}>Mínimo {formatUsd(pointsToUsd(MIN_WITHDRAWAL_POINTS))}</span></>} /></Card>
      <Card><Stat label="Nivel" value={ledger.isLoading ? <Skeleton width={40} height={28} /> : level.level} hint={<><ProgressBar value={level.percent} label="Progreso de nivel" /><span style={{ display: 'block', marginTop: 6 }}>{formatPoints(level.intoLevel)} / {formatPoints(XP_PER_LEVEL)} XP</span></>} /></Card>
      <Card><Stat label="Ganado este mes" value={summary ? mask(formatPoints(summary.monthPoints)) : <Skeleton width={60} height={28} />} unit="puntos" hint={summary ? `${formatUsd(pointsToUsd(summary.monthPoints))} · quedan ${summary.daysLeftInMonth} días de temporada` : undefined} /></Card>
    </div>

    <Card>
      <CardHeader title="Cómo ganar" description="Los puntos salen de tareas que pagan nuestros socios: por eso puedes retirarlos." />
      <div className="earn-grid">
        {EARN_TILES.map(({ to, icon: Icon, title, text, reward, tone }) => <Link key={to} to={to} className="earn-tile" style={{ '--tile': tone } as CSSProperties}>
          <span className="earn-tile-icon"><Icon size={20} /></span>
          <h3>{title}</h3>
          <p>{text}</p>
          <div className="earn-tile-foot"><span className="earn-tile-reward">{reward}</span><ArrowRight size={14} /></div>
        </Link>)}
      </div>
    </Card>

    <div className="grid-main">
      <Card>
        <CardHeader title="Actividad" description="Puntos ganados en las últimas 16 semanas." />
        {grid ? <ActivityHeatmap days={grid} /> : <Skeleton height={110} />}
      </Card>
      <Card>
        <CardHeader title="Movimientos recientes" action={<Link to="/dashboard/historial" className="btn btn-ghost btn-sm">Historial<ArrowRight size={14} /></Link>} />
        {recent.isLoading ? <div className="stack">{[0, 1, 2].map((key) => <Skeleton key={key} height={34} />)}</div>
          : recentRows.length === 0 ? <EmptyState title="Sin movimientos" description="Completa tu primera encuesta para empezar." />
            : <div className="list">{recentRows.map((row) => <div className="list-row" key={row.id}>
              <div className="list-row-main"><strong>{describeLedgerEntry(row.source_type)}</strong><span>{dateTime.format(new Date(row.created_at))}</span></div>
              <strong className="tnum positive">+{formatPoints(row.points)}</strong>
            </div>)}</div>}
      </Card>
    </div>
    <p className="footnote"><ShieldCheck size={14} />Los puntos de una oferta pueden descontarse si el proveedor la anula. Una cuenta por persona.</p>
  </>
}
