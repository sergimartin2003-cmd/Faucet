// Casino rules shared by the game pages and the fairness verifier. The server
// (supabase/migrations/2026101700*_casino_*.sql) is the authority: these tables
// and formulas mirror it so the UI can show odds and players can re-derive any
// outcome from its seeds.

export const MIN_BET = 1
export const MAX_BET = 100_000
export const MAX_PAYOUT = 1_000_000

export type CasinoGame =
  | 'dice' | 'limbo' | 'crash' | 'coinflip' | 'roulette' | 'slots'
  | 'plinko' | 'keno' | 'wheel' | 'mines' | 'hilo' | 'blackjack'

export const GAME_LABELS: Record<CasinoGame, string> = {
  dice: 'Dados',
  limbo: 'Limbo',
  crash: 'Crash',
  coinflip: 'Cara o cruz',
  roulette: 'Ruleta',
  slots: 'Tragaperras',
  plinko: 'Plinko',
  keno: 'Keno',
  wheel: 'Rueda',
  mines: 'Minas',
  hilo: 'Hi-Lo',
  blackjack: 'Blackjack',
}

export const GAME_SLUGS: Record<CasinoGame, string> = {
  dice: 'dados',
  limbo: 'limbo',
  crash: 'crash',
  coinflip: 'cara-o-cruz',
  roulette: 'ruleta',
  slots: 'tragaperras',
  plinko: 'plinko',
  keno: 'keno',
  wheel: 'rueda',
  mines: 'minas',
  hilo: 'hi-lo',
  blackjack: 'blackjack',
}

// Return to player, as advertised in the lobby.
export const GAME_RTP: Record<CasinoGame, number> = {
  dice: 99, limbo: 99, crash: 99, coinflip: 99, roulette: 97.3, slots: 96.2,
  plinko: 99, keno: 99, wheel: 99, mines: 99, hilo: 99, blackjack: 99.4,
}

// ---------------------------------------------------------------------------
// Randomness: HMAC_SHA256(key = serverSeed, message = `${clientSeed}:${nonce}:${cursor}`)
// ---------------------------------------------------------------------------
const encoder = new TextEncoder()

export async function casinoFloats(serverSeed: string, clientSeed: string, nonce: number, count: number) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(serverSeed), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const out: number[] = []
  for (let cursor = 0; out.length < count; cursor++) {
    const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(`${clientSeed}:${nonce}:${cursor}`)))
    for (let i = 0; i < 8 && out.length < count; i++) {
      out.push(digest[i * 4] / 256 + digest[i * 4 + 1] / 65536 + digest[i * 4 + 2] / 16777216 + digest[i * 4 + 3] / 4294967296)
    }
  }
  return out
}

export async function sha256Hex(text: string) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(text)))
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

// ---------------------------------------------------------------------------
// Payout helpers
// ---------------------------------------------------------------------------
const trunc4 = (value: number) => Math.floor(value * 10000 + 1e-9) / 10000

export const payoutFor = (bet: number, multiplier: number) => Math.min(Math.floor(bet * multiplier + 1e-9), MAX_PAYOUT)

export function diceMultiplier(target: number, over: boolean) {
  const chance = over ? 100 - target : target
  return trunc4(99 / chance)
}

export const multiplierChance = (target: number) => Math.min(99, 99 / target)

export const crashPoint = (float: number) => Math.min(Math.max(Math.floor((0.99 / (1 - float)) * 100) / 100, 1), 1_000_000)

export const PLINKO_TABLES: Record<number, Record<Risk, number[]>> = {
  8: {
    low: [5.6, 2.1, 1.1, 1, 0.5, 1, 1.1, 2.1, 5.6],
    medium: [13, 3, 1.3, 0.7, 0.4, 0.7, 1.3, 3, 13],
    high: [29, 4, 1.5, 0.3, 0.2, 0.3, 1.5, 4, 29],
  },
  12: {
    low: [10, 3, 1.6, 1.4, 1.1, 1, 0.5, 1, 1.1, 1.4, 1.6, 3, 10],
    medium: [33, 11, 4, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 4, 11, 33],
    high: [170, 24, 8.1, 2, 0.7, 0.2, 0.2, 0.2, 0.7, 2, 8.1, 24, 170],
  },
  16: {
    low: [16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1, 0.5, 1, 1.1, 1.2, 1.4, 1.4, 2, 9, 16],
    medium: [110, 41, 10, 5, 3, 1.5, 1, 0.5, 0.3, 0.5, 1, 1.5, 3, 5, 10, 41, 110],
    high: [1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000],
  },
}

