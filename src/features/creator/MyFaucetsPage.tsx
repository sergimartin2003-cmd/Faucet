import { useState, type FormEvent } from 'react'
import { Copy, ExternalLink, KeyRound, Pause, Pencil, Play, Plus, RefreshCw, Rocket, Droplets, ListOrdered } from 'lucide-react'
import { Alert, Badge, Button, Card, CardHeader, Dialog, EmptyState, PageHeader, Skeleton, Stat } from '../../ui'
import { useToast } from '../../ui/toastContext'
import Link from '../../lib/Link'
import { locale, t } from '../../lib/i18n'
import { siteName, siteOrigin } from '../../lib/site'
import { formatPoints } from '../../lib/game'
import {
  CURRENCY_NAMES, FAUCET_CURRENCIES, FAUCETPAY_URL, FEATURE_POINTS_PER_DAY, SLUG_PATTERN,
  faucetErrorMessage, formatCoin, formatSatoshi, slugify, useFaucetKey, useFeatureFaucet, useMyFaucetClaims, useMyFaucets,
  useSaveFaucet, useSetFaucetStatus, type FaucetCurrency, type FaucetInput, type MyFaucet,
} from '../../lib/faucets'
import { useSessionUser } from '../../app/sessionContext'
import { useFaucetStatus } from '../faucet/useFaucetStatus'
import { useNow } from '../../lib/useNow'
import '../../landing/faucets.css'

const STATUS_TONE = { draft: 'neutral', active: 'success', paused: 'warning', banned: 'danger' } as const
const statusLabel = (status: MyFaucet['status']) => ({ draft: t('Borrador'), active: t('Activa'), paused: t('En pausa'), banned: t('Suspendida') })[status]
const dateTime = () => new Intl.DateTimeFormat(locale(), { dateStyle: 'medium', timeStyle: 'short' })
const publicUrl = (slug: string) => `${siteOrigin()}/f/${slug}`

const EMPTY: FaucetInput = { id: null, slug: '', name: '', description: '', currency: 'LTC', reward: 1000, interval_minutes: 60, daily_limit: 24, ad_unit: '' }

