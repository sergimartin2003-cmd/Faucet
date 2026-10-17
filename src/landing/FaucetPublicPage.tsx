import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { CheckCircle2, Clock, Droplets, ExternalLink, ShieldCheck } from 'lucide-react'
import Link from '../lib/Link'
import { t } from '../lib/i18n'
import { siteName } from '../lib/site'
import { turnstileSiteKey } from '../lib/turnstile'
import { useNow } from '../lib/useNow'
import { FAUCETPAY_URL, faucetErrorMessage, formatCoin, formatSatoshi, useClaimFaucet, usePublicFaucet, type FaucetDetail } from '../lib/faucets'
import Captcha from '../components/Captcha'
import AdSlot from '../components/AdSlot'
import { Alert, Button, EmptyState, Skeleton } from '../ui'
import PublicLayout from './PublicLayout'
import './faucets.css'

const ADDRESS_KEY = 'faucetfree:faucetpay-address'
const nextKey = (slug: string) => `faucetfree:next:${slug}`

function readStorage(key: string) {
  try { return window.localStorage.getItem(key) ?? '' } catch { return '' }
}
function writeStorage(key: string, value: string) {
  try { window.localStorage.setItem(key, value) } catch { /* storage unavailable */ }
}

function countdown(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`
}

// Each banner shows the platform's ad unit for its share of page views, the creator's otherwise.
function pickAdUnits(faucet: FaucetDetail) {
  const pick = () => (!faucet.ad_unit || Math.random() * 100 < faucet.ad_share_pct ? faucet.platform_ad_unit : faucet.ad_unit)
  return [pick(), pick()]
}

function ClaimForm({ faucet }: { faucet: FaucetDetail }) {
  const claim = useClaimFaucet()
  const now = useNow(1000)
  const [address, setAddress] = useState(() => readStorage(ADDRESS_KEY))
  const [captcha, setCaptcha] = useState('')
  const [captchaKey, setCaptchaKey] = useState(0)
  const [nextAt, setNextAt] = useState(() => Date.parse(readStorage(nextKey(faucet.slug))) || 0)
  const [paid, setPaid] = useState<number | null>(null)
  const onToken = useCallback((token: string) => setCaptcha(token), [])
  const wait = nextAt - now

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!address.trim() || !captcha || wait > 0) return
    writeStorage(ADDRESS_KEY, address.trim())
    claim.mutate({ slug: faucet.slug, address: address.trim(), captcha }, {
      onSuccess: (result) => {
        setPaid(result.amount)
        setNextAt(Date.parse(result.next_at))
        writeStorage(nextKey(faucet.slug), result.next_at)
      },
      onError: (error) => {
        const next = (error as { nextAt?: string | null }).nextAt
        if (next) { setNextAt(Date.parse(next)); writeStorage(nextKey(faucet.slug), next) }
      },
      onSettled: () => { setCaptcha(''); setCaptchaKey((key) => key + 1) },
    })
  }

  if (!faucet.ready) return <Alert tone="warning">{t('Esta faucet está en pausa. Vuelve más tarde.')}</Alert>
  if (!faucet.funded) return <Alert tone="warning">{t('Esta faucet se ha quedado sin fondos. Su creador debe recargarla en FaucetPay.')}</Alert>
  if (!turnstileSiteKey) return <Alert tone="info">{t('Las faucets están en mantenimiento. Vuelve en un rato.')}</Alert>

  return <form className="faucet-claim" onSubmit={submit}>
    {paid !== null && <Alert tone="success">{t('¡Pagado! Has recibido {amount} en tu cuenta de FaucetPay.', { amount: formatCoin(paid, faucet.currency) })}</Alert>}
    {claim.isError && <Alert tone="error">{faucetErrorMessage(claim.error)}</Alert>}
    <div className="field">
      <label htmlFor="faucet-address">{t('Tu dirección, correo o usuario de FaucetPay')}</label>
      <input id="faucet-address" className="input mono-num" autoComplete="off" spellCheck={false} maxLength={120} value={address}
        placeholder={t('dirección {coin} vinculada a FaucetPay', { coin: faucet.currency })} onChange={(event) => setAddress(event.target.value)} />
      <span className="field-hint">{t('¿No tienes cuenta?')} <a href={FAUCETPAY_URL} target="_blank" rel="noreferrer">{t('Regístrate gratis en FaucetPay')} <ExternalLink size={11} /></a></span>
    </div>
    {wait > 0
      ? <div className="faucet-wait"><Clock size={16} />{t('Próximo reclamo en')} <strong className="mono-num">{countdown(wait)}</strong></div>
      : <>
        <Captcha key={captchaKey} onToken={onToken} />
        <Button type="submit" variant="primary" size="lg" loading={claim.isPending} disabled={!address.trim() || !captcha}><Droplets size={18} />{t('Reclamar {amount}', { amount: formatCoin(faucet.reward, faucet.currency) })}</Button>
      </>}
  </form>
}

export default function FaucetPublicPage({ slug }: { slug: string }) {
  const faucet = usePublicFaucet(slug)
  const data = faucet.data
  const ads = useMemo(() => (data ? pickAdUnits(data) : [null, null]), [data])

  useEffect(() => { document.title = data ? `${data.name} · ${siteName}` : t('Faucet · {site}', { site: siteName }) }, [data])

  return <PublicLayout>
    <section className="landing-container faucet-page">
      {faucet.isLoading ? <Skeleton height={320} style={{ borderRadius: 16 }} />
        : !data ? <div className="card card-pad"><EmptyState icon={<Droplets size={22} />} title={t('Faucet no encontrada')} description={t('Puede que su creador la haya cambiado de dirección o eliminado.')}
          action={<Link to="/faucets" className="btn btn-primary btn-sm">{t('Ver todas las faucets')}</Link>} /></div>
          : <>
            <AdSlot unit={ads[0]} />
            <div className="faucet-hero card card-pad">
              <span className="faucet-coin">{data.currency}</span>
              <h1>{data.name}</h1>
              {data.description && <p className="faucet-desc">{data.description}</p>}
              <div className="faucet-facts">
                <div><span>{t('Recompensa')}</span><strong>{formatCoin(data.reward, data.currency)}</strong></div>
                <div><span>{t('Frecuencia')}</span><strong>{data.interval_minutes % 60 === 0 ? t('cada {n} h', { n: data.interval_minutes / 60 }) : t('cada {n} min', { n: data.interval_minutes })}</strong></div>
                <div><span>{t('Límite diario')}</span><strong>{t('{n} reclamos', { n: data.daily_limit })}</strong></div>
                <div><span>{t('Pagos realizados')}</span><strong>{formatSatoshi(data.claims_count)}</strong></div>
              </div>
              <ClaimForm faucet={data} />
              <p className="faucet-note"><CheckCircle2 size={13} />{t('Pago instantáneo a FaucetPay desde la cuenta del creador de esta faucet.')}</p>
            </div>
            <AdSlot unit={ads[1]} />
            <p className="faucet-note"><ShieldCheck size={13} />{t('Faucet creada por un usuario de {site}. Una cuenta por persona; las VPN y los bots se bloquean.', { site: siteName })} <Link to="/dashboard/faucets">{t('Crea la tuya')}</Link> · <Link to="/faucets">{t('Más faucets')}</Link></p>
          </>}
    </section>
  </PublicLayout>
}
