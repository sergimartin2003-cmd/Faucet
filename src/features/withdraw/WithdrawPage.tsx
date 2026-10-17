import { useState, type FormEvent } from 'react'
import { ArrowUpRight, Clock, ShieldCheck, Wallet } from 'lucide-react'
import { Alert, Badge, Button, Card, CardHeader, EmptyState, PageHeader, ProgressBar, Skeleton, Stat } from '../../ui'
import { useToast } from '../../ui/toastContext'
import Link from '../../lib/Link'
import { formatPoints } from '../../lib/game'
import { locale, t } from '../../lib/i18n'
import { useRequestWithdrawal, useWithdrawals, withdrawalErrorMessage } from '../../lib/queries'
import {
  METHOD_ORDER, MIN_WITHDRAWAL_POINTS, POINTS_PER_USD, STATUS_LABELS, WITHDRAWAL_METHODS,
  explorerUrl, formatUsd, isValidAddress, pointsToUsd, type WithdrawalMethod, type WithdrawalStatus,
} from '../../lib/payouts'
import { useSessionUser } from '../../app/sessionContext'
import { useFaucetStatus } from '../faucet/useFaucetStatus'

const STATUS_TONES: Record<WithdrawalStatus, 'warning' | 'success' | 'danger'> = { pending: 'warning', paid: 'success', rejected: 'danger' }
const shorten = (value: string) => (value.length > 18 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value)

