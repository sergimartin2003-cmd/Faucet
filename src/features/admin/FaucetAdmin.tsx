import { useState, type FormEvent } from 'react'
import { Ban, Download, Pause, Play, Save } from 'lucide-react'
import { Alert, Badge, Button, Card, CardHeader, EmptyState, Skeleton, Stat, Switch } from '../../ui'
import { useToast } from '../../ui/toastContext'
import { locale, t } from '../../lib/i18n'
import { formatPoints, toCsv } from '../../lib/game'
import { formatUsd, pointsToUsd } from '../../lib/payouts'
import {
  faucetErrorMessage, formatCoin, formatSatoshi, useAdminFaucetClaims, useAdminFaucets, useAdminPromotions, useAdminSetFaucetStatus,
  usePlatformRevenue, usePlatformSettings, useUpdatePlatformSettings, type AdminFaucetClaim, type PlatformSettings,
} from '../../lib/faucets'

const dateTime = () => new Intl.DateTimeFormat(locale(), { dateStyle: 'short', timeStyle: 'medium' })
const claimTone = (status: string) => (status === 'paid' ? 'success' : status === 'failed' ? 'danger' : 'warning')
const claimLabel = (status: string) => (status === 'paid' ? t('Pagado') : status === 'failed' ? t('Fallido') : status === 'none' ? '—' : t('Pendiente'))

function downloadCsv(name: string, rows: (string | number)[][]) {
  const url = URL.createObjectURL(new Blob([`﻿${toCsv(rows)}`], { type: 'text/csv;charset=utf-8' }))
  const link = Object.assign(document.createElement('a'), { href: url, download: name })
  link.click()
  URL.revokeObjectURL(url)
}

export function FaucetTransactions() {
  const [status, setStatus] = useState('')
  const claims = useAdminFaucetClaims(status)
  const format = dateTime()
  const filters = [{ value: '', label: t('Todas') }, { value: 'paid', label: t('Pagadas') }, { value: 'failed', label: t('Fallidas') }, { value: 'pending', label: t('Pendientes') }]

  const exportCsv = (rows: AdminFaucetClaim[]) => downloadCsv(`faucetfree-transacciones-${new Date().toISOString().slice(0, 10)}.csv`, [
    ['id', 'fecha', 'faucet', 'creador', 'destino', 'ip_hash', 'moneda', 'importe_satoshi', 'estado', 'payout_id', 'payout_user_hash', 'comision_satoshi', 'comision_destino', 'comision_estado', 'comision_payout_id', 'error', 'finalizado'],
    ...rows.map((row) => [row.id, row.created_at, row.faucet_slug, row.owner_email, row.address, row.ip_hash, row.currency, row.amount, row.status, row.payout_id ?? '', row.payout_user_hash ?? '',
      row.fee_amount, row.fee_recipient ?? '', row.fee_status, row.fee_payout_id ?? '', row.error ?? '', row.finished_at ?? '']),
  ])

  return <Card pad={false}>
    <div className="card-pad" style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
      <div className="tabs" role="tablist" aria-label={t('Estado')}>
        {filters.map((item) => <button key={item.value} type="button" role="tab" className="tab" aria-selected={status === item.value} onClick={() => setStatus(item.value)}>{item.label}</button>)}
      </div>
      <Button size="sm" disabled={!claims.data?.length} onClick={() => claims.data && exportCsv(claims.data)}><Download size={14} />{t('Exportar CSV')}</Button>
    </div>
    {claims.isLoading ? <div className="card-pad"><Skeleton height={120} /></div> : claims.isError ? <div className="card-pad"><Alert tone="error">{faucetErrorMessage(claims.error)}</Alert></div>
      : !claims.data?.length ? <EmptyState title={t('Sin transacciones')} description={t('Cada reclamo de cada faucet aparecerá aquí con todos sus datos.')} />
        : <div className="table-wrap"><table className="table admin-table">
          <thead><tr>
            <th>{t('Fecha')}</th><th>{t('Faucet')}</th><th>{t('Creador')}</th><th>{t('Destino del pago')}</th><th>{t('IP (cifrada)')}</th>
            <th className="num">{t('Importe')}</th><th>{t('Estado')}</th><th>{t('Id de FaucetPay')}</th><th className="num">{t('Comisión')}</th><th>{t('Detalle')}</th>
          </tr></thead>
          <tbody>{claims.data.map((row) => <tr key={row.id}>
            <td style={{ whiteSpace: 'nowrap' }}>{format.format(new Date(row.created_at))}<span className="muted mono-num" style={{ display: 'block', fontSize: 11 }}>#{row.id}</span></td>
            <td style={{ whiteSpace: 'nowrap' }}><a href={`/f/${row.faucet_slug}`} target="_blank" rel="noreferrer">{row.faucet_name}</a></td>
            <td>{row.owner_email}</td>
            <td className="mono-num" style={{ wordBreak: 'break-all', minWidth: 160 }}>{row.address}</td>
            <td className="mono-num" title={row.ip_hash}>{row.ip_hash.slice(0, 10)}…</td>
            <td className="num mono-num" style={{ whiteSpace: 'nowrap' }}>{formatCoin(row.amount, row.currency)}</td>
            <td><Badge tone={claimTone(row.status)}>{claimLabel(row.status)}</Badge></td>
            <td className="mono-num">{row.payout_id ?? '—'}{row.payout_user_hash && <span className="muted" style={{ display: 'block', fontSize: 11 }} title={row.payout_user_hash}>{t('usuario')} {row.payout_user_hash.slice(0, 10)}…</span>}</td>
            <td className="num mono-num" style={{ whiteSpace: 'nowrap' }}>{row.fee_amount > 0 ? <>{formatSatoshi(row.fee_amount)}<span className="muted" style={{ display: 'block', fontSize: 11 }}>{claimLabel(row.fee_status)}{row.fee_payout_id ? ` · ${row.fee_payout_id}` : ''}</span></> : '—'}</td>
            <td className="muted" style={{ fontSize: 12, minWidth: 160 }}>{row.error ?? (row.finished_at ? t('Completado {date}', { date: format.format(new Date(row.finished_at)) }) : '')}{row.fee_recipient && <span style={{ display: 'block' }}>{t('Comisión a')} {row.fee_recipient}</span>}</td>
          </tr>)}</tbody>
        </table></div>}
  </Card>
}

