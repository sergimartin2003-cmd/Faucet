import { describe, expect, it } from 'vitest'
import {
  KENO_TABLES, PLINKO_TABLES, SLOT_SYMBOLS, WHEEL_TABLES,
  blackjackTotal, casinoFloats, crashPoint, deriveOutcome, diceMultiplier, hiloStep, minesMultiplier,
  payoutFor, rouletteHits, sha256Hex, slotsMultiplier, type Risk, type SlotSymbol,
} from './casino'

const choose = (n: number, k: number) => {
  let result = 1
  for (let i = 1; i <= k; i++) result = (result * (n - k + i)) / i
  return result
}

describe('provably fair randomness', () => {
  // Reference values computed by public.casino_floats / public.casino_hash in Postgres.
  it('matches the server floats', async () => {
    const floats = await casinoFloats('server-seed-test', 'client-seed-test', 7, 10)
    expect(floats[0]).toBeCloseTo(0.823275690432638, 14)
    expect(floats[5]).toBeCloseTo(0.0626291006337851, 14)
    expect(floats[9]).toBeCloseTo(0.84221067186445, 14)
  })

  it('matches the server seed hash', async () => {
    expect(await sha256Hex('server-seed-test')).toBe('a944ba7481243b51154be6239cd634eb78d973b45ce0e5562e668ec80cb7587a')
  })

  it('derives the same outcomes as the server', async () => {
    const dice = await deriveOutcome('dice', 'server-seed-test', 'client-seed-test', 7)
    expect(dice).toEqual({ roll: Math.floor(0.823275690432638 * 10001) / 100 })
    const mines = await deriveOutcome('mines', 'server-seed-test', 'client-seed-test', 7, { mines: 5 })
    expect(new Set(mines.mines).size).toBe(5)
    const keno = await deriveOutcome('keno', 'server-seed-test', 'client-seed-test', 7)
    expect(new Set(keno.drawn).size).toBe(10)
    expect(keno.drawn?.every((n) => n >= 1 && n <= 40)).toBe(true)
  })
})

describe('house edge', () => {
  it('keeps plinko around 99% RTP', () => {
    for (const rows of [8, 12, 16]) {
      for (const risk of ['low', 'medium', 'high'] as Risk[]) {
        const rtp = PLINKO_TABLES[rows][risk].reduce((sum, m, i) => sum + (m * choose(rows, i)) / 2 ** rows, 0)
        expect(rtp).toBeGreaterThan(0.985)
        expect(rtp).toBeLessThan(0.995)
      }
    }
  })

  it('keeps keno around 99% RTP', () => {
    for (const [picks, table] of Object.entries(KENO_TABLES)) {
      const p = Number(picks)
      const rtp = table.reduce((sum, m, hits) => sum + (m * choose(p, hits) * choose(40 - p, 10 - hits)) / choose(40, 10), 0)
      expect(rtp).toBeGreaterThan(0.985)
      expect(rtp).toBeLessThan(0.995)
    }
  })

  it('keeps the wheel at 99% RTP', () => {
    for (const table of Object.values(WHEEL_TABLES)) {
      expect(table).toHaveLength(20)
      expect(table.reduce((a, b) => a + b, 0) / 20).toBeCloseTo(0.99, 6)
    }
  })

  it('keeps slots around 96% RTP', () => {
    const total = SLOT_SYMBOLS.reduce((sum, s) => sum + s.weight, 0)
    expect(total).toBe(92)
    let rtp = 0
    for (const a of SLOT_SYMBOLS) for (const b of SLOT_SYMBOLS) for (const c of SLOT_SYMBOLS) {
      rtp += ((a.weight * b.weight * c.weight) / total ** 3) * slotsMultiplier([a.symbol, b.symbol, c.symbol] as SlotSymbol[])
    }
    expect(rtp).toBeCloseTo(0.9619, 3)
  })

  it('prices dice, crash and mines with a 1% edge', () => {
    expect(diceMultiplier(50, true)).toBe(1.98)
    expect(diceMultiplier(2, false)).toBe(49.5)
    expect(crashPoint(0)).toBe(1)
    expect(crashPoint(0.5)).toBe(1.98)
    expect(minesMultiplier(3, 1)).toBe(1.125)
    expect(minesMultiplier(24, 1)).toBe(24.75)
  })
})

describe('game rules', () => {
  it('prices hi-lo steps like the server', () => {
    expect(hiloStep(42, 'higher')).toBe(1.287)
    expect(hiloStep(42, 'lower')).toBe(3.2175)
    expect(hiloStep(0, 'higher')).toBeNull()
    expect(hiloStep(12, 'lower')).toBeNull()
  })

  it('totals blackjack hands with soft aces', () => {
    expect(blackjackTotal([18, 24])).toBe(16)
    expect(blackjackTotal([15, 5, 4, 24])).toBe(24)
    expect(blackjackTotal([0, 12])).toBe(21)
    expect(blackjackTotal([0, 0, 8])).toBe(21)
  })

  it('resolves roulette bets', () => {
    expect(rouletteHits({ kind: 'red' }, 1)).toBe(true)
    expect(rouletteHits({ kind: 'black' }, 0)).toBe(false)
    expect(rouletteHits({ kind: 'even' }, 0)).toBe(false)
    expect(rouletteHits({ kind: 'dozen', value: 3 }, 36)).toBe(true)
    expect(rouletteHits({ kind: 'column', value: 1 }, 34)).toBe(true)
  })

  it('caps payouts', () => {
    expect(payoutFor(10, 1.98)).toBe(19)
    expect(payoutFor(100_000, 1000)).toBe(1_000_000)
  })
})
