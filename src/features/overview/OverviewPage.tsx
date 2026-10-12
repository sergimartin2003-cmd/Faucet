import { useMemo, useState } from 'react'
import { ArrowRight, Check, ShieldCheck } from 'lucide-react'
import Link from '../../lib/Link'
import { Badge, Card, CardHeader, EmptyState, PageHeader, ProgressBar, Skeleton, Stat } from '../../ui'
import { TASKS, buildActivityGrid, describeLedgerEntry, formatPoints, levelFromXp, summarizeLedger } from '../../lib/game'
import { useCompletedTasks, useHistory, useLedger } from '../../lib/queries'
import { useAccountPrefs } from '../../lib/accountPrefs'
import { usePrivacy } from '../../app/sessionContext'
import ClaimPanel from '../faucet/ClaimPanel'
import { useFaucetStatus } from '../faucet/useFaucetStatus'
import ActivityHeatmap from './ActivityHeatmap'

const dateTime = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' })

export default function OverviewPage() {
  const faucet = useFaucetStatus()
  const ledger = useLedger()
  const tasks = useCompletedTasks()
  const recent = useHistory('')
  const { prefs } = useAccountPrefs()
  const { hidden } = usePrivacy()
  const mask = (value: number) => (hidden ? '•••' : formatPoints(value))

  const [now] = useState(() => new Date())
  const summary = useMemo(() => (ledger.data ? summarizeLedger(ledger.data, now) : null), [ledger.data, now])
  const grid = useMemo(() => (ledger.data ? buildActivityGrid(ledger.data, 112, now) : null), [ledger.data, now])
  const level = levelFromXp(summary?.total ?? faucet.points ?? 0)
  const done = new Set(tasks.data?.map((task) => task.task_key))
  const pending = TASKS.filter((task) => !done.has(task.key))
  const recentRows = recent.data?.pages[0]?.slice(0, 6) ?? []
  const greeting = prefs.displayName ? `Hola, ${prefs.displayName}` : 'Resumen'

  return <>
    <PageHeader title={greeting} description="Tu actividad y tus próximas recompensas." />
    <div className="grid-stats">
      <Card><Stat label="Saldo" value={faucet.isLoading ? <Skeleton width={80} height={28} /> : faucet.points === null ? '—' : mask(faucet.points)} unit="puntos" /></Card>
      <Card><Stat label="Racha actual" value={faucet.activeStreak} unit={faucet.activeStreak === 1 ? 'día' : 'días'} hint={`Mejor racha: ${faucet.bestStreak}`} /></Card>
      <Card><Stat label="Nivel" value={ledger.isLoading ? <Skeleton width={40} height={28} /> : level.level} hint={<><ProgressBar value={level.percent} label="Progreso de nivel" /><span style={{ display: 'block', marginTop: 6 }}>{level.intoLevel} / 100 XP</span></>} /></Card>
      <Card><Stat label="Puntos este mes" value={summary ? mask(summary.monthPoints) : <Skeleton width={60} height={28} />} hint={summary ? `Quedan ${summary.daysLeftInMonth} días de temporada` : undefined} /></Card>
    </div>

    <div className="grid-main">
      <div className="stack">
        <ClaimPanel compact />
        <Card>
          <CardHeader title="Actividad" description="Puntos obtenidos en las últimas 16 semanas." />
          {grid ? <ActivityHeatmap days={grid} /> : <Skeleton height={110} />}
        </Card>
      </div>
      <div className="stack">
        <Card>
          <CardHeader title="Tareas pendientes" action={<Link to="/dashboard/tareas" className="btn btn-ghost btn-sm">Ver todas<ArrowRight size={14} /></Link>} />
          {tasks.isLoading ? <Skeleton height={80} /> : pending.length === 0
            ? <EmptyState icon={<Check size={20} />} title="Todo completado" description="Has completado todas las tareas disponibles." />
            : <div className="list">{pending.map((task) => <Link key={task.key} to="/dashboard/tareas" className="list-row" style={{ color: 'inherit' }}>
              <div className="list-row-main"><strong>{task.title}</strong><span>Recompensa única</span></div>
              <Badge tone="accent">+{task.reward}</Badge>
            </Link>)}</div>}
        </Card>
        <Card>
          <CardHeader title="Movimientos recientes" action={<Link to="/dashboard/historial" className="btn btn-ghost btn-sm">Historial<ArrowRight size={14} /></Link>} />
          {recent.isLoading ? <div className="stack">{[0, 1, 2].map((key) => <Skeleton key={key} height={34} />)}</div>
            : recentRows.length === 0 ? <EmptyState title="Sin movimientos" description="Reclama tu primera recompensa para empezar." />
              : <div className="list">{recentRows.map((row) => <div className="list-row" key={row.id}>
                <div className="list-row-main"><strong>{describeLedgerEntry(row.source_type, row.detail)}</strong><span>{dateTime.format(new Date(row.created_at))}</span></div>
                <strong className="tnum positive">+{formatPoints(row.points)}</strong>
              </div>)}</div>}
        </Card>
      </div>
    </div>
    <p className="footnote"><ShieldCheck size={14} />Los puntos son promocionales: no tienen valor monetario y no se pueden retirar ni transferir.</p>
  </>
}
