import { describe, expect, it } from 'vitest'
import { describeLedgerEntry, buildActivityGrid, evaluateAchievements, levelFromXp, summarizeLedger, toCsv } from './game'
import { MIN_WITHDRAWAL_POINTS, explorerUrl, formatUsd, isValidAddress, pointsToUsd } from './payouts'

describe('levelFromXp', () => {
  it('computes level and progress', () => {
    expect(levelFromXp(0)).toMatchObject({ level: 1, intoLevel: 0, toNext: 1000 })
    expect(levelFromXp(2500)).toMatchObject({ level: 3, intoLevel: 500, toNext: 500, percent: 50 })
  })
})

describe('ledger summaries', () => {
  const now = new Date('2026-10-15T10:00:00.000Z')
  const rows = [
    { created_at: '2026-10-14T09:00:00.000Z', source_type: 'offerwall', points: 12 },
    { created_at: '2026-10-13T09:00:00.000Z', source_type: 'offerwall', points: 10 },
    { created_at: '2026-10-02T09:00:00.000Z', source_type: 'referral', points: 15 },
    { created_at: '2026-09-30T23:00:00.000Z', source_type: 'offerwall', points: 10 },
  ]
  it('splits month and total', () => {
    const summary = summarizeLedger(rows, now)
    expect(summary.total).toBe(47)
    expect(summary.monthPoints).toBe(37)
    expect(summary.offerCount).toBe(3)
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
    const result = evaluateAchievements({ offerCount: 10, totalEarned: 6000, rewardedReferrals: 1, paidWithdrawals: 0 })
    const unlocked = result.filter((item) => item.unlocked).map((item) => item.key)
    expect(unlocked).toEqual(['first-offer', 'offers-10', 'points-1000', 'points-5000', 'referral'])
    expect(result.find((item) => item.key === 'offers-50')?.progress).toBe(10)
  })
})

describe('toCsv', () => {
  it('escapes special characters', () => {
    expect(toCsv([['a', 'b,c'], [1, 'say "hi"']])).toBe('a,"b,c"\n1,"say ""hi"""')
  })
})

describe('describeLedgerEntry', () => {
  it('labels current and retired sources', () => {
    for (const source of ['offerwall', 'referral', 'daily_faucet', 'survey', 'video', 'trivia', 'scratch']) {
      expect(describeLedgerEntry(source)).not.toBe('Recompensa')
    }
  })
  it('falls back for unknown sources', () => {
    expect(describeLedgerEntry('something_else')).toBe('Recompensa')
  })
})

describe('payouts', () => {
  it('converts points to dollars', () => {
    expect(pointsToUsd(MIN_WITHDRAWAL_POINTS)).toBe(5)
    expect(formatUsd(pointsToUsd(1234))).toContain('1,23')
  })
  it('validates addresses per network', () => {
    expect(isValidAddress('usdt_bep20', '0x52908400098527886E0F7030069857D2E4169EE7')).toBe(true)
    expect(isValidAddress('usdt_bep20', '0x123')).toBe(false)
    expect(isValidAddress('trx', 'TJRyWwFs9wTFGZg3JbrVriFbNfCug5tDeC')).toBe(true)
    expect(isValidAddress('ltc', 'ltc1qg82d4l5v9rj3u5ewkqxkx9zv0nr6x8dm2h9x6g')).toBe(true)
    expect(isValidAddress('doge', 'DH5yaieqoZN36fDVciNyRueRGvGLR3mr7L')).toBe(true)
    expect(isValidAddress('binance_pay', '123456789')).toBe(true)
    expect(isValidAddress('binance_pay', 'abc')).toBe(false)
  })
  it('links only real transaction hashes', () => {
    expect(explorerUrl('usdt_bep20', `0x${'a'.repeat(64)}`)).toMatch(/^https:\/\/bscscan\.com\/tx\//)
    expect(explorerUrl('binance_pay', '123')).toBeNull()
    expect(explorerUrl('ltc', 'manual')).toBeNull()
  })
})
