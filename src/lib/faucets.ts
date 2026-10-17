import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { locale, t } from './i18n'

// Creator faucets pay out through FaucetPay from the creator's own balance.
// FaucetPay amounts are integers in 1e-8 units ("satoshi") for every currency.
export const UNITS_PER_COIN = 100_000_000

export const FAUCET_CURRENCIES = ['BTC', 'ETH', 'DOGE', 'LTC', 'BCH', 'DASH', 'DGB', 'TRX', 'USDT', 'ZEC', 'BNB', 'SOL', 'XRP', 'TON'] as const
export type FaucetCurrency = typeof FAUCET_CURRENCIES[number]

export const CURRENCY_NAMES: Record<FaucetCurrency, string> = {
  BTC: 'Bitcoin', ETH: 'Ethereum', DOGE: 'Dogecoin', LTC: 'Litecoin', BCH: 'Bitcoin Cash', DASH: 'Dash', DGB: 'DigiByte',
  TRX: 'TRON', USDT: 'Tether', ZEC: 'Zcash', BNB: 'BNB', SOL: 'Solana', XRP: 'XRP', TON: 'Toncoin',
}

export const FAUCETPAY_URL = 'https://faucetpay.io'
export const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{2,39}$/

export function formatCoin(units: number, currency: string) {
  const coins = units / UNITS_PER_COIN
  return `${coins.toLocaleString(locale(), { minimumFractionDigits: 0, maximumFractionDigits: 8 })} ${currency}`
}

export const formatSatoshi = (units: number) => units.toLocaleString(locale())

export function slugify(text: string) {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
}

export type PublicFaucet = {
  slug: string
  name: string
  description: string
  currency: FaucetCurrency
  reward: number
  interval_minutes: number
  daily_limit: number
  claims_count: number
  paid_total: number
  funded: boolean
  featured?: boolean
  created_at: string
}

export type FaucetDetail = PublicFaucet & {
  status: 'draft' | 'active' | 'paused' | 'banned'
  ready: boolean
  ad_unit: string | null
  platform_ad_unit: string | null
  ad_share_pct: number
}

export type MyFaucet = {
  id: string
  slug: string
  name: string
  description: string
  currency: FaucetCurrency
  reward: number
  interval_minutes: number
  daily_limit: number
  ad_unit: string | null
  status: 'draft' | 'active' | 'paused' | 'banned'
  status_reason: string | null
  has_key: boolean
  last_balance: number | null
  balance_checked_at: string | null
  claims_count: number
  paid_total: number
  fees_total: number
  featured_until: string | null
  created_at: string
}

export type FaucetClaim = {
  id: number
  address: string
  currency: string
  amount: number
  fee_amount: number
  status: 'pending' | 'paid' | 'failed'
  payout_id: string | null
  fee_status: 'none' | 'paid' | 'failed'
  error: string | null
  created_at: string
}

export type FaucetInput = {
  id: string | null
  slug: string
  name: string
  description: string
  currency: FaucetCurrency
  reward: number
  interval_minutes: number
  daily_limit: number
  ad_unit: string
}

const enabled = Boolean(supabase)

function client() {
  if (!supabase) throw new Error(t('Supabase no está configurado.'))
  return supabase
}

// Edge functions answer errors as JSON { error: code }; surface that code.
async function invoke<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await client().functions.invoke(name, { body })
  if (error) {
    let code = 'server_error'
    let nextAt: string | null = null
    if (error instanceof FunctionsHttpError) {
      const payload = await error.context.json().catch(() => null) as { error?: string; next_at?: string } | null
      code = payload?.error ?? code
      nextAt = payload?.next_at ?? null
    }
    throw Object.assign(new Error(code), { code, nextAt })
  }
  return data as T
}

export const usePublicFaucets = (currency: string) => useQuery({
  queryKey: ['public-faucets', currency],
  enabled,
  queryFn: async (): Promise<PublicFaucet[]> => {
    const { data, error } = await client().rpc('list_directory_faucets', { p_currency: currency || null, p_limit: 120 })
    if (error) throw error
    return (data ?? []) as PublicFaucet[]
  },
})

export const usePublicFaucet = (slug: string) => useQuery({
  queryKey: ['public-faucet', slug],
  enabled: enabled && SLUG_PATTERN.test(slug),
  queryFn: async (): Promise<FaucetDetail | null> => {
    const { data, error } = await client().rpc('get_public_faucet', { p_slug: slug })
    if (error) throw error
    return (data ?? null) as FaucetDetail | null
  },
})

export type ClaimResult = { ok: true; amount: number; currency: string; next_at: string }

export function useClaimFaucet() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { slug: string; address: string; captcha: string }) => invoke<ClaimResult>('faucet-claim', input),
    onSettled: (_data, _error, input) => { void queryClient.invalidateQueries({ queryKey: ['public-faucet', input.slug] }) },
  })
}