function FaucetForm({ initial, onClose }: { initial: FaucetInput; onClose: () => void }) {
  const save = useSaveFaucet()
  const toast = useToast()
  const [form, setForm] = useState(initial)
  const [slugTouched, setSlugTouched] = useState(Boolean(initial.id))
  const set = <K extends keyof FaucetInput>(key: K, value: FaucetInput[K]) => setForm((current) => ({ ...current, [key]: value }))
  const valid = SLUG_PATTERN.test(form.slug) && form.name.trim().length >= 3 && form.reward >= 1 && form.reward <= 100_000_000
    && form.interval_minutes >= 5 && form.interval_minutes <= 1440 && form.daily_limit >= 1 && form.daily_limit <= 288
    && (form.ad_unit === '' || /^[0-9]{3,12}$/.test(form.ad_unit))

  const submit = (event?: FormEvent) => {
    event?.preventDefault()
    if (!valid) return
    save.mutate(form, {
      onSuccess: () => { toast(initial.id ? t('Faucet guardada.') : t('Faucet creada. Conecta tu API key de FaucetPay para activarla.'), 'success'); onClose() },
      onError: (error) => toast(faucetErrorMessage(error), 'error'),
    })
  }

  return <Dialog title={initial.id ? t('Editar faucet') : t('Nueva faucet')} onClose={onClose} actions={<>
    <Button variant="ghost" onClick={onClose}>{t('Cancelar')}</Button>
    <Button variant="primary" loading={save.isPending} disabled={!valid} onClick={() => submit()}>{initial.id ? t('Guardar') : t('Crear faucet')}</Button>
  </>}>
    <form className="form-grid" onSubmit={submit}>
      <div className="field"><label htmlFor="f-name">{t('Nombre')}</label>
        <input id="f-name" className="input" maxLength={60} value={form.name} onChange={(event) => { set('name', event.target.value); if (!slugTouched) set('slug', slugify(event.target.value)) }} /></div>
      <div className="field"><label htmlFor="f-slug">{t('Dirección web')}</label>
        <input id="f-slug" className="input mono-num" maxLength={40} value={form.slug} onChange={(event) => { setSlugTouched(true); set('slug', slugify(event.target.value)) }} />
        <span className="field-hint">{publicUrl(form.slug || 'mi-faucet')}</span></div>
      <div className="field"><label htmlFor="f-desc">{t('Descripción (opcional)')}</label>
        <textarea id="f-desc" className="textarea" rows={2} maxLength={300} value={form.description} onChange={(event) => set('description', event.target.value)} /></div>
      <div className="field"><label htmlFor="f-currency">{t('Moneda')}</label>
        <select id="f-currency" className="select" value={form.currency} onChange={(event) => set('currency', event.target.value as FaucetCurrency)}>
          {FAUCET_CURRENCIES.map((code) => <option key={code} value={code}>{code} · {CURRENCY_NAMES[code]}</option>)}
        </select>
        <span className="field-hint">{t('Debe coincidir con la moneda de la faucet que creaste en FaucetPay.')}</span></div>
      <div className="field"><label htmlFor="f-reward">{t('Recompensa por reclamo (en satoshis)')}</label>
        <input id="f-reward" className="input mono-num" inputMode="numeric" value={form.reward} onChange={(event) => set('reward', Number(event.target.value.replace(/\D/g, '').slice(0, 9)) || 0)} />
        <span className="field-hint">{t('= {amount}. 1 satoshi = 0,00000001.', { amount: formatCoin(form.reward, form.currency) })}</span></div>
      <div className="field"><label htmlFor="f-interval">{t('Minutos entre reclamos')}</label>
        <input id="f-interval" className="input mono-num" inputMode="numeric" value={form.interval_minutes} onChange={(event) => set('interval_minutes', Number(event.target.value.replace(/\D/g, '').slice(0, 4)) || 0)} />
        <span className="field-hint">{t('Entre 5 y 1440 minutos.')}</span></div>
      <div className="field"><label htmlFor="f-limit">{t('Reclamos por persona al día')}</label>
        <input id="f-limit" className="input mono-num" inputMode="numeric" value={form.daily_limit} onChange={(event) => set('daily_limit', Number(event.target.value.replace(/\D/g, '').slice(0, 3)) || 0)} />
        <span className="field-hint">{t('Coste máximo diario por persona: {amount}.', { amount: formatCoin(form.reward * form.daily_limit, form.currency) })}</span></div>
      <div className="field"><label htmlFor="f-ad">{t('Tu bloque de anuncios de A-ADS (opcional)')}</label>
        <input id="f-ad" className="input mono-num" inputMode="numeric" placeholder="2458862" value={form.ad_unit} onChange={(event) => set('ad_unit', event.target.value.replace(/\D/g, '').slice(0, 12))} />
        <span className="field-hint">{t('Tus anuncios se muestran en tu faucet y los ingresos son tuyos, salvo la parte de visitas de la plataforma.')}</span></div>
      <button type="submit" hidden />
    </form>
  </Dialog>
}

function KeyDialog({ faucet, onClose }: { faucet: MyFaucet; onClose: () => void }) {
  const key = useFaucetKey()
  const toast = useToast()
  const [apiKey, setApiKey] = useState('')
  const connect = () => key.mutate({ faucetId: faucet.id, apiKey: apiKey.trim() }, {
    onSuccess: (result) => { toast(t('API key conectada. Saldo de la faucet: {amount}.', { amount: formatCoin(result.balance, result.currency) }), 'success'); onClose() },
    onError: (error) => toast(faucetErrorMessage(error), 'error'),
  })
  return <Dialog title={t('Conectar FaucetPay')} onClose={onClose} actions={<>
    <Button variant="ghost" onClick={onClose}>{t('Cancelar')}</Button>
    <Button variant="primary" loading={key.isPending} disabled={apiKey.trim().length < 16} onClick={connect}>{t('Conectar')}</Button>
  </>}>
    <ol className="steps">
      <li><div><strong>{t('Crea una faucet en FaucetPay')}</strong><span>{t('En FaucetPay → Faucet Owner Dashboard → Create a new faucet, con la moneda {coin} y la dirección {url}.', { coin: faucet.currency, url: publicUrl(faucet.slug) })}</span></div></li>
      <li><div><strong>{t('Recárgala')}</strong><span>{t('Deposita {coin} en esa faucet de FaucetPay. Los pagos salen de ese saldo, que es solo tuyo.', { coin: faucet.currency })}</span></div></li>
      <li><div><strong>{t('Pega su API key aquí')}</strong><span>{t('La comprobamos con FaucetPay y la guardamos cifrada. Nunca se muestra en el navegador.')}</span></div></li>
    </ol>
    <div className="field" style={{ marginTop: 'var(--space-4)' }}><label htmlFor="api-key">{t('API key de la faucet')}</label>
      <input id="api-key" className="input mono-num" autoComplete="off" spellCheck={false} value={apiKey} onChange={(event) => setApiKey(event.target.value.trim())} autoFocus /></div>
    <p className="muted" style={{ fontSize: 'var(--text-xs)', marginTop: 'var(--space-2)' }}><a href={FAUCETPAY_URL} target="_blank" rel="noreferrer">{t('Abrir FaucetPay')} <ExternalLink size={11} /></a></p>
  </Dialog>
}

