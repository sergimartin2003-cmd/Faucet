import { useEffect, useRef } from 'react'
import { turnstileSiteKey } from '../lib/turnstile'

type TurnstileApi = {
  render: (container: HTMLElement, options: Record<string, unknown>) => string
  remove: (widgetId: string) => void
}

declare global {
  interface Window { turnstile?: TurnstileApi }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

function loadScript() {
  return new Promise<void>((resolve, reject) => {
    if (window.turnstile) return resolve()
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`)
    const script = existing ?? Object.assign(document.createElement('script'), { src: SCRIPT_SRC, async: true })
    script.addEventListener('load', () => resolve(), { once: true })
    script.addEventListener('error', () => reject(new Error('No se pudo cargar el captcha.')), { once: true })
    if (!existing) document.head.appendChild(script)
  })
}

export default function Captcha({ onToken }: { onToken: (token: string) => void }) {
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!turnstileSiteKey || !container.current) return
    let widgetId = ''
    let cancelled = false
    const element = container.current
    void loadScript().then(() => {
      if (cancelled || !window.turnstile) return
      widgetId = window.turnstile.render(element, {
        sitekey: turnstileSiteKey,
        theme: 'dark',
        callback: (token: string) => onToken(token),
        'expired-callback': () => onToken(''),
        'error-callback': () => onToken(''),
      })
    }).catch(() => onToken(''))
    return () => {
      cancelled = true
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId)
    }
  }, [onToken])

  if (!turnstileSiteKey) return null
  return <div className="captcha-box" ref={container} />
}