export const useMyFaucets = () => useQuery({
  queryKey: ['my-faucets'],
  enabled,
  queryFn: async (): Promise<{ faucets: MyFaucet[]; fee_bps: number; ad_share_pct: number }> => {
    const { data, error } = await client().rpc('my_faucets')
    if (error) throw error
    return data as { faucets: MyFaucet[]; fee_bps: number; ad_share_pct: number }
  },
})

export function useSaveFaucet() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: FaucetInput): Promise<MyFaucet> => {
      const { data, error } = await client().rpc('save_faucet', {
        p_id: input.id, p_slug: input.slug, p_name: input.name, p_description: input.description, p_currency: input.currency,
        p_reward: input.reward, p_interval_minutes: input.interval_minutes, p_daily_limit: input.daily_limit, p_ad_unit: input.ad_unit,
      })
      if (error) throw error
      return data as MyFaucet
    },
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['my-faucets'] }) },
  })
}

export function useSetFaucetStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; status: 'active' | 'paused' }) => {
      const { error } = await client().rpc('set_faucet_status', { p_id: input.id, p_status: input.status })
      if (error) throw error
    },
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['my-faucets'] }) },
  })
}

export function useFaucetKey() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { faucetId: string; apiKey?: string }) =>
      invoke<{ ok: true; balance: number; currency: string }>('faucet-key', { faucet_id: input.faucetId, ...(input.apiKey ? { api_key: input.apiKey } : {}) }),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['my-faucets'] }) },
  })
}

// Featuring costs 1.000 points (1 USD) per day and puts the faucet at the top of the directory.
export const FEATURE_POINTS_PER_DAY = 1000

export function useFeatureFaucet() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; days: number }) => {
      const { data, error } = await client().rpc('feature_faucet', { p_id: input.id, p_days: input.days })
      if (error) throw error
      return data as { featured_until: string; points: number; balance: number }
    },
    onSuccess: (result) => {
      queryClient.setQueryData<{ points: number }>(['faucet'], (old) => (old ? { ...old, points: result.balance } : old))
      void queryClient.invalidateQueries({ queryKey: ['my-faucets'] })
    },
  })
}

export const useMyFaucetClaims = (faucetId: string | null) => useQuery({
  queryKey: ['my-faucet-claims', faucetId],
  enabled: enabled && Boolean(faucetId),
  queryFn: async (): Promise<FaucetClaim[]> => {
    const { data, error } = await client().rpc('my_faucet_claims', { p_faucet_id: faucetId, p_limit: 100 })
    if (error) throw error
    return (data ?? []) as FaucetClaim[]
  },
})

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------
export type PlatformSettings = { fee_bps: number; fee_enabled: boolean; fee_recipient: string | null; ad_share_pct: number; platform_ad_unit: string | null; updated_at: string }

export type AdminFaucet = Omit<MyFaucet, 'description' | 'ad_unit' | 'balance_checked_at'> & { owner_email: string }

export type AdminFaucetClaim = {
  id: number
  faucet_slug: string
  faucet_name: string
  owner_email: string
  address: string
  ip_hash: string
  currency: string
  amount: number
  fee_amount: number
  fee_recipient: string | null
  status: 'pending' | 'paid' | 'failed'
  payout_id: string | null
  payout_user_hash: string | null
  fee_status: 'none' | 'paid' | 'failed'
  fee_payout_id: string | null
  error: string | null
  created_at: string
  finished_at: string | null
}

export const usePlatformSettings = () => useQuery({
  queryKey: ['platform-settings'],
  enabled,
  queryFn: async (): Promise<PlatformSettings> => {
    const { data, error } = await client().rpc('admin_platform_settings')
    if (error) throw error
    return data as PlatformSettings
  },
})

export function useUpdatePlatformSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: Omit<PlatformSettings, 'updated_at'>) => {
      const { data, error } = await client().rpc('admin_update_platform_settings', {
        p_fee_bps: input.fee_bps, p_fee_enabled: input.fee_enabled, p_fee_recipient: input.fee_recipient ?? '',
        p_ad_share_pct: input.ad_share_pct, p_platform_ad_unit: input.platform_ad_unit ?? '',
      })
      if (error) throw error
      return data as PlatformSettings
    },
    onSuccess: (data) => { queryClient.setQueryData(['platform-settings'], data) },
  })
}

export const useAdminFaucets = () => useQuery({
  queryKey: ['admin-faucets'],
  enabled,
  queryFn: async (): Promise<AdminFaucet[]> => {
    const { data, error } = await client().rpc('admin_list_faucets')
    if (error) throw error
    return (data ?? []) as AdminFaucet[]
  },
})