function FeatureDialog({ faucet, onClose }: { faucet: MyFaucet; onClose: () => void }) {
  const feature = useFeatureFaucet()
  const balance = useFaucetStatus()
  const toast = useToast()
  const [days, setDays] = useState(7)
  const now = useNow(60_000)
  const cost = days * FEATURE_POINTS_PER_DAY
  const points = balance.points ?? 0
  const confirm = () => feature.mutate({ id: faucet.id, days }, {
    onSuccess: (result) => { toast(t('Faucet destacada hasta el {date}.', { date: dateTime().format(new Date(result.featured_until)) }), 'success'); onClose() },
    onError: (error) => toast(faucetErrorMessage(error), 'error'),
  })
  return <Dialog title={t('Destacar faucet')} onClose={onClose} actions={<>
    <Button variant="ghost" onClick={onClose}>{t('Cancelar')}</Button>
    <Button variant="primary" loading={feature.isPending} disabled={points < cost || faucet.status !== 'active'} onClick={confirm}>{t('Pagar {points} puntos', { points: formatPoints(cost) })}</Button>
  </>}>
    <p className="muted">{t('Tu faucet aparece la primera del directorio con la insignia «Destacada». Cuesta {n} puntos (1 $) por día y se paga con tu saldo de {site}.', { n: formatPoints(FEATURE_POINTS_PER_DAY), site: siteName })}</p>
    <div className="tabs" role="radiogroup" aria-label={t('Días')} style={{ margin: 'var(--space-4) 0' }}>
      {[1, 3, 7, 14, 30].map((value) => <button key={value} type="button" role="radio" className="tab" aria-checked={days === value} aria-selected={days === value} onClick={() => setDays(value)}>{t('{n} días', { n: value })}</button>)}
    </div>
    <div className="info-grid">
      <div className="info-row"><span>{t('Coste')}</span><strong>{t('{n} puntos', { n: formatPoints(cost) })}</strong></div>
      <div className="info-row"><span>{t('Tu saldo')}</span><strong>{t('{n} puntos', { n: formatPoints(points) })}</strong></div>
      {faucet.featured_until && Date.parse(faucet.featured_until) > now && <div className="info-row"><span>{t('Destacada hasta')}</span><strong>{dateTime().format(new Date(faucet.featured_until))}</strong></div>}
    </div>
    {points < cost && <div style={{ marginTop: 'var(--space-3)' }}><Alert tone="info">{t('Gana más puntos con ofertas y encuestas para destacar tu faucet.')}</Alert></div>}
  </Dialog>
}

function ClaimsTable({ faucet }: { faucet: MyFaucet }) {
  const claims = useMyFaucetClaims(faucet.id)
  const format = dateTime()
  if (claims.isLoading) return <Skeleton height={80} />
  if (!claims.data?.length) return <p className="muted">{t('Todavía no hay reclamos.')}</p>
  return <div className="table-wrap"><table className="table">
    <thead><tr><th>{t('Fecha')}</th><th>{t('Destino')}</th><th className="num">{t('Importe')}</th><th>{t('Estado')}</th><th>{t('Id de FaucetPay')}</th></tr></thead>
    <tbody>{claims.data.map((row) => <tr key={row.id}>
      <td style={{ whiteSpace: 'nowrap' }}>{format.format(new Date(row.created_at))}</td>
      <td className="mono-num" style={{ wordBreak: 'break-all' }}>{row.address}</td>
      <td className="num mono-num">{formatSatoshi(row.amount)}{row.fee_amount > 0 && <span className="muted" style={{ display: 'block', fontSize: 11 }}>+{formatSatoshi(row.fee_amount)} {t('comisión')}</span>}</td>
      <td><Badge tone={row.status === 'paid' ? 'success' : row.status === 'failed' ? 'danger' : 'warning'}>{row.status === 'paid' ? t('Pagado') : row.status === 'failed' ? t('Fallido') : t('Pendiente')}</Badge>
        {row.error && <span className="muted" style={{ display: 'block', fontSize: 11 }}>{row.error}</span>}</td>
      <td className="mono-num">{row.payout_id ?? '—'}</td>
    </tr>)}</tbody>
  </table></div>
}