export function FaucetsAdmin() {
  const faucets = useAdminFaucets()
  const setStatus = useAdminSetFaucetStatus()
  const toast = useToast()

  const change = (id: string, status: 'active' | 'paused' | 'banned') => {
    const reason = status === 'banned' ? window.prompt(t('Motivo de la suspensión (lo verá el creador):')) ?? undefined : undefined
    if (status === 'banned' && reason === undefined) return
    setStatus.mutate({ id, status, reason }, {
      onSuccess: () => toast(t('Estado de la faucet actualizado.'), 'success'),
      onError: (error) => toast(faucetErrorMessage(error), 'error'),
    })
  }

  if (faucets.isLoading) return <Skeleton height={160} />
  if (faucets.isError) return <Alert tone="error">{faucetErrorMessage(faucets.error)}</Alert>
  if (!faucets.data?.length) return <Card><EmptyState title={t('Aún no hay faucets')} description={t('Las faucets que creen los usuarios aparecerán aquí.')} /></Card>
  return <Card pad={false}><div className="table-wrap"><table className="table admin-table">
    <thead><tr><th>{t('Faucet')}</th><th>{t('Creador')}</th><th>{t('Estado')}</th><th className="num">{t('Recompensa')}</th><th className="num">{t('Saldo')}</th><th className="num">{t('Pagos')}</th><th className="num">{t('Pagado')}</th><th className="num">{t('Comisiones')}</th><th /></tr></thead>
    <tbody>{faucets.data.map((faucet) => <tr key={faucet.id}>
      <td><a href={`/f/${faucet.slug}`} target="_blank" rel="noreferrer">{faucet.name}</a><span className="muted mono-num" style={{ display: 'block', fontSize: 11 }}>{faucet.slug} · {faucet.currency}{faucet.has_key ? '' : ` · ${t('sin API key')}`}</span></td>
      <td>{faucet.owner_email}</td>
      <td><Badge tone={faucet.status === 'active' ? 'success' : faucet.status === 'banned' ? 'danger' : 'warning'}>{faucet.status}</Badge>{faucet.status_reason && <span className="muted" style={{ display: 'block', fontSize: 11 }}>{faucet.status_reason}</span>}</td>
      <td className="num mono-num">{formatSatoshi(faucet.reward)}</td>
      <td className="num mono-num">{faucet.last_balance === null ? '—' : formatSatoshi(faucet.last_balance)}</td>
      <td className="num mono-num">{formatSatoshi(faucet.claims_count)}</td>
      <td className="num mono-num">{formatSatoshi(faucet.paid_total)}</td>
      <td className="num mono-num">{formatSatoshi(faucet.fees_total)}</td>
      <td style={{ whiteSpace: 'nowrap' }}>
        {faucet.status === 'active'
          ? <Button size="sm" variant="ghost" onClick={() => change(faucet.id, 'paused')} aria-label={t('Pausar')}><Pause size={14} /></Button>
          : faucet.has_key && <Button size="sm" variant="ghost" onClick={() => change(faucet.id, 'active')} aria-label={t('Activar')}><Play size={14} /></Button>}
        {faucet.status !== 'banned' && <Button size="sm" variant="ghost" onClick={() => change(faucet.id, 'banned')} aria-label={t('Suspender')}><Ban size={14} /></Button>}
      </td>
    </tr>)}</tbody>
  </table></div><p className="muted card-pad" style={{ fontSize: 12 }}>{t('Importes en satoshis (0,00000001) de la moneda de cada faucet.')}</p></Card>
}

