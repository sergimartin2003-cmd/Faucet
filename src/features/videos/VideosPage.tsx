import { lazy, Suspense, useState } from 'react'
import { Check, MonitorPlay } from 'lucide-react'
import { Alert, Badge, Button, Card, EmptyState, PageHeader, ProgressBar, Skeleton } from '../../ui'
import { useToast } from '../../ui/toastContext'
import { earnErrorMessage, useCompleteVideo, useStartVideo, useVideos, type EarnVideo } from '../../lib/queries'
import { EmailNotice, LoadError } from '../earn/EarnNotice'
import '../earn/earn.css'

const YouTubePlayer = lazy(() => import('./YouTubePlayer'))

const REQUIRED_SHARE = 0.85
const formatDuration = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

function Watcher({ video, onClose }: { video: EarnVideo; onClose: () => void }) {
  const [seconds, setSeconds] = useState(0)
  const [playerError, setPlayerError] = useState<string | null>(null)
  const complete = useCompleteVideo()
  const toast = useToast()
  const required = Math.ceil(video.duration_seconds * REQUIRED_SHARE)
  const ready = seconds >= required

  const claim = () => complete.mutate(video.id, {
    onSuccess: (result) => {
      toast(result.awarded ? `+${result.reward} puntos por ver el vídeo` : 'Ya habías cobrado este vídeo.', result.awarded ? 'success' : 'info')
      onClose()
    },
  })

  return <Card>
    <div className="video-stage">
      <div className="row-between">
        <div><Badge tone="accent">+{video.reward} pts</Badge></div>
        <Button variant="ghost" size="sm" onClick={onClose}>Cerrar</Button>
      </div>
      <Suspense fallback={<Skeleton height={320} />}>
        <YouTubePlayer videoId={video.id} onSecond={() => setSeconds((value) => value + 1)} onError={setPlayerError} />
      </Suspense>
      {playerError && <Alert tone="error">{playerError}</Alert>}
      <div className="stack" style={{ gap: 8 }}>
        <div className="row-between"><span className="earn-meta">Tiempo de reproducción real</span><span className="mono-num">{formatDuration(Math.min(seconds, required))} / {formatDuration(required)}</span></div>
        <ProgressBar value={(Math.min(seconds, required) / required) * 100} label="Tiempo visto" />
        <p className="earn-meta">El contador solo avanza mientras el vídeo se reproduce a velocidad normal con la pestaña visible. El servidor lo verifica de nuevo al cobrar.</p>
      </div>
      {complete.isError && <Alert tone="error">{earnErrorMessage(complete.error)}</Alert>}
      <Button variant="primary" disabled={!ready} loading={complete.isPending} onClick={claim}>{ready ? `Cobrar +${video.reward} puntos` : 'Sigue viendo para cobrar'}</Button>
    </div>
  </Card>
}

export default function VideosPage() {
  const videos = useVideos()
  const start = useStartVideo()
  const toast = useToast()
  const [active, setActive] = useState<EarnVideo | null>(null)

  const watch = (video: EarnVideo) => start.mutate(video.id, {
    onSuccess: () => setActive(video),
    onError: (error) => toast(earnErrorMessage(error), 'error'),
  })

  const first = videos.data?.[0]
  const limitReached = first ? first.watched_today >= first.daily_limit : false

  return <>
    <PageHeader title="Ver vídeos" description="Mira vídeos cortos y cobra puntos al terminarlos. El servidor comprueba que ha pasado el tiempo necesario desde que los iniciaste." />
    <EmailNotice />
    {first && <Alert tone={limitReached ? 'warning' : 'info'}>Hoy has cobrado {first.watched_today} de {first.daily_limit} vídeos. El límite se reinicia a medianoche UTC.</Alert>}
    {videos.isError && <LoadError error={videos.error} />}
    {active
      ? <Watcher key={active.id} video={active} onClose={() => setActive(null)} />
      : videos.isLoading
        ? <div className="earn-list"><Skeleton height={240} /><Skeleton height={240} /><Skeleton height={240} /></div>
        : videos.data && (videos.data.length === 0
          ? <EmptyState icon={<MonitorPlay size={22} />} title="No hay vídeos disponibles" description="Vuelve pronto." />
          : <div className="earn-list">
            {videos.data.map((video) => <article key={video.id} className={`earn-item${video.watched ? ' is-done' : ''}`}>
              <div className="video-thumb">
                <img src={`https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`} alt="" loading="lazy" referrerPolicy="no-referrer" />
                <span className="dur">{formatDuration(video.duration_seconds)}</span>
              </div>
              <div className="earn-meta"><Badge tone={video.watched ? 'success' : 'accent'}>{video.watched ? 'Visto' : 'Disponible'}</Badge><span>{video.channel}</span><span>{video.lang === 'es' ? 'Español' : 'Inglés'}</span></div>
              <div className="earn-foot">
                <span className="earn-reward">+{video.reward} pts</span>
                {video.watched ? <span className="earn-meta"><Check size={14} /> Cobrado</span> : <Button variant="primary" size="sm" disabled={limitReached} loading={start.isPending && start.variables === video.id} onClick={() => watch(video)}>Ver</Button>}
              </div>
            </article>)}
          </div>)}
  </>
}
