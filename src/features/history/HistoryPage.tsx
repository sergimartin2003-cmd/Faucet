import { useState } from 'react'
import { Download, History } from 'lucide-react'
import { Alert, Button, Card, EmptyState, PageHeader, Skeleton } from '../../ui'
import { useToast } from '../../ui/toastContext'
import { describeLedgerEntry, formatPoints, toCsv } from '../../lib/game'
import { useHistory, type HistoryEntry } from '../../lib/queries'
import { supabase } from '../../lib/supabase'

const FILTERS = [
  { value: '', label: 'Todo' },
  { value: 'daily_faucet', label: 'Faucet' },
  { value: 'earn_task', label: 'Tareas' },
  { value: 'referral', label: 'Referidos' },
]

const dateTime = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' })

async function fetchAll(source: string): Promise<HistoryEntry[]> {
  if (!supabase) return []
  const rows: HistoryEntry[] = []
  for (let offset = 0; offset < 5000; offset += 200) {
    const { data, error } = await supabase.rpc('get_reward_history', { p_limit: 200, p_offset: offset, p_source: source || null })
    if (error) throw error
    const page = (data ?? []) as HistoryEntry[]
    rows.push(...page)
    if (page.length < 200) break
  }
  return rows
}

export default function HistoryPage() {
  const [source, setSource] = useState('')
  const [exporting, setExporting] = useState(false)
  const history = useHistory(source)
  const toast = useToast()
  const rows = history.data?.pages.flat() ?? []

  const exportCsv = async () => {
    setExporting(true)
    try {
      const all = await fetchAll(source)
      const csv = toCsv([['Fecha (UTC)', 'Concepto', 'Puntos', 'Saldo posterior'], ...all.map((row) => [row.created_at, describeLedgerEntry(row.source_type, row.detail), row.points, row.balance_after])])
      const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }))
      const link = Object.assign(document.createElement('a'), { href: url, download: `faucet-historial-${new Date().toISOString().slice(0, 10)}.csv` })
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      toast('No se pudo exportar el historial.', 'error')
    } finally {
      setExporting(false)
    }
  }

  return <>
    <PageHeader title="Historial de puntos" description="Todos los movimientos de tu saldo, del más reciente al más antiguo."
      actions={<Button size="sm" loading={exporting} disabled={rows.length === 0} onClick={() => void exportCsv()}><Download size={14} />Exportar CSV</Button>} />
    <div className="tabs" role="tablist" style={{ justifySelf: 'start' }}>
      {FILTERS.map((filter) => <button key={filter.value} role="tab" className="tab" aria-selected={source === filter.value} onClick={() => setSource(filter.value)}>{filter.label}</button>)}
    </div>
    {history.isError && <Alert tone="error">No se pudo cargar el historial. Inténtalo de nuevo en unos minutos.</Alert>}
    <Card pad={false}>
      {history.isLoading ? <div className="stack" style={{ padding: 'var(--space-5)' }}>{[0, 1, 2, 3, 4].map((key) => <Skeleton key={key} height={32} />)}</div>
        : rows.length === 0 ? <EmptyState icon={<History size={22} />} title="Sin movimientos" description="Cuando recibas puntos aparecerán aquí." />
          : <div className="table-wrap"><table className="table">
            <thead><tr><th>Fecha</th><th>Concepto</th><th className="num">Puntos</th><th className="num">Saldo</th></tr></thead>
            <tbody>{rows.map((row) => <tr key={row.id}>
              <td style={{ whiteSpace: 'nowrap' }}>{dateTime.format(new Date(row.created_at))}</td>
              <td>{describeLedgerEntry(row.source_type, row.detail)}</td>
              <td className="num positive">+{formatPoints(row.points)}</td>
              <td className="num muted">{formatPoints(row.balance_after)}</td>
            </tr>)}</tbody>
          </table></div>}
    </Card>
    {history.hasNextPage && <Button style={{ justifySelf: 'center' }} loading={history.isFetchingNextPage} onClick={() => void history.fetchNextPage()}>Cargar más</Button>}
  </>
}
