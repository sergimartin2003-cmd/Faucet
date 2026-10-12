import { supabase } from './supabase'

const STORAGE_KEY = 'faucet:referral-code'
const CODE_PATTERN = /^[a-f0-9]{8}$/

export function captureReferralFromUrl(): boolean {
  const code = new URLSearchParams(window.location.search).get('ref')?.trim().toLowerCase()
  if (!code || !CODE_PATTERN.test(code)) return false
  try { window.localStorage.setItem(STORAGE_KEY, code) } catch { /* storage unavailable */ }
  return true
}

export async function applyPendingReferral(): Promise<void> {
  if (!supabase) return
  let code: string | null = null
  try { code = window.localStorage.getItem(STORAGE_KEY) } catch { return }
  if (!code) return
  const { error } = await supabase.rpc('apply_referral_code', { p_code: code })
  if (!error || error.code === '22023') {
    try { window.localStorage.removeItem(STORAGE_KEY) } catch { /* storage unavailable */ }
  }
}
