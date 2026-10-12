import { describe, expect, it } from 'vitest'
import { describeLedgerEntry, buildActivityGrid, claimCooldownMs, evaluateAchievements, faucetReward, formatCountdown, isStreakAlive, levelFromXp, summarizeLedger, toCsv } from './game'

describe('faucetReward', () => {
  it('starts at 10 and grows 2 per streak day up to 22', () => {
    expect(faucetReward(0)).toBe(10)
    expect(faucetReward(1)).toBe(10)
    expect(faucetReward(2)).toBe(12)
    expect(faucetReward(7)).toBe(22)
    expect(faucetReward(30)).toBe(22)
  })
})

describe('levelFromXp', () => {
  it('computes level and progress', () => {
    expect(levelFromXp(0)).toMatchObject({ level: 1, intoLevel: 0, toNext: 100 })
    expect(levelFromXp(250)).toMatchObject({ level: 3, intoLevel: 50, toNext: 50, percent: 50 })
  })
})

describe('claim timing', () => {
  const claimed = '2026-10-10T12:00:00.000Z'
  const at = (hours: number) => Date.parse(claimed) + hours * 3_600_000
  it('enforces 24h cooldown', () => {
    expect(claimCooldownMs(claimed, at(10))).toBe(14 * 3_600_000)
    expect(claimCooldownMs(claimed, at(25))).toBe(0)
    expect(claimCooldownMs(null, at(0))).toBe(0)
  })
  it('keeps the streak alive for 48h', () => {
    expect(isStreakAlive(claimed, at(47))).toBe(true)
    expect(isStreakAlive(claimed, at(49))).toBe(false)
    expect(isStreakAlive(null, at(1))).toBe(false)
  })
  it('formats countdowns', () => {
    expect(formatCountdown(3_723_000)).toBe('01:02:03')
    expect(formatCountdown(-5)).toBe('00:00:00')
  })
})

describe('ledger summaries', () => {
  const now = new Date('2026-10-15T10:00:00.000Z')
  const rows = [
    { created_at: '2026-10-14T09:00:00.000Z', source_type: 'daily_faucet', points: 12 },
    { created_at: '2026-10-13T09:00:00.000Z', source_type: 'daily_faucet', points: 10 },
    { created_at: '2026-10-02T09:00:00.000Z', source_type: 'referral', points: 15 },
    { created_at: '2026-09-30T23:00:00.000Z', source_type: 'daily_faucet', points: 10 },
  ]
  it('splits month and total', () => {
    const summary = summarizeLedger(rows, now)
    expect(summary.total).toBe(47)
    expect(summary.monthPoints).toBe(37)
    expect(summary.claimCount).toBe(3)
    expect(summary.monthClaimDays).toBe(2)
    expect(summary.monthReferrals).toBe(1)
    expect(summary.daysLeftInMonth).toBe(17)
  })
  it('builds an activity grid ending today', () => {
    const grid = buildActivityGrid(rows, 3, now)
    expect(grid.map((cell) => cell.date)).toEqual(['2026-10-13', '2026-10-14', '2026-10-15'])
    expect(grid.map((cell) => cell.points)).toEqual([10, 12, 0])
  })
})

describe('achievements', () => {
  it('unlocks by thresholds', () => {
    const result = evaluateAchievements({ claimCount: 10, bestStreak: 3, totalEarned: 120, completedTasks: ['complete_profile'], rewardedReferrals: 0 })
    const unlocked = result.filter((item) => item.unlocked).map((item) => item.key)
    expect(unlocked).toEqual(['first-claim', 'claims-10', 'streak-3', 'points-100', 'profile'])
    expect(result.find((item) => item.key === 'streak-7')?.progress).toBe(3)
  })
})

describe('toCsv', () => {
  it('escapes special characters', () => {
    expect(toCsv([['a', 'b,c'], [1, 'say "hi"']])).toBe('a,"b,c"\n1,"say ""hi"""')
  })
})

describe('describeLedgerEntry', () => {
  it('labels every earn source', () => {
    for (const source of ['daily_faucet', 'survey', 'video', 'trivia', 'scratch']) {
      expect(describeLedgerEntry(source, null)).not.toBe('Recompensa')
    }
  })
  it('falls back for unknown sources', () => {
    expect(describeLedgerEntry('something_else', null)).toBe('Recompensa')
  })
})
