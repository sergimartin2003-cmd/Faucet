import { useEffect, useState } from 'react'
import { Eraser, Shuffle } from 'lucide-react'
import { Button } from '../../ui'
import { KENO_TABLES, formatMultiplier, payoutFor } from '../../lib/casino'
import { formatPoints } from '../../lib/game'
import { t } from '../../lib/i18n'
import { BetInput, GameHeader, GameLayout, InfoRow, Outcome, RecentBets } from './components'
import { reducedMotion, useCanBet, useInstantGame } from './useInstantGame'

const DRAW_MS = 120
const MAX_PICKS = 10

export default function KenoPage() {
  const [bet, setBet] = useState(10)
  const [picks, setPicks] = useState<number[]>([])
  const [reveal, setReveal] = useState({ betId: 0, count: 0 })
  const game = useInstantGame<{ p_bet: number; p_picks: number[] }, { drawn: number[]; hits: number }, { picks: number[] }>('play_keno', 10 * DRAW_MS + 200)
  const canBet = useCanBet(bet)
  const drawn = game.result?.result.drawn ?? []
  const betId = game.result?.bet_id ?? 0
  const shown = reducedMotion() ? drawn.length : reveal.betId === betId ? reveal.count : 0
  const visible = new Set(drawn.slice(0, shown))
  const playedPicks = new Set(game.result && (game.busy || game.revealed) ? game.result.params.picks : picks)
  const table = picks.length ? KENO_TABLES[picks.length] : null

  useEffect(() => {
    if (!betId || reducedMotion()) return
    let count = 0
    const id = window.setInterval(() => {
      count++
      setReveal({ betId, count })
      if (count >= 10) window.clearInterval(id)
    }, DRAW_MS)
    return () => window.clearInterval(id)
  }, [betId])

  const toggle = (n: number) => {
    if (game.busy) return
    setPicks((old) => old.includes(n) ? old.filter((p) => p !== n) : old.length >= MAX_PICKS ? old : [...old, n].sort((a, b) => a - b))
  }
  const randomPicks = () => {
    const count = picks.length || MAX_PICKS
    const pool = Array.from({ length: 40 }, (_, i) => i + 1)
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]] }
    setPicks(pool.slice(0, count).sort((a, b) => a - b))
  }
  const hitsSoFar = drawn.slice(0, shown).filter((n) => playedPicks.has(n)).length

  return <>
    <GameHeader game="keno" description={t('Elige de 1 a 10 números del 1 al 40. Se sortean 10: cuantos más aciertes, más cobras.')} />
    <GameLayout
      controls={<>
        <BetInput value={bet} onChange={setBet} disabled={game.busy} />
        <div className="row-inline" style={{ gap: 8 }}>
          <Button size="sm" disabled={game.busy} onClick={randomPicks}><Shuffle size={14} />{t('Aleatorio')}</Button>
          <Button size="sm" variant="ghost" disabled={game.busy || picks.length === 0} onClick={() => setPicks([])}><Eraser size={14} />{t('Borrar')}</Button>
        </div>
        <div className="info-grid">
          <InfoRow label={t('Números elegidos')} value={`${picks.length} / ${MAX_PICKS}`} />
          {table && <InfoRow label={t('Premio máximo')} value={t('{points} pts', { points: formatPoints(payoutFor(bet, table[table.length - 1])) })} />}
        </div>
        {table && <div className="field">
          <span className="field-label">{t('Pagos por aciertos')}</span>
          <div className="keno-pay">
            {table.map((m, hits) => m > 0 && <span key={hits} className={game.revealed && game.result?.result.hits === hits ? 'is-current' : ''}>{hits}: {formatMultiplier(m)}</span>)}
          </div>
        </div>}
        <Button variant="primary" size="lg" className="btn-block" loading={game.busy} disabled={!canBet || picks.length === 0}
          onClick={() => void game.run({ p_bet: bet, p_picks: picks })}>{t('Sortear')}</Button>
      </>}
      stage={<div className="stack">
        <div className="keno-grid">
          {Array.from({ length: 40 }, (_, i) => i + 1).map((n) => {
            const picked = playedPicks.has(n)
            const isDrawn = visible.has(n)
            const state = picked && isDrawn ? ' is-hit' : isDrawn ? ' is-drawn' : picked ? ' is-picked' : ''
            return <button key={n} type="button" className={`keno-cell${state}`} disabled={game.busy} aria-pressed={picks.includes(n)} onClick={() => toggle(n)}>{n}</button>
          })}
        </div>
        <div className="stage-center" style={{ minHeight: 64 }}>
          {game.result && !game.revealed && <p className="muted">{t('Aciertos:')} <strong>{hitsSoFar}</strong></p>}
          {game.revealed && game.result && <Outcome bet={game.result.bet} payout={game.result.payout} multiplier={Number(game.result.multiplier)} label={t('{hits} aciertos', { hits: game.result.result.hits })} />}
        </div>
      </div>}
      below={<RecentBets game="keno" />}
    />
  </>
}
