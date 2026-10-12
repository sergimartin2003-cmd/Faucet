import { useEffect, useRef } from 'react'

type YTPlayer = { destroy: () => void; getPlayerState: () => number; getPlaybackRate: () => number; setPlaybackRate: (rate: number) => void }
type YTApi = { Player: new (element: HTMLElement, options: Record<string, unknown>) => YTPlayer }

declare global {
  interface Window { YT?: YTApi; onYouTubeIframeAPIReady?: () => void }
}

let apiPromise: Promise<YTApi> | null = null

function loadApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  apiPromise ??= new Promise<YTApi>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => { previous?.(); if (window.YT) resolve(window.YT) }
    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    script.async = true
    script.onerror = () => { apiPromise = null; reject(new Error('No se pudo cargar el reproductor de YouTube.')) }
    document.head.appendChild(script)
  })
  return apiPromise
}

const PLAYING = 1

export default function YouTubePlayer({ videoId, onSecond, onError }: { videoId: string; onSecond: () => void; onError: (message: string) => void }) {
  const host = useRef<HTMLDivElement>(null)
  const tick = useRef(onSecond)
  const fail = useRef(onError)
  useEffect(() => { tick.current = onSecond; fail.current = onError })

  useEffect(() => {
    let player: YTPlayer | null = null
    let timer = 0
    let cancelled = false
    const mount = document.createElement('div')
    host.current?.appendChild(mount)
    loadApi().then((YT) => {
      if (cancelled) return
      player = new YT.Player(mount, {
        videoId,
        host: 'https://www.youtube-nocookie.com',
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
        events: { onError: () => fail.current('YouTube no permite reproducir este vídeo. Prueba con otro.') },
      })
      timer = window.setInterval(() => {
        if (!player || typeof player.getPlayerState !== 'function') return
        if (player.getPlayerState() !== PLAYING || document.hidden) return
        if (player.getPlaybackRate() > 1) { player.setPlaybackRate(1); return }
        tick.current()
      }, 1000)
    }).catch((error: Error) => fail.current(error.message))
    return () => {
      cancelled = true
      window.clearInterval(timer)
      player?.destroy()
      mount.remove()
    }
  }, [videoId])

  return <div className="video-frame" ref={host} />
}
