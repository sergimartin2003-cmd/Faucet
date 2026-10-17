import { useState } from 'react'
import { Check, Copy, ShieldAlert, X } from 'lucide-react'
import { Alert, Badge, Button, Card, CardHeader, Dialog, EmptyState, PageHeader, Skeleton } from '../../ui'
import { useToast } from '../../ui/toastContext'
import { formatPoints } from '../../lib/game'
import { useAdminWithdrawals, useIsAdmin, useProcessWithdrawal, withdrawalErrorMessage, type AdminWithdrawal } from '../../lib/queries'
import { STATUS_LABELS, WITHDRAWAL_METHODS, explorerUrl, formatUsd, type WithdrawalStatus } from '../../lib/payouts'

const FILTERS: { value: WithdrawalStatus | 'all'; label: string }[] = [
  { value: 'pending', label: 'Pendientes' },
  { value: 'paid', label: 'Pagados' },
  { value: 'rejected', label: 'Rechazados' },
  { value: 'all', label: 'Todos' },
]
const dateTime = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' })
const DAY_MS = 86_400_000

// Signals worth a second look before paying.
function warnings(row: AdminWithdrawal) {
  const list: string[] = []
  if (Date.now() - Date.parse(row.account_created_at) < 3 * DAY_MS) list.push('Cuenta de menos de 3 días')
  if (row.reversed_points > 0) list.push(`${formatPoints(row.reversed_points)} pts anulados por el proveedor`)
  if (row.casino_net > 0 && row.casino_net >= row.offer_points) list.push('Gana más en el casino que en ofertas')
  if (row.points > row.offer_points + Math.max(0, row.casino_net) + 2000) list.push('Retira más de lo que ha ganado')
  return list
}

function ProcessDialog({ row, action, onClose }: { row: AdminWithdrawal; action: 'paid' | 'rejected'; onClose: () => void }) {
  const process = useProcessWithdrawal()
  const toast = useToast()
  const [txRef, setTxRef] = useState('')
  const [note, setNote] = useState('')
  const paid = action === 'paid'

  const confirm = () => process.mutate({ id: row.id, action, txRef: paid ? txRef : undefined, note }, {
    onSuccess: () => { toast(paid ? 'Retiro marcado como pagado.' : 'Retiro rechazado y puntos devueltos.', 'success'); onClose() },
    onError: (error) => toast(withdrawalErrorMessage(error), 'error'),
  })

  return <Dialog title={paid ? 'Marcar como pagado' : 'Rechazar retiro'} onClose={onClose} actions={<>
    <Button variant="ghost" onClick={onClose}>Cancelar</Button>
    <Button variant={paid ? 'primary' : 'danger'} loading={process.isPending} disabled={paid && !txRef.trim()} onClick={confirm}>{paid ? 'Confirmar pago' : 'Rechazar'}</Button>
  </>}>
    <p className="muted">{formatUsd(row.usd_cents / 100)} en {WITHDRAWAL_METHODS[row.method]?.label} para {row.email}.</p>
    {paid
      ? <div className="field"><label htmlFor="tx-ref">Hash de la transacción o referencia del pago</label>
        <input id="tx-ref" className="input mono-num" value={txRef} onChange={(event) => setTxRef(event.target.value)} maxLength={200} autoFocus /></div>
      : <p className="muted">Los {formatPoints(row.points)} puntos vuelven al saldo del usuario.</p>}
    <div className="field"><label htmlFor="admin-note">Nota para el usuario (opcional)</label>
      <input id="admin-note" className="input" value={note} onChange={(event) => setNote(event.target.value)} maxLength={300} /></div>
  </Dialog>
}

