import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

export type AccountPrefs = {
  displayName: string
  country: string
  bio: string
  avatarColor: string
  notifyFaucetReady: boolean
  hideBalance: boolean
}

export const DEFAULT_PREFS: AccountPrefs = {
  displayName: '',
  country: '',
  bio: '',
  avatarColor: '',
  notifyFaucetReady: false,
  hideBalance: false,
}

export const AVATAR_COLORS = ['#6eafff', '#5ad1a4', '#f2b84b', '#f27d6b', '#b48cff', '#ff8fc2', '#7fd4e8', '#9aa7b8']

export const COUNTRIES: [string, string][] = [
  ['AR', 'Argentina'], ['BO', 'Bolivia'], ['BR', 'Brasil'], ['CL', 'Chile'], ['CO', 'Colombia'],
  ['CR', 'Costa Rica'], ['CU', 'Cuba'], ['DO', 'República Dominicana'], ['EC', 'Ecuador'], ['SV', 'El Salvador'],
  ['ES', 'España'], ['US', 'Estados Unidos'], ['GT', 'Guatemala'], ['HN', 'Honduras'], ['MX', 'México'],
  ['NI', 'Nicaragua'], ['PA', 'Panamá'], ['PY', 'Paraguay'], ['PE', 'Perú'], ['PT', 'Portugal'],
  ['PR', 'Puerto Rico'], ['UY', 'Uruguay'], ['VE', 'Venezuela'], ['DE', 'Alemania'], ['FR', 'Francia'],
  ['GB', 'Reino Unido'], ['IT', 'Italia'], ['OT', 'Otro'],
]

export const PREFS_EVENT = 'faucet:prefs-changed'
export const CLAIM_EVENT = 'faucet:claimed'

type ProfileRow = { display_name: string | null; country: string | null; bio: string | null; avatar_color: string | null }
type SettingsRow = { notify_faucet_ready: boolean; hide_balance: boolean }

export type PrefsLoad = { prefs: AccountPrefs; schemaReady: boolean }

export async function loadAccountPrefs(): Promise<PrefsLoad> {
  if (!supabase) return { prefs: DEFAULT_PREFS, schemaReady: false }
  const { data: userData } = await supabase.auth.getUser()
  const metadataName = userData.user?.user_metadata?.display_name
  const base: AccountPrefs = { ...DEFAULT_PREFS, displayName: typeof metadataName === 'string' ? metadataName : '' }
  const userId = userData.user?.id
  if (!userId) return { prefs: base, schemaReady: false }

  const [profileResult, settingsResult] = await Promise.all([
    supabase.from('profiles').select('display_name, country, bio, avatar_color').eq('id', userId).maybeSingle<ProfileRow>(),
    supabase.from('user_settings').select('notify_faucet_ready, hide_balance').eq('user_id', userId).maybeSingle<SettingsRow>(),
  ])
  const schemaReady = !profileResult.error && !settingsResult.error
  return {
    schemaReady,
    prefs: {
      ...base,
      country: profileResult.data?.country ?? '',
      bio: profileResult.data?.bio ?? '',
      avatarColor: profileResult.data?.avatar_color ?? '',
      notifyFaucetReady: settingsResult.data?.notify_faucet_ready ?? false,
      hideBalance: settingsResult.data?.hide_balance ?? false,
    },
  }
}

export async function saveProfile(values: Pick<AccountPrefs, 'displayName' | 'country' | 'bio' | 'avatarColor'>) {
  if (!supabase) throw new Error('Supabase no está configurado.')
  const name = values.displayName.trim()
  const { data, error } = await supabase.auth.updateUser({ data: { display_name: name || null } })
  if (error) throw error
  const { error: profileError } = await supabase.from('profiles').update({
    display_name: name || null,
    country: values.country || null,
    bio: values.bio.trim() || null,
    avatar_color: values.avatarColor || null,
  }).eq('id', data.user.id)
  if (profileError) throw profileError
  window.dispatchEvent(new Event(PREFS_EVENT))
}

export async function saveSettings(values: Pick<AccountPrefs, 'notifyFaucetReady' | 'hideBalance'>) {
  if (!supabase) throw new Error('Supabase no está configurado.')
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) throw userError ?? new Error('Sesión no disponible.')
  const { error } = await supabase.from('user_settings').upsert({
    user_id: userData.user.id,
    notify_faucet_ready: values.notifyFaucetReady,
    hide_balance: values.hideBalance,
  })
  if (error) throw error
  window.dispatchEvent(new Event(PREFS_EVENT))
}

export function useAccountPrefs() {
  const [state, setState] = useState<PrefsLoad & { loading: boolean }>({ prefs: DEFAULT_PREFS, schemaReady: true, loading: Boolean(supabase) })

  const reload = useCallback(async () => {
    try {
      const result = await loadAccountPrefs()
      setState({ ...result, loading: false })
    } catch {
      setState((current) => ({ ...current, schemaReady: false, loading: false }))
    }
  }, [])

  useEffect(() => {
    if (!supabase) return
    void Promise.resolve().then(reload)
    window.addEventListener(PREFS_EVENT, reload)
    return () => window.removeEventListener(PREFS_EVENT, reload)
  }, [reload])

  return { ...state, reload }
}
