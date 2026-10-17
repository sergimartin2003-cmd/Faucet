import { locale, t } from './i18n'

export const DAY_MS = 24 * 60 * 60 * 1000
// One level for every 1.000 points (1 USD) earned.
export const XP_PER_LEVEL = 1000

export type LedgerSource = 'daily_faucet' | 'earn_task' | 'offerwall' | 'referral' | 'survey' | 'video' | 'trivia' | 'scratch'
export type LedgerRow = { created_at: string; source_type: LedgerSource | string; points: number }

// Older sources (faucet, tasks, in-house surveys...) were retired but stay in the history.
const ledgerSourceLabel = (source: string) => {
  switch (source) {
    case 'offerwall': return t('Ofertas y encuestas')
    case 'referral': return t('Referido activo')
    case 'daily_faucet': return t('Faucet diario (retirado)')
    case 'earn_task': return t('Tarea (retirada)')
    case 'survey': return t('Encuesta interna (retirada)')
    case 'video': return t('Vídeo (retirado)')
    case 'trivia': return t('Trivia (retirada)')
    case 'scratch': return t('Rasca y gana (retirado)')
    default: return null
  }
}

export function levelFromXp(xp: number) {
  const safe = Math.max(0, Math.floor(xp))
  const intoLevel = safe % XP_PER_LEVEL
  return { level: Math.floor(safe / XP_PER_LEVEL) + 1, intoLevel, toNext: XP_PER_LEVEL - intoLevel, percent: (intoLevel / XP_PER_LEVEL) * 100 }
}

export const formatPoints = (value: number) => value.toLocaleString(locale())

export function utcMonthStart(now: Date) {
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
}

export function utcMonthEnd(now: Date) {
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
}

const utcDayKey = (timestamp: number) => new Date(timestamp).toISOString().slice(0, 10)

export function summarizeLedger(rows: LedgerRow[], now: Date) {
  const monthStart = utcMonthStart(now)
  const monthEnd = utcMonthEnd(now)
  let total = 0
  let monthPoints = 0
  const monthBySource: Record<string, number> = {}
  const bySource: Record<string, number> = {}
  for (const row of rows) {
    const at = Date.parse(row.created_at)
    total += row.points
    bySource[row.source_type] = (bySource[row.source_type] ?? 0) + 1
    if (at >= monthStart && at < monthEnd) {
      monthPoints += row.points
      monthBySource[row.source_type] = (monthBySource[row.source_type] ?? 0) + 1
    }
  }
  return {
    total,
    monthPoints,
    offerCount: bySource.offerwall ?? 0,
    monthReferrals: monthBySource.referral ?? 0,
    daysLeftInMonth: Math.max(1, Math.ceil((monthEnd - now.getTime()) / DAY_MS)),
  }
}

export function buildActivityGrid(rows: LedgerRow[], days: number, now: Date) {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const totals = new Map<string, number>()
  for (const row of rows) {
    const key = utcDayKey(Date.parse(row.created_at))
    totals.set(key, (totals.get(key) ?? 0) + row.points)
  }
  return Array.from({ length: days }, (_, index) => {
    const date = today - (days - 1 - index) * DAY_MS
    const key = utcDayKey(date)
    return { date: key, points: totals.get(key) ?? 0 }
  })
}

export type AchievementContext = {
  offerCount: number
  totalEarned: number
  rewardedReferrals: number
  paidWithdrawals: number
}

export type Achievement = { key: string; title: string; description: string; goal: number; value: (context: AchievementContext) => number }

// A function so titles and descriptions follow the current language.
export const achievements = (): Achievement[] => [
  { key: 'first-offer', title: t('Primer paso'), description: t('Completa tu primera oferta o encuesta.'), goal: 1, value: (c) => c.offerCount },
  { key: 'offers-10', title: t('Constancia'), description: t('Completa 10 ofertas o encuestas.'), goal: 10, value: (c) => c.offerCount },
  { key: 'offers-50', title: t('Habitual'), description: t('Completa 50 ofertas o encuestas.'), goal: 50, value: (c) => c.offerCount },
  { key: 'points-1000', title: t('Primer dólar'), description: t('Gana 1.000 puntos en total.'), goal: 1000, value: (c) => c.totalEarned },
  { key: 'points-5000', title: t('Listo para retirar'), description: t('Gana 5.000 puntos en total.'), goal: 5000, value: (c) => c.totalEarned },
  { key: 'points-25000', title: t('25 dólares'), description: t('Gana 25.000 puntos en total.'), goal: 25000, value: (c) => c.totalEarned },
  { key: 'withdrawal', title: t('Primer cobro'), description: t('Recibe tu primer retiro en crypto.'), goal: 1, value: (c) => c.paidWithdrawals },
  { key: 'referral', title: t('Embajador'), description: t('Consigue un referido activo.'), goal: 1, value: (c) => c.rewardedReferrals },
  { key: 'referrals-5', title: t('Comunidad'), description: t('Consigue 5 referidos activos.'), goal: 5, value: (c) => c.rewardedReferrals },
]

export function evaluateAchievements(context: AchievementContext) {
  return achievements().map((achievement) => {
    const value = Math.min(achievement.goal, achievement.value(context))
    return { ...achievement, progress: value, unlocked: value >= achievement.goal }
  })
}

export function toCsv(rows: (string | number)[][]) {
  return rows.map((row) => row.map((cell) => {
    const text = String(cell)
    return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }).join(',')).join('\n')
}

export function describeLedgerEntry(sourceType: string) {
  return ledgerSourceLabel(sourceType) ?? t('Recompensa')
}
