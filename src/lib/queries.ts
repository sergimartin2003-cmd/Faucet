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
  return () => Promise.all(['faucet', 'ledger', 'tasks', 'referral', 'leaderboard', 'history', 'surveys', 'videos', 'trivia', 'scratch'].map((key) => queryClient.invalidateQueries({ queryKey: [key] })))
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

export type SurveySummary = { slug: string; title: string; description: string; reward: number; est_minutes: number; question_count: number; completed: boolean }
export type SurveyQuestion = { id: number; prompt: string; kind: 'single' | 'scale'; options: string[] }
export type SurveyDetail = { slug: string; title: string; description: string; reward: number; completed: boolean; questions: SurveyQuestion[] }
export type AwardResult = { awarded: boolean; reward: number; balance: number }

export const useSurveys = () => useQuery({
  queryKey: ['surveys'],
  enabled,
  retry: false,
  queryFn: async (): Promise<SurveySummary[]> => {
    const { data, error } = await client().rpc('list_surveys')
    if (error) throw error
    return (data ?? []) as SurveySummary[]
  },
})

export function useStartSurvey() {
  return useMutation({
    mutationFn: async (slug: string): Promise<SurveyDetail> => {
      const { data, error } = await client().rpc('get_survey', { p_slug: slug })
      if (error) throw error
      return data as SurveyDetail
    },
  })
}

export function useSubmitSurvey() {
  const invalidate = useInvalidateRewards()
  return useMutation({
    mutationFn: async ({ slug, answers }: { slug: string; answers: number[] }): Promise<AwardResult> => {
      const { data, error } = await client().rpc('submit_survey', { p_slug: slug, p_answers: answers })
      if (error) throw error
      if (!data?.[0]) throw new Error('El servidor no devolvió el resultado.')
      return data[0] as AwardResult
    },
    onSuccess: () => { void invalidate() },
  })
}

export type EarnVideo = { id: string; title: string; channel: string; duration_seconds: number; reward: number; lang: string; watched: boolean; watched_today: number; daily_limit: number }

export const useVideos = () => useQuery({
  queryKey: ['videos'],
  enabled,
  retry: false,
  queryFn: async (): Promise<EarnVideo[]> => {
    const { data, error } = await client().rpc('list_videos')
    if (error) throw error
    return (data ?? []) as EarnVideo[]
  },
})

export function useStartVideo() {
  return useMutation({
    mutationFn: async (videoId: string): Promise<string> => {
      const { data, error } = await client().rpc('start_video', { p_video_id: videoId })
      if (error) throw error
      return data as string
    },
  })
}

export function useCompleteVideo() {
  const invalidate = useInvalidateRewards()
  return useMutation({
    mutationFn: async (videoId: string): Promise<AwardResult> => {
      const { data, error } = await client().rpc('complete_video', { p_video_id: videoId })
      if (error) throw error
      if (!data?.[0]) throw new Error('El servidor no devolvió el resultado.')
      return data[0] as AwardResult
    },
    onSuccess: () => { void invalidate() },
  })
}

export type TriviaQuestion = {
  id: number
  prompt: string
  options: string[]
  answered: boolean
  your_answer: number | null
  correct: boolean | null
  explanation: string | null
  correct_index: number | null
}

export const useDailyTrivia = () => useQuery({
  queryKey: ['trivia'],
  enabled,
  retry: false,
  queryFn: async (): Promise<TriviaQuestion[]> => {
    const { data, error } = await client().rpc('get_daily_trivia')
    if (error) throw error
    return (data ?? []) as TriviaQuestion[]
  },
})

export type TriviaResult = { correct: boolean; correct_index: number; explanation: string | null; reward: number; balance: number }

export function useAnswerTrivia() {
  const invalidate = useInvalidateRewards()
  return useMutation({
    mutationFn: async ({ questionId, answer }: { questionId: number; answer: number }): Promise<TriviaResult> => {
      const { data, error } = await client().rpc('answer_trivia', { p_question_id: questionId, p_answer_index: answer })
      if (error) throw error
      if (!data?.[0]) throw new Error('El servidor no devolvió el resultado.')
      return data[0] as TriviaResult
    },
    onSuccess: () => { void invalidate() },
  })
}

export type ScratchStatus = { available: boolean; last_reward: number | null; next_available_at: string | null }

export const useScratchStatus = () => useQuery({
  queryKey: ['scratch'],
  enabled,
  retry: false,
  queryFn: async (): Promise<ScratchStatus> => {
    const { data, error } = await client().rpc('get_scratch_status')
    if (error || !data?.[0]) throw error ?? new Error('Sin datos')
    return data[0] as ScratchStatus
  },
})

export function usePlayScratch() {
  const invalidate = useInvalidateRewards()
  return useMutation({
    mutationFn: async (): Promise<{ reward: number; balance: number }> => {
      const { data, error } = await client().rpc('play_scratch')
      if (error || !data?.[0]) throw error ?? new Error('El servidor no devolvió el resultado.')
      return data[0] as { reward: number; balance: number }
    },
    onSuccess: () => { void invalidate() },
  })
}

export function earnErrorMessage(error: unknown) {
  const text = error instanceof Error ? error.message : typeof error === 'object' && error !== null && 'message' in error ? String((error as { message: unknown }).message) : ''
  if (text.includes('Email confirmation')) return 'Confirma tu correo electrónico para ganar puntos con esta actividad.'
  if (text.includes('Too fast')) return 'Has respondido demasiado rápido. Lee las preguntas con calma e inténtalo de nuevo.'
  if (text.includes('Video not finished')) return 'Aún no ha pasado el tiempo necesario. Termina de ver el vídeo para reclamar.'
  if (text.includes('Daily video limit')) return 'Has alcanzado el límite diario de vídeos. Vuelve mañana.'
  if (text.includes('Already answered')) return 'Ya has respondido esta pregunta hoy.'
  if (text.includes('Already played')) return 'Ya has rascado tu cartón de hoy. Vuelve mañana.'
  if (errorCode(error) === 'PGRST202' || text.includes('Could not find the function')) return 'Esta actividad aún no está activada en la base de datos. Falta aplicar la última migración de Supabase.'
  return 'No se pudo completar la acción. Inténtalo de nuevo en unos minutos.'
}
