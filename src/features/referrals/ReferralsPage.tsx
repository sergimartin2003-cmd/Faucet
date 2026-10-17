import { useState } from 'react'
import { Check, Copy, ShieldCheck } from 'lucide-react'
import { Alert, Button, Card, CardHeader, PageHeader, Skeleton, Stat } from '../../ui'
import { useToast } from '../../ui/toastContext'
import { formatPoints } from '../../lib/game'
import { useReferralSummary } from '../../lib/queries'
import { siteOrigin } from '../../lib/site'
import { t } from '../../lib/i18n'

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
      toast(t('Enlace copiado al portapapeles.'))
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast(t('No se pudo copiar el enlace. Cópialo manualmente.'), 'error')
    }
  }

  return <>
    <PageHeader title={t('Referidos')} description={summary ? t('Recibes {reward} puntos por cada amigo que se registre con tu enlace y complete su primera oferta o encuesta (hasta {max} referidos).', { reward: summary.reward_per_referral, max: summary.max_rewarded }) : t('Invita a tus amigos y recibe puntos cuando completen su primera oferta.')} />
    {referral.isError && <Alert tone="error">{t('No se pudo cargar tu enlace de invitación. Inténtalo de nuevo en unos minutos.')}</Alert>}
    <Card>
      <CardHeader title={t('Tu enlace de invitación')} description={t('Compártelo con quien quieras. Cada código es personal.')} />
      {referral.isLoading ? <Skeleton height={38} /> : summary && <div className="copy-row">
        <input className="input" readOnly aria-label={t('Enlace de invitación')} value={link} onFocus={(event) => event.currentTarget.select()} />
        <Button variant="primary" onClick={() => void copy()}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? t('Copiado') : t('Copiar')}</Button>
      </div>}
    </Card>
    <div className="grid-stats grid-stats-3">
      <Card><Stat label={t('Registrados')} value={summary?.total_referrals ?? '—'} hint={t('Personas que usaron tu enlace')} /></Card>
      <Card><Stat label={t('Activos')} value={summary ? `${summary.rewarded_referrals} / ${summary.max_rewarded}` : '—'} hint={t('Completaron su primera oferta')} /></Card>
      <Card><Stat label={t('Puntos ganados')} value={summary ? formatPoints(summary.points_earned) : '—'} unit={t('puntos')} /></Card>
    </div>
    <Card>
      <CardHeader title={t('Cómo funciona')} />
      <ol className="steps">
        <li><div><strong>{t('Comparte tu enlace')}</strong><span>{t('Tu amigo se registra desde el enlace y verifica su correo.')}</span></div></li>
        <li><div><strong>{t('Completa su primera oferta')}</strong><span>{t('Cuando tu amigo complete su primera encuesta u oferta, el referido pasa a estar activo.')}</span></div></li>
        <li><div><strong>{t('Recibes los puntos')}</strong><span>{t('La recompensa se acredita automáticamente en tu saldo.')}</span></div></li>
      </ol>
    </Card>
    <p className="footnote"><ShieldCheck size={14} />{t('El código solo puede aplicarse durante los primeros 7 días de una cuenta nueva y no se puede usar en la propia cuenta.')} {summary?.was_referred ? t('Tu cuenta se registró con un código de invitación.') : ''}</p>
  </>
}