export default function AdminPage() {
  const isAdmin = useIsAdmin()
  const [filter, setFilter] = useState<WithdrawalStatus | 'all'>('pending')
  const list = useAdminWithdrawals(filter)
  const toast = useToast()
  const [dialog, setDialog] = useState<{ row: AdminWithdrawal; action: 'paid' | 'rejected' } | null>(null)

  if (isAdmin.isLoading) return <Skeleton height={200} />
  if (!isAdmin.data) return <EmptyState icon={<ShieldAlert size={20} />} title="Acceso restringido" description="Esta sección es solo para administradores." />

  const copy = (value: string) => { void navigator.clipboard?.writeText(value); toast('Copiado') }
  const pendingTotal = filter === 'pending' ? (list.data ?? []).reduce((sum, row) => sum + row.usd_cents, 0) / 100 : null

  return <>
    <PageHeader title="Administración" description="Paga cada retiro desde tu exchange o wallet y márcalo como pagado con el hash de la transacción. Si lo rechazas, los puntos vuelven al usuario." />
    <div className="tabs" role="tablist" aria-label="Estado">
      {FILTERS.map((item) => <button key={item.value} type="button" role="tab" className="tab" aria-selected={filter === item.value} onClick={() => setFilter(item.value)}>{item.label}</button>)}
    </div>
    {pendingTotal !== null && list.data && list.data.length > 0 && <Alert tone="info">{list.data.length} retiros pendientes por un total de {formatUsd(pendingTotal)}.</Alert>}
    {list.isLoading ? <Skeleton height={160} /> : list.isError ? <Alert tone="error">{withdrawalErrorMessage(list.error)}</Alert>
      : !list.data?.length ? <Card><EmptyState icon={<Check size={20} />} title="Nada por aquí" description="No hay retiros con este estado." /></Card>
        : list.data.map((row) => {
          const flags = warnings(row)
          const link = explorerUrl(row.method, row.tx_ref)
          const method = WITHDRAWAL_METHODS[row.method]
          return <Card key={row.id}>
            <CardHeader
              title={<>{formatUsd(row.usd_cents / 100)} · {method?.label ?? row.method}</>}
              description={<>{row.email} · {dateTime.format(new Date(row.created_at))}</>}
              action={<Badge tone={row.status === 'pending' ? 'warning' : row.status === 'paid' ? 'success' : 'danger'}>{STATUS_LABELS[row.status]}</Badge>} />
            <div className="info-grid">
              <div className="info-row"><span>Red</span><strong>{method?.network ?? row.method}</strong></div>
              <div className="info-row"><span>Destino</span><strong className="mono-num" style={{ wordBreak: 'break-all', display: 'flex', gap: 6, alignItems: 'center' }}>{row.address}
                <button type="button" className="icon-button" aria-label="Copiar destino" onClick={() => copy(row.address)}><Copy size={14} /></button></strong></div>
              <div className="info-row"><span>Puntos</span><strong>{formatPoints(row.points)}</strong></div>
              <div className="info-row"><span>Ganado en ofertas</span><strong>{formatPoints(row.offer_points)} pts</strong></div>
              <div className="info-row"><span>Resultado en el casino</span><strong>{row.casino_net >= 0 ? '+' : ''}{formatPoints(row.casino_net)} pts</strong></div>
              <div className="info-row"><span>Ya retirado</span><strong>{formatPoints(row.paid_points)} pts</strong></div>
              <div className="info-row"><span>Saldo actual</span><strong>{formatPoints(row.balance)} pts</strong></div>
              <div className="info-row"><span>Cuenta creada</span><strong>{dateTime.format(new Date(row.account_created_at))}</strong></div>
              {row.tx_ref && <div className="info-row"><span>Referencia</span><strong className="mono-num" style={{ wordBreak: 'break-all' }}>{link ? <a href={link} target="_blank" rel="noreferrer">{row.tx_ref}</a> : row.tx_ref}</strong></div>}
              {row.note && <div className="info-row"><span>Nota</span><strong>{row.note}</strong></div>}
            </div>
            {flags.length > 0 && <div style={{ marginTop: 'var(--space-3)' }}><Alert tone="warning">{flags.join(' · ')}</Alert></div>}
            {row.status === 'pending' && <div className="form-actions" style={{ marginTop: 'var(--space-4)' }}>
              <Button variant="danger" onClick={() => setDialog({ row, action: 'rejected' })}><X size={16} />Rechazar</Button>
              <Button variant="primary" onClick={() => setDialog({ row, action: 'paid' })}><Check size={16} />Marcar pagado</Button>
            </div>}
          </Card>
        })}
    {dialog && <ProcessDialog row={dialog.row} action={dialog.action} onClose={() => setDialog(null)} />}
  </>
}
