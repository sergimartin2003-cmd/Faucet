import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import Link from '../../lib/Link'
import { Button, Card, EmptyState, PageHeader, Skeleton } from '../../ui'
import { GAME_LABELS, formatMultiplier, type CasinoGame } from '../../lib/casino'
import { formatPoints } from '../../lib/game'
import { casinoErrorMessage, useCasinoBets, verifyLink } from './api'
import './casino.css'

const dateTime = new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'medium' })

export default function CasinoHistoryPage() {
  const [game, setGame] = useState<CasinoGame | ''>('')
  const bets = useCasinoBets(game)
  const rows = bets.data?.pages.flat() ?? []

  return <>
    <PageHeader title="Mis apuestas" description="Todas tus jugadas del casino, de la más reciente a la más antigua. Cada una se puede verificar con sus semillas."
      actions={<select className="select" style={{ width: 200 }} value={game} onChange={(event) => setGame(event.target.value as CasinoGame | '')} aria-label="Filtrar por juego">
        <option value="">Todos los juegos</option>
        {(Object.keys(GAME_LABELS) as CasinoGame[]).map((key) => <option key={key} value={key}>{GAME_LABELS[key]}</option>)}
      </select>} />
    <Card pad={false}>
      {bets.isLoading ? <div className="card-pad"><Skeleton height={240} /></div>
        : bets.isError ? <div className="card-pad muted">{casinoErrorMessage(bets.error)}</div>
        : rows.length === 0 ? <EmptyState title="Aún no hay jugadas" description="Cuando juegues en el casino, tus apuestas aparecerán aquí." action={<Link to="/dashboard/casino" className="btn btn-primary btn-sm">Ir al casino</Link>} />
        : <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Fecha</th><th>Juego</th><th>Apuesta</th><th>Multiplicador</th><th>Pago</th><th>Balance</th><th>Nonce</th><th /></tr></thead>
            <tbody>{rows.map((row) => <tr key={row.id}>
              <td className="muted">{dateTime.format(new Date(row.created_at))}</td>
              <td>{GAME_LABELS[row.game]}</td>
              <td className="mono-num">{formatPoints(row.bet)}</td>
              <td className="mono-num">{formatMultiplier(Number(row.multiplier))}</td>
              <td className="mono-num">{formatPoints(row.payout)}</td>
              <td className={`mono-num ${row.payout > row.bet ? 'text-win' : row.payout < row.bet ? 'text-loss' : ''}`}>{row.payout - row.bet > 0 ? '+' : ''}{formatPoints(row.payout - row.bet)}</td>
              <td className="mono-num muted">{row.nonce}</td>
              <td><Link to={verifyLink(row)} className="btn btn-ghost btn-sm" aria-label="Verificar jugada"><ShieldCheck size={14} /></Link></td>
            </tr>)}</tbody>
          </table>
        </div>}
    </Card>
    {bets.hasNextPage && <Button onClick={() => void bets.fetchNextPage()} loading={bets.isFetchingNextPage}>Cargar más</Button>}
  </>
}
