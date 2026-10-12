import { useEffect } from 'react'
import { supabase } from './supabase'
import { CLAIM_EVENT } from './accountPrefs'

const COOLDOWN_MS = 24 * 60 * 60 * 1000

export function browserNotificationsSupported() {
  return typeof Notification !== 'undefined'
}

export function useFaucetReminder(enabled: boolean) {
  useEffect(() => {
    if (!enabled || !supabase || !browserNotificationsSupported() || Notification.permission !== 'granted') return
    const client = supabase
    let timer = 0
    let cancelled = false

    const schedule = async () => {
      window.clearTimeout(timer)
      const { data, error } = await client.from('daily_faucet_claims').select('claimed_at').order('claimed_at', { ascending: false }).limit(1).maybeSingle()
      if (cancelled || error || !data) return
      const wait = Date.parse(data.claimed_at) + COOLDOWN_MS - Date.now()
      if (wait <= 0 || wait > 2 ** 31 - 1) return
      timer = window.setTimeout(() => {
        new Notification('Tu faucet está listo', { body: 'Ya puedes reclamar tus puntos diarios.', icon: '/pwa-icon.svg', tag: 'faucet-ready' })
      }, wait)
    }

    void schedule()
    window.addEventListener(CLAIM_EVENT, schedule)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
      window.removeEventListener(CLAIM_EVENT, schedule)
    }
  }, [enabled])
}