export type Risk = 'low' | 'medium' | 'high'
export const RISK_LABELS: Record<Risk, string> = { low: 'Bajo', medium: 'Medio', high: 'Alto' }

// Index = number of hits.
export const KENO_TABLES: Record<number, number[]> = {
  1: [0.7, 1.85],
  2: [0, 2, 3.8],
  3: [0, 1.1, 1.38, 26],
  4: [0, 0, 2.2, 7.9, 90],
  5: [0, 0, 1.5, 4.2, 13, 300],
  6: [0, 0, 1.1, 2, 6.2, 100, 700],
  7: [0, 0, 1.1, 1.6, 3.5, 15, 225, 700],
  8: [0, 0, 1.1, 1.5, 2, 5.5, 39, 100, 800],
  9: [0, 0, 1.1, 1.3, 1.7, 2.5, 7.5, 50, 250, 1000],
  10: [0, 0, 1.1, 1.2, 1.3, 1.8, 3.5, 13, 50, 250, 1000],
}

export const WHEEL_TABLES: Record<Risk, number[]> = {
  low: [1.5, 1.2, 1.2, 1.2, 0, 1.2, 1.2, 1.2, 1.2, 0, 1.5, 1.2, 1.2, 1.2, 0, 1.2, 1.2, 1.2, 1.2, 0],
  medium: [0, 1.9, 0, 1.5, 0, 2, 0, 1.5, 0, 3, 0, 1.9, 0, 1.5, 0, 2, 0, 1.5, 0, 3],
  high: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 19.8],
}

export type SlotSymbol = 'cherry' | 'lemon' | 'orange' | 'grape' | 'bell' | 'star' | 'seven'
export const SLOT_SYMBOLS: { symbol: SlotSymbol; weight: number; icon: string; three: number }[] = [
  { symbol: 'cherry', weight: 20, icon: '🍒', three: 10 },
  { symbol: 'lemon', weight: 18, icon: '🍋', three: 15 },
  { symbol: 'orange', weight: 16, icon: '🍊', three: 20 },
  { symbol: 'grape', weight: 14, icon: '🍇', three: 30 },
  { symbol: 'bell', weight: 12, icon: '🔔', three: 50 },
  { symbol: 'star', weight: 8, icon: '⭐', three: 100 },
  { symbol: 'seven', weight: 4, icon: '7️⃣', three: 500 },
]
export const SLOT_ICONS = Object.fromEntries(SLOT_SYMBOLS.map((s) => [s.symbol, s.icon])) as Record<SlotSymbol, string>

export function slotSymbol(float: number): SlotSymbol {
  let x = float * 92
  for (const entry of SLOT_SYMBOLS) {
    if (x < entry.weight) return entry.symbol
    x -= entry.weight
  }
  return 'seven'
}

export function slotsMultiplier(reels: SlotSymbol[]) {
  const [a, b, c] = reels
  if (a === b && b === c) return SLOT_SYMBOLS.find((s) => s.symbol === a)?.three ?? 0
  if (a === 'cherry' && b === 'cherry') return 4
  if (a === 'cherry') return 1
  return 0
}

export function minesMultiplier(mines: number, safe: number) {
  if (safe <= 0) return 1
  let m = 0.99
  for (let i = 0; i < safe; i++) m *= (25 - i) / (25 - mines - i)
  return trunc4(m)
}

// ---------------------------------------------------------------------------
// Cards: 0..51, rank = card % 13 (0 = A, 12 = K), suit = floor(card / 13)
// ---------------------------------------------------------------------------
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
const SUITS = ['♠', '♥', '♦', '♣']

export function cardInfo(card: number) {
  const suit = Math.floor(card / 13) % 4
  return { rank: RANKS[card % 13], suit: SUITS[suit], red: suit === 1 || suit === 2 }
}