function SettingsForm({ settings }: { settings: PlatformSettings }) {
  const update = useUpdatePlatformSettings()
  const toast = useToast()
  const [form, setForm] = useState({
    fee_pct: String(settings.fee_bps / 100), fee_enabled: settings.fee_enabled, fee_recipient: settings.fee_recipient ?? '',
    ad_share_pct: String(settings.ad_share_pct), platform_ad_unit: settings.platform_ad_unit ?? '',
  })
  const feeBps = Math.round(Number(form.fee_pct.replace(',', '.')) * 100)
  const adShare = Number(form.ad_share_pct)
  const valid = Number.isFinite(feeBps) && feeBps >= 0 && feeBps <= 3000 && Number.isInteger(adShare) && adShare >= 0 && adShare <= 100
    && (!form.fee_enabled || form.fee_recipient.trim() !== '') && (form.platform_ad_unit === '' || /^[0-9]{3,12}$/.test(form.platform_ad_unit))

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!valid) return
    update.mutate({ fee_bps: feeBps, fee_enabled: form.fee_enabled, fee_recipient: form.fee_recipient.trim() || null, ad_share_pct: adShare, platform_ad_unit: form.platform_ad_unit || null }, {
      onSuccess: () => toast(t('Ajustes de la plataforma guardados.'), 'success'),
      onError: (error) => toast(faucetErrorMessage(error), 'error'),
    })
  }

  return <form className="form-grid" onSubmit={submit}>
    <div className="setting">
      <div><strong>{t('Comisión por pago')}</strong><span>{t('Activa solo cuando FaucetPay te confirme por escrito que lo permite. Se envía desde la faucet del creador a tu cuenta de FaucetPay en cada reclamo.')}</span></div>
      <Switch label={t('Comisión por pago')} checked={form.fee_enabled} onChange={(value) => setForm((current) => ({ ...current, fee_enabled: value }))} />
    </div>
    <div className="field"><label htmlFor="fee-pct">{t('Comisión (%)')}</label>
      <input id="fee-pct" className="input mono-num" inputMode="decimal" value={form.fee_pct} onChange={(event) => setForm((current) => ({ ...current, fee_pct: event.target.value.replace(/[^0-9.,]/g, '') }))} />
      <span className="field-hint">{t('Entre 0 y 30 %. Se suma a la recompensa: el creador paga recompensa + comisión.')}</span></div>
    <div className="field"><label htmlFor="fee-to">{t('Tu cuenta de FaucetPay para la comisión')}</label>
      <input id="fee-to" className="input mono-num" placeholder={t('correo, usuario o dirección vinculada')} value={form.fee_recipient} onChange={(event) => setForm((current) => ({ ...current, fee_recipient: event.target.value }))} /></div>
    <div className="field"><label htmlFor="ad-share">{t('Visitas con tus anuncios (%)')}</label>
      <input id="ad-share" className="input mono-num" inputMode="numeric" value={form.ad_share_pct} onChange={(event) => setForm((current) => ({ ...current, ad_share_pct: event.target.value.replace(/\D/g, '').slice(0, 3) }))} />
      <span className="field-hint">{t('Porcentaje de banners de cada faucet que muestran tu bloque de A-ADS. Si el creador no tiene bloque, se muestra siempre el tuyo.')}</span></div>
    <div className="field"><label htmlFor="ad-unit">{t('Tu bloque de A-ADS en las faucets')}</label>
      <input id="ad-unit" className="input mono-num" inputMode="numeric" placeholder="2458862" value={form.platform_ad_unit} onChange={(event) => setForm((current) => ({ ...current, platform_ad_unit: event.target.value.replace(/\D/g, '').slice(0, 12) }))} />
      <span className="field-hint">{t('Si lo dejas vacío se usa el bloque general de la web.')}</span></div>
    <div className="form-actions"><Button type="submit" variant="primary" loading={update.isPending} disabled={!valid}><Save size={16} />{t('Guardar ajustes')}</Button></div>
  </form>
}

