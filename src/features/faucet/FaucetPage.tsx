import { ShieldCheck } from 'lucide-react'
import { Card, CardHeader, EmptyState, PageHeader, Skeleton } from '../../ui'
import { FAUCET_BASE_REWARD, FAUCET_MAX_BONUS_DAYS, describeLedgerEntry, faucetReward, formatPoints } from '../../lib/game'
import { useHistory } from '../../lib/queries'
import ClaimPanel from './ClaimPanel'
import { useFaucetStatus } from './useFaucetStatus'

const dateTime = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' })

export default function FaucetPage() {
  const faucet = useFaucetStatus()
  const history = useHistory('daily_faucet')
  const claims = history.data?.pages[0]?.slice(0, 7) ?? []
  const completedDays = faucet.activeStreak
  const nextDay = faucet.available ? faucet.activeStreak + 1 : faucet.activeStreak

  return <>
    <PageHeader title="Faucet diario" description="Reclama puntos cada 24 horas. Cuantos más días seguidos, mayor es la recompensa." />
    <ClaimPanel />
    <div className="grid-main">
      <Card>
        <CardHeader title="Recompensa por día de racha" description={`Empiezas en ${FAUCET_BASE_REWARD} puntos y sumas 2 por cada día seguido, hasta ${faucetReward(FAUCET_MAX_BONUS_DAYS + 1)}.`} />
        <div className="streak-steps">
          {Array.from({ length: FAUCET_MAX_BONUS_DAYS + 1 }, (_, index) => {
            const day = index + 1
            const done = day <= completedDays
            const isNext = day === Math.min(nextDay, FAUCET_MAX_BONUS_DAYS + 1) && faucet.available
            return <div key={day} className={`streak-step${done ? ' streak-step-done' : ''}${isNext ? ' streak-step-next' : ''}`}>
              <span>Día {day}{day === FAUCET_MAX_BONUS_DAYS + 1 ? '+' : ''}</span>
              <strong>+{faucetReward(day)}</strong>
            </div>
          })}
        </div>
        <p className="footnote" style={{ marginTop: 'var(--space-4)' }}><ShieldCheck size={14} />Si pasan más de 48 horas sin reclamar, la racha vuelve a empezar en el día 1.</p>
      </Card>
      <Card>
        <CardHeader title="Últimas reclamaciones" />
        {history.isLoading ? <div className="stack">{[0, 1, 2].map((key) => <Skeleton key={key} height={36} />)}</div>
          : claims.length === 0 ? <EmptyState title="Aún no has reclamado" description="Tu primera recompensa aparecerá aquí." />
            : <div className="list">{claims.map((claim) => <div className="list-row" key={claim.id}>
              <div className="list-row-main"><strong>{describeLedgerEntry(claim.source_type, claim.detail)}</strong><span>{dateTime.format(new Date(claim.created_at))}</span></div>
              <strong className="tnum positive">+{formatPoints(claim.points)}</strong>
            </div>)}</div>}
      </Card>
    </div>
    <p className="footnote"><ShieldCheck size={14} />Los puntos son promocionales: no tienen valor monetario y no se pueden retirar ni transferir. Se requiere correo verificado.</p>
  </>
}
