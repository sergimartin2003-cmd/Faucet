import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'

export type AccountPrefs = {
  displayName: string
  country: string
  bio: string
  avatarColor: string
  notifyFaucetReady: boolean
  hideBalance: boolean
  showOnLeaderboard: boolean
}

export const DEFAULT_PREFS: AccountPrefs = {
  displayName: '',
  country: '',
  bio: '',
  avatarColor: '',
  notifyFaucetReady: false,
  hideBalance: false,
  showOnLeaderboard: true,
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
type SettingsRow = { notify_faucet_ready: boolean; hide_balance: boolean; show_on_leaderboard?: boolean }

export type PrefsLoad = { prefs: AccountPrefs; schemaReady: boolean }

async function loadSettingsRow(userId: string) {
  if (!supabase) return { data: null, error: new Error('no client') }
  const full = await supabase.from('user_settings').select('notify_faucet_ready, hide_balance, show_on_leaderboard').eq('user_id', userId).maybeSingle<SettingsRow>()
  if (!full.error) return full
  return supabase.from('user_settings').select('notify_faucet_ready, hide_balance').eq('user_id', userId).maybeSingle<SettingsRow>()
}

export async function loadAccountPrefs(): Promise<PrefsLoad> {
  if (!supabase) return { prefs: DEFAULT_PREFS, schemaReady: false }
  const { data: userData } = await supabase.auth.getUser()
  const metadataName = userData.user?.user_metadata?.display_name
  const base: AccountPrefs = { ...DEFAULT_PREFS, displayName: typeof metadataName === 'string' ? metadataName : '' }
  const userId = userData.user?.id
  if (!userId) return { prefs: base, schemaReady: false }

  const [profileResult, settingsResult] = await Promise.all([
    supabase.from('profiles').select('display_name, country, bio, avatar_color').eq('id', userId).maybeSingle<ProfileRow>(),
    loadSettingsRow(userId),
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
      showOnLeaderboard: settingsResult.data?.show_on_leaderboard ?? true,
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

export async function saveSettings(values: Partial<Pick<AccountPrefs, 'notifyFaucetReady' | 'hideBalance' | 'showOnLeaderboard'>>) {
  if (!supabase) throw new Error('Supabase no está configurado.')
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) throw userError ?? new Error('Sesión no disponible.')
  const row: Record<string, unknown> = { user_id: userData.user.id }
  if (values.notifyFaucetReady !== undefined) row.notify_faucet_ready = values.notifyFaucetReady
  if (values.hideBalance !== undefined) row.hide_balance = values.hideBalance
  if (values.showOnLeaderboard !== undefined) row.show_on_leaderboard = values.showOnLeaderboard
  const { error } = await supabase.from('user_settings').upsert(row)
  if (error) throw error
  window.dispatchEvent(new Event(PREFS_EVENT))
}

export function useAccountPrefs() {
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['prefs'], queryFn: loadAccountPrefs, enabled: Boolean(supabase), staleTime: 60_000 })

  useEffect(() => {
    const refresh = () => { void queryClient.invalidateQueries({ queryKey: ['prefs'] }) }
    window.addEventListener(PREFS_EVENT, refresh)
    return () => window.removeEventListener(PREFS_EVENT, refresh)
  }, [queryClient])

  return {
    prefs: query.data?.prefs ?? DEFAULT_PREFS,
    schemaReady: query.isError ? false : query.data?.schemaReady ?? true,
    loading: query.isLoading,
  }
}
