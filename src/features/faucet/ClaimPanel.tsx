import { Gift } from 'lucide-react'
import { errorCode, useClaimFaucet } from '../../lib/queries'
import { formatCountdown, formatPoints } from '../../lib/game'
import { Alert, Button, Card, Skeleton } from '../../ui'
import { useToast } from '../../ui/toastContext'
import { usePrivacy, useSessionUser } from '../../app/sessionContext'
import { useFaucetStatus } from './useFaucetStatus'

export default function ClaimPanel({ compact = false }: { compact?: boolean }) {
  const faucet = useFaucetStatus()
  const claim = useClaimFaucet()
  const toast = useToast()
  const user = useSessionUser()
  const { hidden } = usePrivacy()

  const submit = () => {
    claim.mutate(undefined, {
      onSuccess: (result) => {
        if (result.claimed) toast(`+${result.reward} puntos${result.streak > 1 ? ` · racha de ${result.streak} días` : ''}`)
        else toast('Esta recompensa ya estaba reclamada.', 'info')
      },
    })
  }

  const unconfirmed = user ? !user.emailConfirmed : false
  const claimError = claim.error
    ? errorCode(claim.error) === '22023' || (claim.error instanceof Error && claim.error.message.includes('Email confirmation'))
      ? 'Confirma tu correo electrónico para poder reclamar. Revisa la bandeja de entrada y la carpeta de spam.'
      : 'No se pudo reclamar la recompensa. Comprueba la conexión e inténtalo de nuevo.'
    : ''

  return <Card className="claim">
    <div className="claim-top">
      <div className="stat">
        <span className="stat-label">{faucet.available ? 'Recompensa disponible' : 'Próxima recompensa en'}</span>
        {faucet.isLoading ? <Skeleton width={160} height={40} /> : faucet.available
          ? <span className="claim-amount">+{faucet.nextReward}<small>puntos</small></span>
          : <span className="claim-amount">{formatCountdown(faucet.cooldownMs)}</span>}
        <span className="stat-hint">
          {faucet.available ? 'Una reclamación cada 24 horas.' : `Siguiente: +${faucet.nextReward} puntos`}
        </span>
      </div>
      <Button variant="primary" size="lg" disabled={!faucet.available || faucet.isLoading || unconfirmed} loading={claim.isPending} onClick={submit}>
        <Gift size={16} />{faucet.available ? `Reclamar ${faucet.nextReward} puntos` : 'Ya reclamado hoy'}
      </Button>
    </div>
    {!compact && <div className="claim-meta">
      <div className="stat"><span className="stat-label">Saldo</span><span className="stat-value">{hidden ? '•••' : faucet.points === null ? '—' : formatPoints(faucet.points)}<small>puntos</small></span></div>
      <div className="stat"><span className="stat-label">Racha actual</span><span className="stat-value">{faucet.activeStreak}<small>{faucet.activeStreak === 1 ? 'día' : 'días'}</small></span></div>
      <div className="stat"><span className="stat-label">Mejor racha</span><span className="stat-value">{faucet.bestStreak}<small>{faucet.bestStreak === 1 ? 'día' : 'días'}</small></span></div>
    </div>}
    {unconfirmed && <Alert tone="warning">Verifica tu correo electrónico para poder reclamar recompensas.</Alert>}
    {faucet.isError && <Alert tone="error">No se pudo cargar tu saldo. Inténtalo de nuevo en unos minutos.</Alert>}
    {claimError && <Alert tone="error">{claimError}</Alert>}
  </Card>
}