export default function WithdrawPage() {
  const user = useSessionUser()
  const balance = useFaucetStatus()
  const history = useWithdrawals()
  const request = useRequestWithdrawal()
  const toast = useToast()
  const dateTime = new Intl.DateTimeFormat(locale(), { dateStyle: 'medium', timeStyle: 'short' })
  const [method, setMethod] = useState<WithdrawalMethod>('usdt_bep20')
  const [address, setAddress] = useState('')
  const [amount, setAmount] = useState('')

  const points = balance.points ?? 0
  const pending = history.data?.find((row) => row.status === 'pending')
  const value = amount === '' ? 0 : Number(amount)
  const info = WITHDRAWAL_METHODS[method]
  const addressOk = isValidAddress(method, address)
  const amountOk = Number.isInteger(value) && value >= MIN_WITHDRAWAL_POINTS && value <= points
  const canSubmit = Boolean(user?.emailConfirmed) && !pending && addressOk && amountOk

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!canSubmit) return
    request.mutate({ points: value, method, address }, {
      onSuccess: () => {
        toast(t('Retiro de {amount} solicitado. Te avisaremos aquí cuando se pague.', { amount: formatUsd(pointsToUsd(value)) }), 'success')
        setAmount('')
      },
      onError: (error) => toast(withdrawalErrorMessage(error), 'error'),
    })
  }

  return <>
    <PageHeader title={t('Retirar')} description={t('Cambia tus puntos por criptomonedas. {rate} puntos = 1 USD; mínimo {min} puntos ({amount}).', { rate: formatPoints(POINTS_PER_USD), min: formatPoints(MIN_WITHDRAWAL_POINTS), amount: formatUsd(pointsToUsd(MIN_WITHDRAWAL_POINTS)) })} />

    <div className="grid-stats grid-stats-3">
      <Card><Stat label={t('Saldo')} value={balance.isLoading ? <Skeleton width={80} height={28} /> : formatPoints(points)} unit={t('puntos')} hint={formatUsd(pointsToUsd(points))} /></Card>
      <Card><Stat label={t('Mínimo para retirar')} value={formatPoints(MIN_WITHDRAWAL_POINTS)} unit={t('puntos')}
        hint={points >= MIN_WITHDRAWAL_POINTS ? t('Ya puedes retirar') : <><ProgressBar value={(points / MIN_WITHDRAWAL_POINTS) * 100} label={t('Progreso hasta el mínimo')} /><span style={{ display: 'block', marginTop: 6 }}>{t('Te faltan {points}', { points: formatPoints(MIN_WITHDRAWAL_POINTS - points) })}</span></>} /></Card>
      <Card><Stat label={t('Retirado')} value={history.data ? formatUsd(history.data.filter((row) => row.status === 'paid').reduce((sum, row) => sum + row.usd_cents, 0) / 100) : '—'} hint={t('Pagos completados')} /></Card>
    </div>

    <Card>
      <CardHeader title={t('Solicitar un retiro')} description={t('Revisamos cada solicitud a mano para evitar fraudes y la pagamos normalmente en menos de 48 horas.')} />
      {user && !user.emailConfirmed && <Alert tone="warning">{t('Confirma tu correo electrónico antes de retirar.')}</Alert>}
      {pending && <Alert tone="info">{t('Tienes un retiro de {amount} pendiente. Podrás pedir otro cuando se procese.', { amount: formatUsd(pending.usd_cents / 100) })}</Alert>}
      {pending ? null : points < MIN_WITHDRAWAL_POINTS
        ? <EmptyState icon={<Wallet size={20} />} title={t('Aún no llegas al mínimo')} description={t('Completa ofertas y encuestas para reunir {points} puntos.', { points: formatPoints(MIN_WITHDRAWAL_POINTS) })}
          action={<Link to="/dashboard/ofertas" className="btn btn-primary btn-sm">{t('Ganar puntos')}<ArrowUpRight size={14} /></Link>} />
        : <form className="form-grid" onSubmit={submit} style={{ marginTop: user && !user.emailConfirmed ? 'var(--space-4)' : 0 }}>
          <div className="field">
            <label htmlFor="withdraw-method">{t('Moneda')}</label>
            <select id="withdraw-method" className="select" value={method} onChange={(event) => setMethod(event.target.value as WithdrawalMethod)}>
              {METHOD_ORDER.map((key) => <option key={key} value={key}>{WITHDRAWAL_METHODS[key].label} · {WITHDRAWAL_METHODS[key].network}</option>)}
            </select>
            <span className="field-hint">{t('Recibes el equivalente en dólares en la moneda elegida, al cambio del momento del pago.')}</span>
          </div>
          <div className="field">
            <label htmlFor="withdraw-address">{info.addressLabel}</label>
            <input id="withdraw-address" className="input mono-num" autoComplete="off" spellCheck={false} placeholder={info.placeholder} value={address}
              onChange={(event) => setAddress(event.target.value.trim())} aria-invalid={address !== '' && !addressOk} />
            {address !== '' && !addressOk
              ? <span className="field-hint" style={{ color: 'var(--danger)' }}>{t('No parece una dirección de {network}.', { network: info.network })}</span>
              : <span className="field-hint">{t('Comprueba que es de la red {network}. Un envío a una dirección equivocada no se puede recuperar.', { network: info.network })}</span>}
          </div>
          <div className="field">
            <label htmlFor="withdraw-amount">{t('Puntos a retirar')}</label>
            <div className="copy-row">
              <input id="withdraw-amount" className="input mono-num" inputMode="numeric" placeholder={String(MIN_WITHDRAWAL_POINTS)} value={amount}
                onChange={(event) => setAmount(event.target.value.replace(/\D/g, '').slice(0, 9))} />
              <Button type="button" onClick={() => setAmount(String(points))}>{t('Todo')}</Button>
            </div>
            <span className="field-hint">{value > 0 ? t('Recibirás {amount}.', { amount: formatUsd(pointsToUsd(value)) }) : t('Entre {min} y {max} puntos.', { min: formatPoints(MIN_WITHDRAWAL_POINTS), max: formatPoints(points) })}</span>
          </div>
          <div className="form-actions"><Button type="submit" variant="primary" disabled={!canSubmit} loading={request.isPending}><Wallet size={16} />{t('Solicitar retiro')}</Button></div>
        </form>}
    </Card>

    <Card>
      <CardHeader title={t('Tus retiros')} />
      {history.isLoading ? <Skeleton height={80} /> : history.isError ? <Alert tone="error">{withdrawalErrorMessage(history.error)}</Alert>
        : !history.data?.length ? <EmptyState icon={<Clock size={20} />} title={t('Sin retiros todavía')} description={t('Cuando pidas un retiro aparecerá aquí con su estado.')} />
          : <div className="table-wrap"><table className="table">
            <thead><tr><th>{t('Fecha')}</th><th>{t('Cantidad')}</th><th>{t('Moneda')}</th><th>{t('Destino')}</th><th>{t('Estado')}</th></tr></thead>
            <tbody>{history.data.map((row) => {
              const link = explorerUrl(row.method, row.tx_ref)
              return <tr key={row.id}>
                <td>{dateTime.format(new Date(row.created_at))}</td>
                <td className="mono-num">{formatUsd(row.usd_cents / 100)}<span className="muted" style={{ display: 'block', fontSize: 12 }}>{formatPoints(row.points)} pts</span></td>
                <td>{WITHDRAWAL_METHODS[row.method]?.label ?? row.method}</td>
                <td className="mono-num" title={row.address}>{shorten(row.address)}</td>
                <td>
                  <Badge tone={STATUS_TONES[row.status]}>{STATUS_LABELS[row.status]}</Badge>
                  {link && <a href={link} target="_blank" rel="noreferrer" className="muted" style={{ display: 'block', fontSize: 12, marginTop: 4 }}>{t('Ver transacción')}</a>}
                  {!link && row.status === 'paid' && row.tx_ref && <span className="muted mono-num" style={{ display: 'block', fontSize: 12, marginTop: 4 }}>{t('Ref. {ref}', { ref: shorten(row.tx_ref) })}</span>}
                  {row.status === 'rejected' && <span className="muted" style={{ display: 'block', fontSize: 12, marginTop: 4 }}>{t('Puntos devueltos')}{row.note ? `: ${row.note}` : ''}</span>}
                </td>
              </tr>
            })}</tbody>
          </table></div>}
    </Card>

    <p className="footnote"><ShieldCheck size={14} />{t('Si un proveedor anula una oferta, sus puntos se descuentan del saldo. Las cuentas duplicadas, VPN o fraudes suponen el rechazo del retiro y el cierre de la cuenta.')}</p>
  </>
}
