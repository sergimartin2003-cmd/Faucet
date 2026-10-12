import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import { CLAIM_EVENT } from './accountPrefs'
import type { LedgerRow } from './game'

const enabled = Boolean(supabase)

function client() {
  if (!supabase) throw new Error('Supabase no está configurado.')
  return supabase
}

export type FaucetState = { points: number; streak: number; bestStreak: number; lastClaimAt: string | null }

async function fetchFaucetState(): Promise<FaucetState> {
  const db = client()
  const [accountResult, claimResult] = await Promise.all([
    db.from('daily_faucet_accounts').select('points, streak, best_streak').maybeSingle(),
    db.from('daily_faucet_claims').select('claimed_at').order('claimed_at', { ascending: false }).limit(1).maybeSingle(),
  ])
  let account = accountResult.data as { points: number; streak?: number; best_streak?: number } | null
  if (accountResult.error) {
    const legacy = await db.from('daily_faucet_accounts').select('points').maybeSingle()
    if (legacy.error) throw legacy.error
    account = legacy.data
  }
  if (claimResult.error) throw claimResult.error
  return {
    points: account?.points ?? 0,
    streak: account?.streak ?? 0,
    bestStreak: account?.best_streak ?? 0,
    lastClaimAt: claimResult.data?.claimed_at ?? null,
  }
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

export const useCompletedTasks = () => useQuery({
  queryKey: ['tasks'],
  enabled,
  queryFn: async () => {
    const { data, error } = await client().from('earn_task_completions').select('task_key, reward, completed_at')
    if (error) throw error
    return (data ?? []) as { task_key: string; reward: number; completed_at: string }[]
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

function useInvalidateRewards() {
  const queryClient = useQueryClient()
  return () => Promise.all(['faucet', 'ledger', 'tasks', 'referral', 'leaderboard', 'history'].map((key) => queryClient.invalidateQueries({ queryKey: [key] })))
}

export type ClaimResult = { claimed: boolean; reward: number; balance: number; last_claim_at: string; streak: number }

export function useClaimFaucet() {
  const invalidate = useInvalidateRewards()
  return useMutation({
    mutationFn: async (): Promise<ClaimResult> => {
      const { data, error } = await client().rpc('claim_daily_faucet')
      if (error) throw error
      const result = data?.[0]
      if (!result) throw new Error('El servidor no devolvió el estado de la recompensa.')
      return result
    },
    onSuccess: (result) => {
      void invalidate()
      if (result.claimed) window.dispatchEvent(new Event(CLAIM_EVENT))
    },
  })
}

export function useCompleteTask() {
  const invalidate = useInvalidateRewards()
  return useMutation({
    mutationFn: async (taskKey: string) => {
      const { data, error } = await client().rpc('complete_earn_task', { task_key: taskKey })
      if (error) throw error
      const result = data?.[0]
      if (!result) throw new Error('El servidor no devolvió el estado de la tarea.')
      return result as { awarded: boolean; reward: number; balance: number; completed_at: string }
    },
    onSuccess: () => { void invalidate() },
  })
}

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
