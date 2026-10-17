import type { ReactNode } from 'react'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import Link from '../../lib/Link'
import { formatPoints } from '../../lib/game'
import { MAX_BET, MIN_BET, formatMultiplier, gameLabel, type CasinoGame } from '../../lib/casino'
import { locale, t } from '../../lib/i18n'
import { Alert, PageHeader, Skeleton } from '../../ui'
import { useFaucetStatus } from '../faucet/useFaucetStatus'
import { useSessionUser } from '../../app/sessionContext'
import { useCasinoBets, verifyLink } from './api'
import './casino.css'

export function GameHeader({ game, description }: { game: CasinoGame; description: string }) {
  return <PageHeader
    title={gameLabel(game)}
    description={description}
    actions={<Link to="/dashboard/casino" className="btn btn-ghost btn-sm"><ArrowLeft size={14} />{t('Todos los juegos')}</Link>}
  />
}

export function GameLayout({ controls, stage, below }: { controls: ReactNode; stage: ReactNode; below?: ReactNode }) {
  return <div className="stack">
    <CasinoNotices />
    <div className="game-layout">
      <aside className="game-controls card card-pad">{controls}</aside>
      <section className="game-stage card">{stage}</section>
    </div>
    {below}
  </div>
}

function CasinoNotices() {
  const user = useSessionUser()
  if (user && !user.emailConfirmed) return <Alert tone="warning">{t('Confirma tu correo electrónico para poder jugar en el casino.')}</Alert>
  return null
}

export function BetInput({ value, onChange, disabled, label = t('Apuesta') }: { value: number; onChange: (value: number) => void; disabled?: boolean; label?: string }) {
  const { points } = useFaucetStatus()
  const balance = points ?? 0
  const clamp = (next: number) => Math.max(MIN_BET, Math.min(MAX_BET, Math.floor(Number.isFinite(next) ? next : MIN_BET)))
  const tooHigh = points !== null && value > balance
  return <div className="field">
    <div className="row-between" style={{ flexWrap: 'nowrap' }}>
      <label htmlFor="bet-amount">{label}</label>
      <span className="field-hint">{t('Saldo: {points}', { points: points === null ? '—' : formatPoints(balance) })}</span>
    </div>
    <div className="bet-input">
      <input id="bet-amount" className="input mono-num" type="number" inputMode="numeric" min={MIN_BET} max={MAX_BET} step={1} value={value} disabled={disabled}
        onChange={(event) => onChange(clamp(Number(event.target.value)))} />
      <button type="button" className="btn btn-secondary btn-sm" disabled={disabled} onClick={() => onChange(clamp(value / 2))}>½</button>
      <button type="button" className="btn btn-secondary btn-sm" disabled={disabled} onClick={() => onChange(clamp(value * 2))}>2×</button>
      <button type="button" className="btn btn-secondary btn-sm" disabled={disabled || balance < MIN_BET} onClick={() => onChange(clamp(balance))}>{t('Máx')}</button>
    </div>
    {tooHigh && <span className="field-hint" style={{ color: 'var(--danger)' }}>{t('No tienes puntos suficientes.')}</span>}
  </div>
}

export function Segmented<T extends string | number>({ value, options, onChange, disabled, label }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (value: T) => void; disabled?: boolean; label: string }) {
  return <div className="field">
    <span className="field-label">{label}</span>
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((option) => <button key={String(option.value)} type="button" role="radio" aria-checked={option.value === value} disabled={disabled}
        className="segmented-item" onClick={() => onChange(option.value)}>{option.label}</button>)}
    </div>
  </div>
}

export function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return <div className="info-row"><span>{label}</span><strong className="mono-num">{value}</strong></div>
}

export function Outcome({ bet, payout, multiplier, label }: { bet: number; payout: number; multiplier?: number; label?: string }) {
  const profit = payout - bet
  const text = profit > 0 ? `+${formatPoints(profit)}` : payout > 0 ? t('Recuperas {points}', { points: formatPoints(payout) }) : label ?? t('Sin premio')
  return <div className={`outcome ${profit > 0 ? 'is-win' : payout > 0 ? 'is-partial' : 'is-loss'}`} role="status">
    <strong>{text}</strong>
    {multiplier !== undefined && <span>{formatMultiplier(multiplier)}</span>}
    {profit <= 0 && payout > 0 && label && <span>{label}</span>}
  </div>
}

export function RecentBets({ game }: { game: CasinoGame }) {
  const bets = useCasinoBets(game, 10)
  const rows = bets.data?.pages[0] ?? []
  const timeFormat = new Intl.DateTimeFormat(locale(), { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  return <section className="card card-pad">
    <div className="row-between" style={{ marginBottom: 'var(--space-3)' }}>
      <h2 className="card-title">{t('Tus últimas jugadas')}</h2>
      <div className="head-links">
        <Link to="/dashboard/casino/apuestas" className="link-button">{t('Ver todas')}</Link>
        <Link to="/dashboard/casino/juego-justo" className="link-button head-links"><ShieldCheck size={14} />{t('Verificar')}</Link>
      </div>
    </div>
    {bets.isLoading ? <Skeleton height={120} /> : rows.length === 0 ? <p className="muted">{t('Todavía no has jugado a {game}.', { game: gameLabel(game).toLowerCase() })}</p> : <div className="table-wrap">
      <table className="table bets-table">
        <thead><tr><th>{t('Hora')}</th><th>{t('Apuesta')}</th><th>{t('Multiplicador')}</th><th>{t('Resultado')}</th><th /></tr></thead>
        <tbody>{rows.map((row) => <tr key={row.id}>
          <td className="muted">{timeFormat.format(new Date(row.created_at))}</td>
          <td className="mono-num">{formatPoints(row.bet)}</td>
          <td className="mono-num">{formatMultiplier(Number(row.multiplier))}</td>
          <td className={`mono-num ${row.payout > row.bet ? 'text-win' : row.payout === row.bet ? '' : 'text-loss'}`}>{row.payout - row.bet >= 0 ? '+' : ''}{formatPoints(row.payout - row.bet)}</td>
          <td><Link to={verifyLink(row)} className="btn btn-ghost btn-sm" aria-label={t('Verificar jugada')}><ShieldCheck size={14} /></Link></td>
        </tr>)}</tbody>
      </table>
    </div>}
  </section>
}