function FaucetCard({ faucet, onEdit, onKey, onFeature }: { faucet: MyFaucet; onEdit: () => void; onKey: () => void; onFeature: () => void }) {
  const status = useSetFaucetStatus()
  const key = useFaucetKey()
  const toast = useToast()
  const [showClaims, setShowClaims] = useState(false)
  const now = useNow(60_000)
  const featured = faucet.featured_until && Date.parse(faucet.featured_until) > now
  const lowFunds = faucet.has_key && faucet.last_balance !== null && faucet.last_balance < faucet.reward * 10

  const toggle = () => status.mutate({ id: faucet.id, status: faucet.status === 'active' ? 'paused' : 'active' }, {
    onSuccess: () => toast(faucet.status === 'active' ? t('Faucet en pausa.') : t('Faucet activa y visible en el directorio.'), 'success'),
    onError: (error) => toast(faucetErrorMessage(error), 'error'),
  })
  const refresh = () => key.mutate({ faucetId: faucet.id }, {
    onSuccess: (result) => toast(t('Saldo actualizado: {amount}.', { amount: formatCoin(result.balance, result.currency) })),
    onError: (error) => toast(faucetErrorMessage(error), 'error'),
  })
  const copy = () => { void navigator.clipboard?.writeText(publicUrl(faucet.slug)); toast(t('Enlace copiado al portapapeles.')) }

  return <Card>
    <CardHeader title={<span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>{faucet.name}<span className="faucet-coin">{faucet.currency}</span>
      <Badge tone={STATUS_TONE[faucet.status]}>{statusLabel(faucet.status)}</Badge>{featured && <Badge tone="accent">{t('Destacada')}</Badge>}</span>}
      description={<a href={publicUrl(faucet.slug)} target="_blank" rel="noreferrer" className="mono-num" style={{ wordBreak: 'break-all' }}>{publicUrl(faucet.slug)}</a>} />
    {faucet.status_reason && <Alert tone={faucet.status === 'banned' ? 'error' : 'warning'}>{faucet.status_reason}</Alert>}
    {!faucet.has_key && faucet.status !== 'banned' && <Alert tone="info">{t('Conecta la API key de tu faucet de FaucetPay para poder activarla.')}</Alert>}
    {lowFunds && <Alert tone="warning">{t('Queda saldo para menos de 10 reclamos. Recarga tu faucet en FaucetPay.')}</Alert>}
    <div className="grid-stats" style={{ marginTop: 'var(--space-4)' }}>
      <Stat label={t('Saldo en FaucetPay')} value={faucet.last_balance === null ? '—' : formatCoin(faucet.last_balance, faucet.currency)} hint={faucet.balance_checked_at ? dateTime().format(new Date(faucet.balance_checked_at)) : undefined} />
      <Stat label={t('Recompensa')} value={formatCoin(faucet.reward, faucet.currency)} hint={t('cada {n} min · {limit}/día', { n: faucet.interval_minutes, limit: faucet.daily_limit })} />
      <Stat label={t('Pagos')} value={formatSatoshi(faucet.claims_count)} />
      <Stat label={t('Total pagado')} value={formatCoin(faucet.paid_total, faucet.currency)} hint={faucet.fees_total > 0 ? t('+{amount} de comisión', { amount: formatCoin(faucet.fees_total, faucet.currency) }) : undefined} />
    </div>
    {faucet.status !== 'banned' && <div className="form-actions" style={{ marginTop: 'var(--space-4)' }}>
      <Button size="sm" onClick={onEdit}><Pencil size={14} />{t('Editar')}</Button>
      <Button size="sm" onClick={onKey}><KeyRound size={14} />{faucet.has_key ? t('Cambiar API key') : t('Conectar FaucetPay')}</Button>
      {faucet.has_key && <Button size="sm" loading={key.isPending} onClick={refresh}><RefreshCw size={14} />{t('Actualizar saldo')}</Button>}
      <Button size="sm" variant={faucet.status === 'active' ? 'secondary' : 'primary'} disabled={!faucet.has_key} loading={status.isPending} onClick={toggle}>
        {faucet.status === 'active' ? <><Pause size={14} />{t('Pausar')}</> : <><Play size={14} />{t('Activar')}</>}</Button>
      <Button size="sm" disabled={faucet.status !== 'active'} onClick={onFeature}><Rocket size={14} />{t('Destacar')}</Button>
      <Button size="sm" variant="ghost" onClick={copy}><Copy size={14} />{t('Copiar enlace')}</Button>
      <Button size="sm" variant="ghost" onClick={() => setShowClaims((value) => !value)}><ListOrdered size={14} />{showClaims ? t('Ocultar reclamos') : t('Ver reclamos')}</Button>
    </div>}
    {showClaims && <div style={{ marginTop: 'var(--space-4)' }}><ClaimsTable faucet={faucet} /></div>}
  </Card>
}

