import { useMemo, useState } from 'react'
import { Copy, RefreshCw, ShieldCheck } from 'lucide-react'
import { Alert, Button, Card, CardHeader, PageHeader, Skeleton } from '../../ui'
import { useToast } from '../../ui/toastContext'
import {
  GAME_LABELS, ROULETTE_REDS, SLOT_ICONS, cardInfo, deriveOutcome, formatMultiplier, gameLabel, sha256Hex,
  type CasinoGame, type SlotSymbol,
} from '../../lib/casino'
import { casinoErrorMessage, useFairness, useRevealedSeeds, useRotateSeed } from './api'
import { locale, t } from '../../lib/i18n'
import './casino.css'

const card = (n: number) => { const c = cardInfo(n); return `${c.rank}${c.suit}` }

function describe(game: CasinoGame, outcome: Awaited<ReturnType<typeof deriveOutcome>>) {
  const o = outcome as Record<string, unknown>
  switch (game) {
    case 'dice': return t('Tirada: {roll}', { roll: Number(o.roll).toLocaleString(locale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }) })
    case 'limbo':
    case 'crash': return t('Multiplicador: {value}', { value: formatMultiplier(Number(o.point)) })
    case 'coinflip': return o.side === 'heads' ? t('Cara') : t('Cruz')
    case 'roulette': { const n = Number(o.number); return t('Número {n} ({color})', { n, color: n === 0 ? t('verde') : ROULETTE_REDS.has(n) ? t('rojo') : t('negro') }) }
    case 'slots': return (o.reels as SlotSymbol[]).map((s) => SLOT_ICONS[s]).join(' ')
    case 'wheel': return t('Casilla {n} de 20', { n: Number(o.segment) + 1 })
    case 'plinko': return t('Casilla {n} · camino {path}', { n: Number(o.bucket) + 1, path: (o.path as number[]).map((step) => (step ? t('D') : t('I'))).join('') })
    case 'keno': return t('Números sorteados: {numbers}', { numbers: (o.drawn as number[]).join(', ') })
    case 'mines': return t('Minas en las casillas: {tiles}', { tiles: (o.mines as number[]).map((m) => m + 1).sort((a, b) => a - b).join(', ') })
    case 'hilo': return t('Cartas: {cards} …', { cards: (o.cards as number[]).slice(0, 12).map(card).join(' ') })
    case 'blackjack': return t('Tú: {player} · Crupier: {dealer} · siguientes: {next} …', { player: (o.player as number[]).map(card).join(' '), dealer: (o.dealer as number[]).map(card).join(' '), next: (o.cards as number[]).slice(4, 10).map(card).join(' ') })
  }
}

function CopyField({ label, value }: { label: string; value: string }) {
  const toast = useToast()
  return <div className="field">
    <span className="field-label">{label}</span>
    <div className="bet-input" style={{ gridTemplateColumns: 'minmax(0, 1fr) auto' }}>
      <input className="input mono-num" readOnly value={value} />
      <button type="button" className="btn btn-secondary btn-sm" aria-label={t('Copiar {label}', { label })} onClick={() => { void navigator.clipboard?.writeText(value); toast(t('Copiado'), 'success') }}><Copy size={14} /></button>
    </div>
  </div>
}

