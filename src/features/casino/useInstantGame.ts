import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useToast } from '../../ui/toastContext'
import { MIN_BET } from '../../lib/casino'
import { useFaucetStatus } from '../faucet/useFaucetStatus'
import { callCasino, casinoErrorMessage, useActiveSession, useApplyBalance, type BetResult, type SessionView } from './api'

export const reducedMotion = () => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

// Runs one round of a single-step game: the server settles it, the page
// animates towards the returned outcome for `revealMs`, then the result and the
// new balance are shown together.
export function useInstantGame<A extends Record<string, unknown>, R, P = Record<string, unknown>>(fn: string, revealMs: number | ((result: BetResult<R, P>) => number)) {
  const toast = useToast()
  const applyBalance = useApplyBalance()
  const [result, setResult] = useState<BetResult<R, P> | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [busy, setBusy] = useState(false)

  const run = useCallback(async (args: A) => {
    setBusy(true)
    setRevealed(false)
    try {
      const next = await callCasino<BetResult<R, P>>(fn, args)
      setResult(next)
      await new Promise((resolve) => setTimeout(resolve, reducedMotion() ? 0 : typeof revealMs === 'function' ? revealMs(next) : revealMs))
      setRevealed(true)
      applyBalance(next.balance)
      return next
    } catch (error) {
      toast(casinoErrorMessage(error), 'error')
      return null
    } finally {
      setBusy(false)
    }
  }, [applyBalance, fn, revealMs, toast])

  return { run, result, revealed, busy }
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, reducedMotion() ? 0 : ms))

export function useCanBet(bet: number) {
  const { points } = useFaucetStatus()
  return points !== null && bet >= MIN_BET && bet <= points
}

// Multi-step games (mines, hi-lo, blackjack): resumes the open round after a
// reload and applies each server response as the new view.
export function useSessionGame<V extends SessionView>(game: SessionView['game']) {
  const toast = useToast()
  const applyBalance = useApplyBalance()
  const queryClient = useQueryClient()
  const active = useActiveSession<V>(game)
  const [local, setView] = useState<V | null>(null)
  const [busy, setBusy] = useState(false)
  const view = local ?? active.data ?? null

  const call = useCallback(async (fn: string, args?: Record<string, unknown>) => {
    setBusy(true)
    try {
      const next = await callCasino<V>(fn, args)
      setView(next)
      applyBalance(next.balance)
      queryClient.setQueryData(['casino-session', game], next.active ? next : null)
      return next
    } catch (error) {
      toast(casinoErrorMessage(error), 'error')
      return null
    } finally {
      setBusy(false)
    }
  }, [applyBalance, game, queryClient, toast])

  return { view, busy, loading: active.isLoading, call }
}
