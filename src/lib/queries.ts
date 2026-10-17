import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import type { LedgerRow } from './game'
import type { WithdrawalMethod, WithdrawalStatus } from './payouts'

const enabled = Boolean(supabase)

function client() {
  if (!supabase) throw new Error('Supabase no está configurado.')
  return supabase
}

// The points balance. The query key stays 'faucet' because the casino writes
// its results into the same cache entry.
export type FaucetState = { points: number }

async function fetchFaucetState(): Promise<FaucetState> {
  const { data, error } = await client().from('daily_faucet_accounts').select('points').maybeSingle()
  if (error) throw error
  return { points: data?.points ?? 0 }
}

export const useFaucetState = () => useQuery({ queryKey: ['faucet'], queryFn: fetchFaucetState, enabled })

export const useLedger = () => useQuery({
  queryKey: ['ledger'],
  enabled,
  queryFn: async (): Promise<LedgerRow[]> => {
    const { data, error } = await client().from('reward_ledger').select('created_at, source_type, points').order('created_at', { ascending: false }).limit(1000)
    if (error) throw error
    return data ?? []
  },
})

export type ReferralSummary = {
  code: string
  total_referrals: number
  rewarded_referrals: number
  points_earned: number
  was_referred: boolean
  max_rewarded: number
  reward_per_referral: number
}

export const useReferralSummary = () => useQuery({
  queryKey: ['referral'],
  enabled,
  queryFn: async (): Promise<ReferralSummary> => {
    const { data, error } = await client().rpc('get_referral_summary')
    if (error || !data?.[0]) throw error ?? new Error('Sin datos de referidos')
    return data[0]
  },
})

export type LeaderboardEntry = { rank: number; display_name: string | null; avatar_color: string | null; points_month: number; is_me: boolean }

export const useLeaderboard = () => useQuery({
  queryKey: ['leaderboard'],
  enabled,
  retry: false,
  queryFn: async (): Promise<LeaderboardEntry[]> => {
    const { data, error } = await client().rpc('get_leaderboard', { p_limit: 20 })
    if (error) throw error
    return (data ?? []) as LeaderboardEntry[]
  },
})

export type HistoryEntry = { id: number; source_type: string; detail: string | null; points: number; balance_after: number; created_at: string }
export const HISTORY_PAGE_SIZE = 25

export const useHistory = (source: string) => useInfiniteQuery({
  queryKey: ['history', source],
  enabled,
  initialPageParam: 0,
  queryFn: async ({ pageParam }): Promise<HistoryEntry[]> => {
    const db = client()
    const { data, error } = await db.rpc('get_reward_history', { p_limit: HISTORY_PAGE_SIZE, p_offset: pageParam, p_source: source || null })
    if (!error) return (data ?? []) as HistoryEntry[]
    let query = db.from('reward_ledger').select('id, source_type, points, balance_after, created_at').order('created_at', { ascending: false }).range(pageParam, pageParam + HISTORY_PAGE_SIZE - 1)
    if (source) query = query.eq('source_type', source)
    const fallback = await query
    if (fallback.error) throw fallback.error
    return (fallback.data ?? []).map((row) => ({ ...row, detail: null }))
  },
  getNextPageParam: (lastPage, pages) => (lastPage.length < HISTORY_PAGE_SIZE ? undefined : pages.length * HISTORY_PAGE_SIZE),
})

export const useMfaFactors = () => useQuery({
  queryKey: ['mfa-factors'],
  enabled,
  queryFn: async () => {
    const { data, error } = await client().auth.mfa.listFactors()
    if (error) throw error
    return data.all.filter((factor) => factor.factor_type === 'totp' && factor.status === 'verified').length
  },
})

export function errorCode(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error ? String((error as { code: unknown }).code) : ''
}

export type Withdrawal = {
  id: number
  points: number
  usd_cents: number
  method: WithdrawalMethod
  address: string
  status: WithdrawalStatus
  tx_ref: string | null
  note: string | null
  created_at: string
  processed_at: string | null
}

export const useWithdrawals = () => useQuery({
  queryKey: ['withdrawals'],
  enabled,
  queryFn: async (): Promise<Withdrawal[]> => {
    const { data, error } = await client().from('withdrawals')
      .select('id, points, usd_cents, method, address, status, tx_ref, note, created_at, processed_at')
      .order('created_at', { ascending: false }).limit(50)
    if (error) throw error
    return (data ?? []) as Withdrawal[]
  },
})

export function useRequestWithdrawal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { points: number; method: WithdrawalMethod; address: string }) => {
      const { data, error } = await client().rpc('request_withdrawal', { p_points: input.points, p_method: input.method, p_address: input.address.trim() })
      if (error) throw error
      return data as Withdrawal & { balance: number }
    },
    onSuccess: (result) => {
      queryClient.setQueryData<FaucetState>(['faucet'], (old) => (old ? { ...old, points: result.balance } : old))
      void queryClient.invalidateQueries({ queryKey: ['withdrawals'] })
    },
  })
}

export const useIsAdmin = () => useQuery({
  queryKey: ['is-admin'],
  enabled,
  staleTime: Infinity,
  retry: false,
  queryFn: async (): Promise<boolean> => {
    const { data, error } = await client().rpc('is_admin')
    if (error) return false
    return data === true
  },
})

export type AdminWithdrawal = Withdrawal & {
  user_id: string
  email: string
  account_created_at: string
  offer_points: number
  reversed_points: number
  casino_net: number
  paid_points: number
  balance: number
}

export const useAdminWithdrawals = (status: WithdrawalStatus | 'all') => useQuery({
  queryKey: ['admin-withdrawals', status],
  enabled,
  queryFn: async (): Promise<AdminWithdrawal[]> => {
    const { data, error } = await client().rpc('admin_list_withdrawals', { p_status: status === 'all' ? null : status, p_limit: 200 })
    if (error) throw error
    return (data ?? []) as AdminWithdrawal[]
  },
})

export function useProcessWithdrawal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: number; action: 'paid' | 'rejected'; txRef?: string; note?: string }) => {
      const { error } = await client().rpc('admin_process_withdrawal', { p_id: input.id, p_action: input.action, p_tx_ref: input.txRef ?? null, p_note: input.note ?? null })
      if (error) throw error
    },
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['admin-withdrawals'] }) },
  })
}

export function withdrawalErrorMessage(error: unknown) {
  const text = error instanceof Error ? error.message : typeof error === 'object' && error !== null && 'message' in error ? String((error as { message: unknown }).message) : ''
  if (text.includes('Email confirmation')) return 'Confirma tu correo electrónico antes de retirar.'
  if (text.includes('Invalid withdrawal amount')) return 'La cantidad no es válida. El mínimo es 5.000 puntos.'
  if (text.includes('Invalid withdrawal address')) return 'La dirección no es válida para la moneda elegida.'
  if (text.includes('already pending')) return 'Ya tienes un retiro pendiente. Espera a que se procese.'
  if (text.includes('Insufficient balance')) return 'No tienes puntos suficientes.'
  if (text.includes('Transaction reference')) return 'Indica el hash de la transacción o la referencia del pago.'
  if (text.includes('already processed')) return 'Este retiro ya se había procesado.'
  if (text.includes('Admin only')) return 'Solo un administrador puede hacer esto.'
  return 'No se pudo completar la acción. Inténtalo de nuevo en unos minutos.'
}
