import { useCallback, useEffect, useRef, useState } from 'react'
import { Ticket } from 'lucide-react'
import { Alert, Button, Card, PageHeader, Skeleton } from '../../ui'
import { useToast } from '../../ui/toastContext'
import { earnErrorMessage, usePlayScratch, useScratchStatus } from '../../lib/queries'
import { EmailNotice, LoadError } from '../earn/EarnNotice'
import '../earn/earn.css'

const W = 480
const H = 270
const REVEAL_SHARE = 0.5

function paintCover(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const gradient = ctx.createLinearGradient(0, 0, W, H)
  gradient.addColorStop(0, '#8a9ba3'); gradient.addColorStop(.5, '#c9d6dc'); gradient.addColorStop(1, '#7d8e96')
  ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, W, H)
  ctx.strokeStyle = 'rgba(255,255,255,.22)'
  ctx.lineWidth = 1
  for (let i = -H; i < W; i += 14) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + H, H); ctx.stroke() }
  ctx.fillStyle = 'rgba(20,40,48,.55)'
  ctx.font = '700 22px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('RASCA AQUÍ', W / 2, H / 2 + 8)
}

function clearedShare(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return 0
  const { data } = ctx.getImageData(0, 0, W, H)
  let cleared = 0
  const step = 4 * 8
  for (let i = 3; i < data.length; i += step) if (data[i] < 40) cleared++
  return cleared / (data.length / step)
}

function ScratchCard({ prize, loading, onStart, disabled }: { prize: number | null; loading: boolean; onStart: () => void; disabled: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const started = useRef(false)
  const [clear, setClear] = useState(false)

  useEffect(() => { if (canvas.current) paintCover(canvas.current) }, [])

  const scratch = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const el = canvas.current
    const ctx = el?.getContext('2d')
    if (!el || !ctx) return
    const rect = el.getBoundingClientRect()
    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath()
    ctx.arc((event.clientX - rect.left) * (W / rect.width), (event.clientY - rect.top) * (H / rect.height), 26, 0, Math.PI * 2)
    ctx.fill()
  }, [])

  const down = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (prize === null && (disabled || started.current)) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drawing.current = true
    if (prize === null) { started.current = true; onStart() }
    scratch(event)
  }
  const move = (event: React.PointerEvent<HTMLCanvasElement>) => { if (drawing.current && prize !== null) scratch(event) }
  const up = () => {
    drawing.current = false
    if (canvas.current && prize !== null && clearedShare(canvas.current) > REVEAL_SHARE) setClear(true)
  }

  return <div className="scratch-card">
    <div className="scratch-prize">{prize === null ? <span>{loading ? 'Generando premio…' : 'Tu premio aparecerá aquí'}</span> : <><strong className="mono-num">+{prize}</strong><span>puntos</span></>}</div>
    <canvas ref={canvas} width={W} height={H} className={`scratch-canvas${clear ? ' is-clear' : ''}`} aria-label="Cartón por rascar" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
    {prize !== null && !clear && <Button className="scratch-reveal" variant="ghost" size="sm" onClick={() => setClear(true)} style={{ position: 'absolute', right: 8, bottom: 8 }}>Revelar</Button>}
  </div>
}

export default function ScratchPage() {
  const status = useScratchStatus()
  const play = usePlayScratch()
  const toast = useToast()
  const [prize, setPrize] = useState<number | null>(null)

  const available = status.data?.available ?? false
  const shown = prize ?? (status.data && !available ? status.data.last_reward : null)
  const next = status.data?.next_available_at ? new Date(status.data.next_available_at).toLocaleString('es-ES', { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : null

  const start = () => play.mutate(undefined, {
    onSuccess: (result) => { setPrize(result.reward); toast(`Has ganado +${result.reward} puntos`, 'success') },
    onError: (error) => toast(earnErrorMessage(error), 'error'),
  })

  return <>
    <PageHeader title="Rasca y gana" description="Un cartón gratis cada día (UTC). El premio lo decide el servidor al empezar a rascar: de 1 a 15 puntos." />
    <EmailNotice />
    {status.isError && <LoadError error={status.error} />}
    {status.isLoading ? <Skeleton height={300} /> : status.data && <Card>
      <div className="scratch-wrap">
        <ScratchCard prize={shown} loading={play.isPending} onStart={start} disabled={!available || play.isPending} />
        {available && prize === null && <p className="earn-meta"><Ticket size={14} /> Arrastra el dedo o el ratón sobre el cartón para rascar.</p>}
        {!available && <Alert tone="info">Ya has rascado hoy{status.data.last_reward !== null ? ` y ganaste ${status.data.last_reward} puntos` : ''}.{next ? ` Próximo cartón: ${next}.` : ''}</Alert>}
        {play.isError && <Alert tone="error">{earnErrorMessage(play.error)}</Alert>}
      </div>
    </Card>}
  </>
}