export default function MyFaucetsPage() {
  const user = useSessionUser()
  const mine = useMyFaucets()
  const [editing, setEditing] = useState<FaucetInput | null>(null)
  const [keyFor, setKeyFor] = useState<MyFaucet | null>(null)
  const [featureFor, setFeatureFor] = useState<MyFaucet | null>(null)
  const faucets = mine.data?.faucets ?? []
  const feePct = (mine.data?.fee_bps ?? 0) / 100

  const edit = (faucet: MyFaucet) => setEditing({
    id: faucet.id, slug: faucet.slug, name: faucet.name, description: faucet.description, currency: faucet.currency, reward: faucet.reward,
    interval_minutes: faucet.interval_minutes, daily_limit: faucet.daily_limit, ad_unit: faucet.ad_unit ?? '',
  })

  return <>
    <PageHeader title={t('Mis faucets')} description={t('Crea tu propia faucet de criptomonedas. Se paga desde tu cuenta de FaucetPay: {site} nunca toca tus fondos.', { site: siteName })}
      actions={<Button variant="primary" disabled={!user?.emailConfirmed || faucets.length >= 10} onClick={() => setEditing({ ...EMPTY })}><Plus size={16} />{t('Nueva faucet')}</Button>} />
    {user && !user.emailConfirmed && <Alert tone="warning">{t('Confirma tu correo electrónico antes de crear una faucet.')}</Alert>}

    <Card>
      <CardHeader title={t('Cómo funciona')} action={<Link to="/faucets" className="btn btn-ghost btn-sm">{t('Ver directorio')}<ExternalLink size={14} /></Link>} />
      <ol className="steps">
        <li><div><strong>{t('Crea tu faucet aquí')}</strong><span>{t('Elige moneda, recompensa y cada cuánto se puede reclamar.')}</span></div></li>
        <li><div><strong>{t('Conéctala con FaucetPay')}</strong><span>{t('Crea la misma faucet en FaucetPay, recárgala y pega su API key.')}</span></div></li>
        <li><div><strong>{t('Actívala y compártela')}</strong><span>{t('Aparece en el directorio público. Gana con tus anuncios de A-ADS en tu faucet.')}</span></div></li>
      </ol>
      <p className="muted" style={{ fontSize: 'var(--text-xs)', marginTop: 'var(--space-3)' }}>
        {t('Condiciones de la plataforma: el {pct} % de las visitas de tu faucet muestra anuncios de {site}.', { pct: mine.data?.ad_share_pct ?? 30, site: siteName })}
        {feePct > 0 && ` ${t('Además, cada pago incluye una comisión del {pct} % que se envía desde tu faucet a {site}.', { pct: feePct.toLocaleString(locale()), site: siteName })}`}
      </p>
    </Card>

    {mine.isLoading ? <Skeleton height={200} /> : mine.isError ? <Alert tone="error">{faucetErrorMessage(mine.error)}</Alert>
      : faucets.length === 0 ? <Card><EmptyState icon={<Droplets size={22} />} title={t('Aún no tienes faucets')} description={t('Crea la primera en un minuto.')}
        action={<Button variant="primary" size="sm" disabled={!user?.emailConfirmed} onClick={() => setEditing({ ...EMPTY })}><Plus size={14} />{t('Nueva faucet')}</Button>} /></Card>
        : faucets.map((faucet) => <FaucetCard key={faucet.id} faucet={faucet} onEdit={() => edit(faucet)} onKey={() => setKeyFor(faucet)} onFeature={() => setFeatureFor(faucet)} />)}

    {editing && <FaucetForm initial={editing} onClose={() => setEditing(null)} />}
    {keyFor && <KeyDialog faucet={keyFor} onClose={() => setKeyFor(null)} />}
    {featureFor && <FeatureDialog faucet={featureFor} onClose={() => setFeatureFor(null)} />}
  </>
}
