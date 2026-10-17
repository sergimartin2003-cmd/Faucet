import { useCallback } from 'react'
import { useMutation, useQuery, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { errorCode, type FaucetState } from '../../lib/queries'
import type { CasinoGame } from '../../lib/casino'
import { t } from '../../lib/i18n'

const enabled = Boolean(supabase)

function client() {
  if (!supabase) throw new Error(t('Supabase no está configurado.'))
  return supabase
}

export type BetResult<R = Record<string, unknown>, P = Record<string, unknown>> = {
  bet_id: number
  game: CasinoGame
  bet: number
  payout: number
  profit: number
  multiplier: number
  win: boolean
  balance: number
  params: P
  result: R
  nonce: number
  server_seed_hash: string
  client_seed: string
}

export type SessionView = {
  session_id: number
  game: 'mines' | 'hilo' | 'blackjack'
  bet: number
  active: boolean
  outcome: string
  payout: number
  balance: number
  nonce: number
  server_seed_hash: string
  client_seed: string
}

export async function callCasino<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await client().rpc(fn, args)
  if (error) throw error
  if (data === null || data === undefined) throw new Error(t('El servidor no devolvió el resultado.'))
  return data as T
}

// Writes the new balance into the shared faucet query (top bar chip) and
// refreshes casino lists. Pages call it when their animation has finished, so
// the balance never spoils the result.
export function useApplyBalance() {
  const queryClient = useQueryClient()
  return useCallback((balance: number) => {
    queryClient.setQueryData<FaucetState>(['faucet'], (old) => (old ? { ...old, points: balance } : old))
    void queryClient.invalidateQueries({ queryKey: ['casino-bets'] })
    void queryClient.invalidateQueries({ queryKey: ['casino-stats'] })
    void queryClient.invalidateQueries({ queryKey: ['casino-fairness'] })
  }, [queryClient])
}

export function useCasinoPlay<A extends Record<string, unknown>, R = Record<string, unknown>, P = Record<string, unknown>>(fn: string) {
  return useMutation({ mutationFn: (args: A) => callCasino<BetResult<R, P>>(fn, args) })
}

export function useCasinoAction<V extends SessionView, A extends Record<string, unknown> | undefined = undefined>(fn: string) {
  return useMutation({ mutationFn: (args: A) => callCasino<V>(fn, args) })
}

export function useActiveSession<V extends SessionView>(game: 'mines' | 'hilo' | 'blackjack') {
  return useQuery({
    queryKey: ['casino-session', game],
    enabled,
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<V | null> => {
      const { data, error } = await client().rpc('casino_active_session', { p_game: game })
      if (error) throw error
      return (data ?? null) as V | null
    },
  })
}

export type CasinoStats = { bets: number; wagered: number; paid: number; profit: number; wins: number; best_multiplier: number; best_win: number }

export const useCasinoStats = () => useQuery({
  queryKey: ['casino-stats'],
  enabled,
  retry: false,
  queryFn: () => callCasino<CasinoStats>('casino_stats'),
})

export type Fairness = { server_seed_hash: string; client_seed: string; nonce: number }
export type RotateResult = Fairness & { revealed: { server_seed: string; server_seed_hash: string; client_seed: string; bets_count: number } }

export const useFairness = () => useQuery({
  queryKey: ['casino-fairness'],
  enabled,
  retry: false,
  queryFn: () => callCasino<Fairness>('casino_fairness'),
})

export function useRotateSeed() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (clientSeed: string) => callCasino<RotateResult>('casino_rotate_seed', { p_client_seed: clientSeed }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['casino-fairness'] })
      void queryClient.invalidateQueries({ queryKey: ['casino-revealed'] })
    },
  })
}

export type RevealedSeed = { id: number; server_seed: string; server_seed_hash: string; client_seed: string; bets_count: number; revealed_at: string }

export const useRevealedSeeds = () => useQuery({
  queryKey: ['casino-revealed'],
  enabled,
  queryFn: async (): Promise<RevealedSeed[]> => {
    const { data, error } = await client().from('casino_revealed_seeds').select('*').order('revealed_at', { ascending: false }).limit(20)
    if (error) throw error
    return (data ?? []) as RevealedSeed[]
  },
})

export type BetRow = {
  id: number
  game: CasinoGame
  bet: number
  payout: number
  multiplier: number
  params: Record<string, unknown>
  result: Record<string, unknown>
  server_seed_hash: string
  client_seed: string
  nonce: number
  balance_after: number
  created_at: string
}

export const BETS_PAGE_SIZE = 25

export const useCasinoBets = (game: CasinoGame | '', pageSize = BETS_PAGE_SIZE) => useInfiniteQuery({
  queryKey: ['casino-bets', game, pageSize],
  enabled,
  initialPageParam: 0,
  queryFn: async ({ pageParam }): Promise<BetRow[]> => {
    let query = client().from('casino_bets').select('*').order('created_at', { ascending: false }).order('id', { ascending: false }).range(pageParam, pageParam + pageSize - 1)
    if (game) query = query.eq('game', game)
    const { data, error } = await query
    if (error) throw error
    return (data ?? []) as BetRow[]
  },
  getNextPageParam: (lastPage, pages) => (lastPage.length < pageSize ? undefined : pages.length * pageSize),
})

export function casinoErrorMessage(error: unknown) {
  const text = error instanceof Error ? error.message : typeof error === 'object' && error !== null && 'message' in error ? String((error as { message: unknown }).message) : ''
  if (text.includes('Insufficient balance')) return t('No tienes puntos suficientes para esta apuesta.')
  if (text.includes('Email confirmation')) return t('Confirma tu correo electrónico para jugar en el casino.')
  if (text.includes('Invalid bet')) return t('La apuesta debe estar entre 1 y 100.000 puntos.')
  if (text.includes('Game in progress')) return t('Tienes una partida sin terminar. Termínala antes de empezar otra o de cambiar la semilla.')
  if (text.includes('No active game')) return t('No hay ninguna partida en curso.')
  if (text.includes('Nothing to cash out')) return t('Aún no hay nada que retirar.')
  if (text.includes('Invalid parameters')) return t('Revisa los valores de la apuesta.')
  if (errorCode(error) === 'PGRST202' || text.includes('Could not find the function')) return t('El casino aún no está activado en la base de datos.')
  return t('No se pudo completar la jugada. Inténtalo de nuevo.')
}

export function verifyLink(row: Pick<BetRow, 'game' | 'client_seed' | 'nonce' | 'server_seed_hash' | 'params'>) {
  const query = new URLSearchParams({ game: row.game, client: row.client_seed, nonce: String(row.nonce), hash: row.server_seed_hash })
  if (row.game === 'plinko' && row.params.rows) query.set('rows', String(row.params.rows))
  if (row.game === 'mines' && row.params.mines) query.set('mines', String(row.params.mines))
  return `/dashboard/casino/juego-justo?${query}`
}