export function RevenueAdmin() {
  const revenue = usePlatformRevenue()
  const settings = usePlatformSettings()
  const promotions = useAdminPromotions()
  const data = revenue.data
  const format = dateTime()

  return <>
    {revenue.isError && <Alert tone="error">{faucetErrorMessage(revenue.error)}</Alert>}
    <div className="grid-stats">
      <Card><Stat label={t('Destacados vendidos')} value={data ? formatUsd(pointsToUsd(data.promotions_points)) : <Skeleton width={70} height={28} />} hint={data ? t('{n} compras · {month} este mes', { n: data.promotions_count, month: formatUsd(pointsToUsd(data.promotions_month_points)) }) : undefined} /></Card>
      <Card><Stat label={t('Faucets activas')} value={data ? `${data.faucets_active} / ${data.faucets_total}` : '—'} hint={data ? t('{n} pagos hoy', { n: formatSatoshi(data.claims_today) }) : undefined} /></Card>
      <Card><Stat label={t('Pagos de faucets')} value={data ? formatSatoshi(data.claims_paid) : '—'} hint={data ? t('{n} fallidos', { n: formatSatoshi(data.claims_failed) }) : undefined} /></Card>
      <Card><Stat label={t('Puntos en circulación')} value={data ? formatPoints(data.points_outstanding) : '—'} hint={data ? t('{amount} que podrías tener que pagar · {pending} pendiente de retiro', { amount: formatUsd(pointsToUsd(data.points_outstanding)), pending: formatUsd(data.withdrawals_pending_cents / 100) }) : undefined} /></Card>
    </div>
    <Card>
      <CardHeader title={t('Comisiones cobradas')} description={t('Enviadas desde las faucets de los creadores a tu cuenta de FaucetPay.')} />
      {!data ? <Skeleton height={60} /> : !data.fees.length ? <p className="muted">{t('Todavía no hay comisiones (la comisión está desactivada o no ha habido pagos).')}</p>
        : <div className="info-grid">{data.fees.map((fee) => <div key={fee.currency} className="info-row"><span>{fee.currency} · {t('{n} pagos', { n: formatSatoshi(fee.count) })}</span><strong>{formatCoin(fee.amount, fee.currency)}</strong></div>)}</div>}
    </Card>
    <Card>
      <CardHeader title={t('Ajustes de la plataforma')} description={t('Cómo gana dinero FaucetFree con las faucets de los creadores.')} />
      {settings.isLoading ? <Skeleton height={200} /> : settings.data && <SettingsForm key={settings.data.updated_at} settings={settings.data} />}
    </Card>
    <Card pad={false}>
      <div className="card-pad"><CardHeader title={t('Destacados comprados')} /></div>
      {promotions.isLoading ? <div className="card-pad"><Skeleton height={60} /></div> : !promotions.data?.length ? <EmptyState title={t('Sin compras todavía')} />
        : <div className="table-wrap"><table className="table"><thead><tr><th>{t('Fecha')}</th><th>{t('Faucet')}</th><th>{t('Creador')}</th><th className="num">{t('Días')}</th><th className="num">{t('Puntos')}</th><th>{t('Hasta')}</th></tr></thead>
          <tbody>{promotions.data.map((row) => <tr key={row.id}><td>{format.format(new Date(row.created_at))}</td><td>{row.faucet_name}</td><td>{row.owner_email}</td><td className="num">{row.days}</td><td className="num">{formatPoints(row.points)}</td><td>{format.format(new Date(row.featured_until))}</td></tr>)}</tbody>
        </table></div>}
    </Card>
  </>
}
