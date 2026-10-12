import { claimCooldownMs, faucetReward, isStreakAlive } from '../../lib/game'
import { useFaucetState } from '../../lib/queries'
import { useNow } from '../../lib/useNow'

export function useFaucetStatus() {
  const query = useFaucetState()
  const now = useNow(1000)
  const data = query.data
  const lastClaimAt = data?.lastClaimAt ?? null
  const cooldownMs = claimCooldownMs(lastClaimAt, now)
  const activeStreak = data && isStreakAlive(lastClaimAt, now) ? data.streak : 0
  return {
    ...query,
    points: data?.points ?? null,
    bestStreak: data?.bestStreak ?? 0,
    lastClaimAt,
    cooldownMs,
    available: Boolean(data) && cooldownMs === 0,
    activeStreak,
    nextReward: faucetReward(activeStreak + 1),
  }
}