export default function FairnessPage() {
  const fairness = useFairness()
  const revealed = useRevealedSeeds()
  const rotate = useRotateSeed()
  const toast = useToast()
  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const [clientSeed, setClientSeed] = useState('')

  const [vGame, setVGame] = useState<CasinoGame>((params.get('game') as CasinoGame) || 'dice')
  const [vServerInput, setVServer] = useState<string | null>(null)
  const [vClient, setVClient] = useState(params.get('client') ?? '')
  const [vNonce, setVNonce] = useState(params.get('nonce') ?? '0')
  const [vRows, setVRows] = useState(Number(params.get('rows') ?? 16))
  const [vMines, setVMines] = useState(Number(params.get('mines') ?? 3))
  const [check, setCheck] = useState<{ hash: string; text: string } | null>(null)
  const wantedHash = params.get('hash')
  const pending = wantedHash && fairness.data?.server_seed_hash === wantedHash

  const matched = wantedHash ? revealed.data?.find((seed) => seed.server_seed_hash === wantedHash) : undefined
  const vServer = vServerInput ?? matched?.server_seed ?? ''

  const verify = async () => {
    const nonce = Number(vNonce)
    if (!vServer || !vClient || !Number.isInteger(nonce) || nonce < 0) { toast(t('Completa la semilla del servidor, la del cliente y el nonce.'), 'error'); return }
    const outcome = await deriveOutcome(vGame, vServer, vClient, nonce, { rows: vRows, mines: vMines })
    setCheck({ hash: await sha256Hex(vServer), text: describe(vGame, outcome) })
  }

  const doRotate = () => rotate.mutate(clientSeed, {
    onSuccess: (result) => {
      setClientSeed('')
      setVServer(result.revealed.server_seed)
      setVClient(result.revealed.client_seed)
      toast(t('Semillas cambiadas. La anterior semilla del servidor ya es pública.'), 'success')
    },
    onError: (error) => toast(casinoErrorMessage(error), 'error'),
  })

  return <>
    <PageHeader title={t('Juego justo')} description={t('Cada resultado sale de tus semillas y de un contador (nonce). Antes de jugar ves el hash de la semilla del servidor; al cambiarla, se revela y puedes comprobar cualquier jugada.')} />

    <Card>
      <CardHeader title={t('Semillas activas')} description={t('La semilla del servidor permanece secreta hasta que la cambies. El nonce sube en 1 con cada jugada.')} />
      {fairness.isLoading ? <Skeleton height={140} /> : fairness.isError ? <Alert tone="error">{casinoErrorMessage(fairness.error)}</Alert> : fairness.data && <div className="form-grid">
        <CopyField label={t('Hash SHA-256 de la semilla del servidor')} value={fairness.data.server_seed_hash} />
        <CopyField label={t('Semilla del cliente')} value={fairness.data.client_seed} />
        <CopyField label={t('Próximo nonce')} value={String(fairness.data.nonce)} />
        <div className="field">
          <label htmlFor="new-client-seed">{t('Nueva semilla del cliente (opcional)')}</label>
          <input id="new-client-seed" className="input mono-num" maxLength={64} placeholder={t('Déjala vacía para generar una aleatoria')} value={clientSeed}
            onChange={(event) => setClientSeed(event.target.value.replace(/[^A-Za-z0-9_-]/g, ''))} />
          <span className="field-hint">{t('Letras, números, guiones y guiones bajos. Las partidas abiertas de minas, hi-lo o blackjack deben terminar antes.')}</span>
        </div>
        <div className="form-actions"><Button variant="primary" loading={rotate.isPending} onClick={doRotate}><RefreshCw size={16} />{t('Cambiar semillas y revelar la actual')}</Button></div>
      </div>}
    </Card>

    <Card>
      <CardHeader title={t('Verificar una jugada')} description={t('El cálculo se hace en tu navegador con HMAC-SHA256, igual que en el servidor.')} />
      {pending && <Alert tone="info">{t('Esta jugada usa tu semilla actual, que aún es secreta. Cambia las semillas arriba para revelarla y poder verificarla.')}</Alert>}
      <div className="form-grid" style={{ marginTop: pending ? 'var(--space-4)' : 0 }}>
        <div className="field">
          <label htmlFor="v-game">{t('Juego')}</label>
          <select id="v-game" className="select" value={vGame} onChange={(event) => setVGame(event.target.value as CasinoGame)}>
            {(Object.keys(GAME_LABELS) as CasinoGame[]).map((key) => <option key={key} value={key}>{gameLabel(key)}</option>)}
          </select>
        </div>
        <div className="field"><label htmlFor="v-server">{t('Semilla del servidor (revelada)')}</label><input id="v-server" className="input mono-num" value={vServer} onChange={(event) => setVServer(event.target.value.trim())} /></div>
        <div className="field"><label htmlFor="v-client">{t('Semilla del cliente')}</label><input id="v-client" className="input mono-num" value={vClient} onChange={(event) => setVClient(event.target.value.trim())} /></div>
        <div className="field"><label htmlFor="v-nonce">Nonce</label><input id="v-nonce" className="input mono-num" inputMode="numeric" value={vNonce} onChange={(event) => setVNonce(event.target.value.replace(/\D/g, ''))} /></div>
        {vGame === 'plinko' && <div className="field"><label htmlFor="v-rows">{t('Filas')}</label>
          <select id="v-rows" className="select" value={vRows} onChange={(event) => setVRows(Number(event.target.value))}>{[8, 12, 16].map((n) => <option key={n} value={n}>{n}</option>)}</select></div>}
        {vGame === 'mines' && <div className="field"><label htmlFor="v-mines">{t('Minas')}</label>
          <select id="v-mines" className="select" value={vMines} onChange={(event) => setVMines(Number(event.target.value))}>{Array.from({ length: 24 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}</select></div>}
        <div className="form-actions"><Button variant="primary" onClick={() => void verify()}><ShieldCheck size={16} />{t('Calcular resultado')}</Button></div>
        {check && <div className="info-grid">
          <div className="info-row"><span>{t('Hash de la semilla')}</span><strong style={{ wordBreak: 'break-all' }}>{check.hash}</strong></div>
          {wantedHash && <div className="info-row"><span>{t('¿Coincide con el hash mostrado antes de jugar?')}</span><strong className={check.hash === wantedHash ? 'text-win' : 'text-loss'}>{check.hash === wantedHash ? t('Sí') : t('No')}</strong></div>}
          <div className="info-row"><span>{t('Resultado')}</span><strong style={{ textAlign: 'right' }}>{check.text}</strong></div>
        </div>}
      </div>
    </Card>

    <Card>
      <CardHeader title={t('Semillas reveladas')} description={t('Semillas del servidor que ya has cambiado. Úsalas para verificar las jugadas que hiciste con ellas.')} />
      {revealed.isLoading ? <Skeleton height={80} /> : !revealed.data?.length ? <p className="muted">{t('Todavía no has cambiado ninguna semilla.')}</p> : <div className="table-wrap">
        <table className="table">
          <thead><tr><th>{t('Semilla del servidor')}</th><th>{t('Semilla del cliente')}</th><th>{t('Jugadas')}</th><th /></tr></thead>
          <tbody>{revealed.data.map((seed) => <tr key={seed.id}>
            <td className="mono-num" style={{ wordBreak: 'break-all', fontSize: 12 }}>{seed.server_seed}</td>
            <td className="mono-num">{seed.client_seed}</td>
            <td className="mono-num">{seed.bets_count}</td>
            <td><Button size="sm" variant="ghost" onClick={() => { setVServer(seed.server_seed); setVClient(seed.client_seed); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>{t('Usar')}</Button></td>
          </tr>)}</tbody>
        </table>
      </div>}
    </Card>

    <Card>
      <CardHeader title={t('Cómo se calcula')} />
      <div className="stack muted" style={{ fontSize: 'var(--text-sm)' }}>
        <p>{t('Para cada jugada se calcula')} <code>HMAC_SHA256(semilla_servidor, "semilla_cliente:nonce:cursor")</code>. {t('Cada grupo de 4 bytes se convierte en un número entre 0 y 1; el cursor sube cuando se necesitan más de 8 números.')}</p>
        <p>{t('Dados: ⌊n × 10001⌋ / 100. Limbo y crash: ⌊0,99 / (1 − n) × 100⌋ / 100. Ruleta: ⌊n × 37⌋. Rueda: ⌊n × 20⌋. Plinko: derecha si n ≥ 0,5 en cada fila. Keno y minas: barajado Fisher–Yates. Cartas: ⌊n × 52⌋ (baraja infinita).')}</p>
        <p>{t('Ningún resultado depende del navegador: el servidor lo calcula y lo guarda antes de mostrártelo.')}</p>
      </div>
    </Card>
  </>
}
