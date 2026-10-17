import { useState } from 'react'
import { Check, Copy, ShieldCheck } from 'lucide-react'
import { Alert, Button, Card, CardHeader, PageHeader, Skeleton, Stat } from '../../ui'
import { useToast } from '../../ui/toastContext'
import { formatPoints } from '../../lib/game'
import { useReferralSummary } from '../../lib/queries'
import { siteOrigin } from '../../lib/site'

export default function ReferralsPage() {
  const referral = useReferralSummary()
  const toast = useToast()
  const [copied, setCopied] = useState(false)
  const summary = referral.data
  const link = summary ? `${siteOrigin()}/?ref=${summary.code}` : ''

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      toast('Enlace copiado al portapapeles.')
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast('No se pudo copiar el enlace. Cópialo manualmente.', 'error')
    }
  }

  return <>
    <PageHeader title="Referidos" description={summary ? `Recibes ${summary.reward_per_referral} puntos por cada amigo que se registre con tu enlace y complete su perfil (hasta ${summary.max_rewarded} referidos).` : 'Invita a tus amigos y recibe puntos cuando completen su perfil.'} />
    {referral.isError && <Alert tone="error">No se pudo cargar tu enlace de invitación. Inténtalo de nuevo en unos minutos.</Alert>}
    <Card>
      <CardHeader title="Tu enlace de invitación" description="Compártelo con quien quieras. Cada código es personal." />
      {referral.isLoading ? <Skeleton height={38} /> : summary && <div className="copy-row">
        <input className="input" readOnly aria-label="Enlace de invitación" value={link} onFocus={(event) => event.currentTarget.select()} />
        <Button variant="primary" onClick={() => void copy()}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? 'Copiado' : 'Copiar'}</Button>
      </div>}
    </Card>
    <div className="grid-stats grid-stats-3">
      <Card><Stat label="Registrados" value={summary?.total_referrals ?? '—'} hint="Personas que usaron tu enlace" /></Card>
      <Card><Stat label="Verificados" value={summary ? `${summary.rewarded_referrals} / ${summary.max_rewarded}` : '—'} hint="Completaron su perfil" /></Card>
      <Card><Stat label="Puntos ganados" value={summary ? formatPoints(summary.points_earned) : '—'} unit="puntos" /></Card>
    </div>
    <Card>
      <CardHeader title="Cómo funciona" />
      <ol className="steps">
        <li><div><strong>Comparte tu enlace</strong><span>Tu amigo se registra desde el enlace y verifica su correo.</span></div></li>
        <li><div><strong>Completa su perfil</strong><span>Cuando tu amigo complete la tarea de perfil, el referido queda verificado.</span></div></li>
        <li><div><strong>Recibes los puntos</strong><span>La recompensa se acredita automáticamente en tu saldo.</span></div></li>
      </ol>
    </Card>
    <p className="footnote"><ShieldCheck size={14} />El código solo puede aplicarse durante los primeros 7 días de una cuenta nueva y no se puede usar en la propia cuenta. {summary?.was_referred ? 'Tu cuenta se registró con un código de invitación.' : ''}</p>
  </>
}