export function hiloStep(card: number, choice: 'higher' | 'lower') {
  const rank = (card % 13) + 1
  const outs = choice === 'higher' ? 14 - rank : rank
  return outs >= 13 ? null : trunc4(12.87 / outs)
}

export function blackjackTotal(cards: number[]) {
  let total = 0
  let aces = 0
  for (const card of cards) {
    const rank = (card % 13) + 1
    if (rank === 1) { aces++; total += 11 } else total += Math.min(rank, 10)
  }
  while (total > 21 && aces > 0) { total -= 10; aces-- }
  return total
}

// ---------------------------------------------------------------------------
// Roulette (European, single zero)
// ---------------------------------------------------------------------------
export const ROULETTE_REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36])
export const ROULETTE_WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26]
export const rouletteColor = (n: number) => (n === 0 ? 'green' : ROULETTE_REDS.has(n) ? 'red' : 'black')

export type RouletteKind = 'number' | 'red' | 'black' | 'even' | 'odd' | 'low' | 'high' | 'dozen' | 'column'
export type RouletteBet = { kind: RouletteKind; value?: number; amount: number }

export function rouletteHits(bet: Pick<RouletteBet, 'kind' | 'value'>, n: number) {
  switch (bet.kind) {
    case 'number': return n === bet.value
    case 'red': return ROULETTE_REDS.has(n)
    case 'black': return n > 0 && !ROULETTE_REDS.has(n)
    case 'even': return n > 0 && n % 2 === 0
    case 'odd': return n % 2 === 1
    case 'low': return n >= 1 && n <= 18
    case 'high': return n >= 19 && n <= 36
    case 'dozen': return n >= ((bet.value ?? 0) - 1) * 12 + 1 && n <= (bet.value ?? 0) * 12
    case 'column': return n > 0 && ((n - 1) % 3) + 1 === bet.value
  }
}

export const roulettePays = (kind: RouletteKind) => (kind === 'number' ? 36 : kind === 'dozen' || kind === 'column' ? 3 : 2)

// ---------------------------------------------------------------------------
// Outcome derivation, identical to the SQL functions
// ---------------------------------------------------------------------------
function shuffledPrefix(size: number, take: number, floats: number[], offset = 0) {
  const pool = Array.from({ length: size }, (_, i) => i + offset)
  for (let i = 0; i < take; i++) {
    const j = i + Math.floor(floats[i] * (size - i))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, take)
}

export type VerifyParams = { rows?: number; mines?: number }

export async function deriveOutcome(game: CasinoGame, serverSeed: string, clientSeed: string, nonce: number, params: VerifyParams = {}) {
  const take = (count: number) => casinoFloats(serverSeed, clientSeed, nonce, count)
  switch (game) {
    case 'dice': return { roll: Math.floor((await take(1))[0] * 10001) / 100 }
    case 'limbo':
    case 'crash': return { point: crashPoint((await take(1))[0]) }
    case 'coinflip': return { side: (await take(1))[0] < 0.5 ? 'heads' : 'tails' }
    case 'roulette': return { number: Math.floor((await take(1))[0] * 37) }
    case 'slots': return { reels: (await take(3)).map(slotSymbol) }
    case 'wheel': return { segment: Math.floor((await take(1))[0] * 20) }
    case 'plinko': {
      const rows = params.rows ?? 16
      const path = (await take(rows)).map((f) => (f >= 0.5 ? 1 : 0))
      return { path, bucket: path.reduce<number>((sum, step) => sum + step, 0) }
    }
    case 'keno': return { drawn: shuffledPrefix(40, 10, await take(10), 1) }
    case 'mines': return { mines: shuffledPrefix(25, params.mines ?? 3, await take(24)) }
    case 'hilo': return { cards: (await take(100)).map((f) => Math.floor(f * 52)) }
    case 'blackjack': {
      const cards = (await take(52)).map((f) => Math.floor(f * 52))
      return { player: [cards[0], cards[2]], dealer: [cards[1], cards[3]], cards }
    }
  }
}

export const formatMultiplier = (value: number) => `${value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}×`