export function useAdminSetFaucetStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; status: 'active' | 'paused' | 'banned'; reason?: string }) => {
      const { error } = await client().rpc('admin_set_faucet_status', { p_id: input.id, p_status: input.status, p_reason: input.reason ?? null })
      if (error) throw error
    },
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['admin-faucets'] }) },
  })
}

export type PlatformRevenue = {
  fees: { currency: string; amount: number; count: number }[]
  promotions_points: number
  promotions_count: number
  promotions_month_points: number
  faucets_active: number
  faucets_total: number
  claims_paid: number
  claims_failed: number
  claims_today: number
  withdrawals_pending_cents: number
  withdrawals_paid_cents: number
  points_outstanding: number
}

export const usePlatformRevenue = () => useQuery({
  queryKey: ['platform-revenue'],
  enabled,
  queryFn: async (): Promise<PlatformRevenue> => {
    const { data, error } = await client().rpc('admin_platform_revenue')
    if (error) throw error
    return data as PlatformRevenue
  },
})

export type AdminPromotion = { id: number; faucet_slug: string; faucet_name: string; owner_email: string; days: number; points: number; featured_until: string; created_at: string }

export const useAdminPromotions = () => useQuery({
  queryKey: ['admin-promotions'],
  enabled,
  queryFn: async (): Promise<AdminPromotion[]> => {
    const { data, error } = await client().rpc('admin_faucet_promotions', { p_limit: 200 })
    if (error) throw error
    return (data ?? []) as AdminPromotion[]
  },
})

export const useAdminFaucetClaims = (status: string) => useQuery({
  queryKey: ['admin-faucet-claims', status],
  enabled,
  queryFn: async (): Promise<AdminFaucetClaim[]> => {
    const { data, error } = await client().rpc('admin_faucet_claims', { p_status: status || null, p_faucet: null, p_limit: 500, p_offset: 0 })
    if (error) throw error
    return (data ?? []) as AdminFaucetClaim[]
  },
})

export function faucetErrorMessage(error: unknown) {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code: unknown }).code) : ''
  const text = error instanceof Error ? error.message : typeof error === 'object' && error !== null && 'message' in error ? String((error as { message: unknown }).message) : ''
  switch (code || text) {
    case 'captcha_failed': return t('Completa el captcha e inténtalo de nuevo.')
    case 'captcha_not_configured': return t('Las faucets están en mantenimiento. Vuelve en un rato.')
    case 'invalid_address': return t('Introduce tu dirección, correo o usuario de FaucetPay.')
    case 'address_not_linked': return t('Esa dirección no está vinculada a ninguna cuenta de FaucetPay. Vincúlala en FaucetPay o usa tu correo.')
    case 'user_blocked': return t('FaucetPay ha bloqueado los pagos a esa cuenta.')
    case 'too_soon': return t('Todavía no puedes volver a reclamar en esta faucet.')
    case 'daily_limit': return t('Has alcanzado el límite diario de esta faucet.')
    case 'unavailable': return t('Esta faucet no está disponible ahora mismo (puede que se haya quedado sin fondos).')
    case 'payout_failed': return t('FaucetPay no aceptó el pago. Inténtalo de nuevo en unos minutos.')
    case 'invalid_key': return t('FaucetPay rechazó esa API key. Copia la API key de tu faucet en FaucetPay y comprueba que es de la misma moneda.')
    case 'faucetpay_unreachable': return t('No se pudo contactar con FaucetPay. Inténtalo de nuevo en unos minutos.')
    case 'no_key': return t('Conecta primero la API key de FaucetPay.')
    case 'auth_required': return t('Inicia sesión de nuevo.')
  }
  if (text.includes('Slug not available')) return t('Esa dirección web ya está en uso. Elige otra.')
  if (text.includes('Faucet limit')) return t('Puedes tener como máximo 10 faucets.')
  if (text.includes('API key required')) return t('Conecta la API key de FaucetPay antes de activar la faucet.')
  if (text.includes('Faucet banned')) return t('Esta faucet ha sido suspendida por incumplir las normas.')
  if (text.includes('Email confirmation')) return t('Confirma tu correo electrónico antes de crear una faucet.')
  if (text.includes('Fee recipient')) return t('Indica la cuenta de FaucetPay que recibe la comisión.')
  if (text.includes('Faucet must be active')) return t('Activa la faucet antes de destacarla.')
  if (text.includes('Insufficient balance')) return t('No tienes puntos suficientes.')
  if (text.includes('Admin only')) return t('Solo un administrador puede hacer esto.')
  if (text.includes('violates check constraint') || text.includes('22023')) return t('Revisa los datos: algún valor está fuera de los límites.')
  return t('No se pudo completar la acción. Inténtalo de nuevo en unos minutos.')
}
