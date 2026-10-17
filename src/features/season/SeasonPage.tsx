import { useMemo, useState } from 'react'
import { Check, Target, TrendingUp, Users } from 'lucide-react'
import { Alert, Avatar, Badge, Card, CardHeader, EmptyState, PageHeader, ProgressBar, Skeleton, Stat } from '../../ui'
import { formatPoints, levelFromXp, summarizeLedger, XP_PER_LEVEL } from '../../lib/game'
import { useLeaderboard, useLedger } from '../../lib/queries'
import { usePrivacy } from '../../app/sessionContext'

const monthLabel = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' })

export default function SeasonPage() {
  const ledger = useLedger()
  const board = useLeaderboard()
  const { hidden } = usePrivacy()
  const [now] = useState(() => new Date())
  const summary = useMemo(() => (ledger.data ? summarizeLedger(ledger.data, now) : null), [ledger.data, now])
  const level = levelFromXp(summary?.total ?? 0)
  const me = board.data?.find((entry) => entry.is_me)

  const missions = summary ? [
    { key: 'points-1000', icon: TrendingUp, title: 'Gana 1.000 puntos este mes', value: summary.monthPoints, goal: 1000 },
    { key: 'points-5000', icon: TrendingUp, title: 'Gana 5.000 puntos este mes', value: summary.monthPoints, goal: 5000 },
    { key: 'referral', icon: Users, title: 'Consigue un referido activo', value: summary.monthReferrals, goal: 1 },
  ] : []

  return <>
    <PageHeader title="Temporada" description={`Temporada de ${monthLabel.format(now)}. Se reinicia el primer día de cada mes (UTC); quedan ${summary?.daysLeftInMonth ?? '—'} días.`} />
    <div className="grid-stats">
      <Card><Stat label="Puntos este mes" value={summary ? (hidden ? '•••' : formatPoints(summary.monthPoints)) : <Skeleton width={70} height={28} />} /></Card>
      <Card><Stat label="Posición" value={board.isLoading ? <Skeleton width={50} height={28} /> : me ? `#${me.rank}` : '—'} hint={me ? undefined : 'Suma puntos para entrar'} /></Card>
      <Card><Stat label="Nivel" value={level.level} hint={`${formatPoints(level.toNext)} XP para el siguiente`} /></Card>
      <Card><Stat label="XP total" value={summary ? formatPoints(summary.total) : <Skeleton width={60} height={28} />} hint={`${formatPoints(XP_PER_LEVEL)} XP por nivel · 1 punto ganado = 1 XP`} /></Card>
    </div>
    <Card>
      <div className="row-between" style={{ marginBottom: 'var(--space-3)' }}><strong>Nivel {level.level}</strong><span className="muted tnum">{formatPoints(level.intoLevel)} / {formatPoints(XP_PER_LEVEL)} XP</span></div>
      <ProgressBar value={level.percent} label="Progreso hacia el siguiente nivel" />
    </Card>
    <div className="grid-main">
      <Card>
        <CardHeader title="Clasificación mensual" description="Puntos acumulados durante el mes en curso." />
        {board.isError ? <Alert tone="info">La clasificación no está disponible por ahora.</Alert>
          : board.isLoading ? <div className="stack">{[0, 1, 2, 3].map((key) => <Skeleton key={key} height={36} />)}</div>
            : !board.data?.length ? <EmptyState icon={<Target size={20} />} title="Aún no hay clasificación" description="Se mostrará en cuanto alguien sume puntos este mes." />
              : <div className="table-wrap"><table className="table">
                <thead><tr><th>#</th><th>Jugador</th><th className="num">Puntos</th></tr></thead>
                <tbody>{board.data.map((entry) => <tr key={`${entry.rank}-${entry.is_me}`} className={entry.is_me ? 'is-me' : undefined}>
                  <td className="rank">{entry.rank}</td>
                  <td><span className="person"><Avatar name={entry.display_name ?? '?'} color={entry.avatar_color} />{entry.display_name ?? 'Jugador anónimo'}{entry.is_me && <Badge tone="accent">Tú</Badge>}</span></td>
                  <td className="num">{formatPoints(entry.points_month)}</td>
                </tr>)}</tbody>
              </table></div>}
      </Card>
      <Card>
        <CardHeader title="Misiones del mes" />
        {ledger.isLoading ? <Skeleton height={180} /> : <div className="stack">{missions.map((mission) => {
          const done = mission.value >= mission.goal
          return <div key={mission.key} className="stack" style={{ gap: 'var(--space-2)' }}>
            <div className="row-between" style={{ flexWrap: 'nowrap' }}>
              <span className="row"><mission.icon size={16} className="faint" /><strong style={{ fontWeight: 550 }}>{mission.title}</strong></span>
              {done ? <Badge tone="success"><Check size={12} />Hecha</Badge> : <span className="muted tnum">{formatPoints(Math.min(mission.value, mission.goal))} / {formatPoints(mission.goal)}</span>}
            </div>
            <ProgressBar value={(Math.min(mission.value, mission.goal) / mission.goal) * 100} label={mission.title} />
          </div>
        })}</div>}
      </Card>
    </div>
    <p className="footnote">Puedes elegir si apareces con tu nombre o de forma anónima en Ajustes.</p>
  </>
}
