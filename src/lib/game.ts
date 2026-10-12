export const FAUCET_BASE_REWARD = 10
export const FAUCET_MAX_BONUS_DAYS = 6
export const FAUCET_MAX_REWARD = FAUCET_BASE_REWARD + 2 * FAUCET_MAX_BONUS_DAYS
export const DAY_MS = 24 * 60 * 60 * 1000
export const STREAK_WINDOW_MS = 2 * DAY_MS
export const XP_PER_LEVEL = 100

export type LedgerSource = 'daily_faucet' | 'earn_task' | 'offerwall' | 'referral' | 'survey' | 'video' | 'trivia' | 'scratch'
export type LedgerRow = { created_at: string; source_type: LedgerSource | string; points: number }

export const LEDGER_SOURCE_LABELS: Record<string, string> = {
  daily_faucet: 'Faucet diario',
  earn_task: 'Tarea',
  referral: 'Referido verificado',
  offerwall: 'Oferta de proveedor',
  survey: 'Encuesta',
  video: 'Vídeo visto',
  trivia: 'Trivia diaria',
  scratch: 'Rasca y gana',
}

export const faucetReward = (streak: number) => FAUCET_BASE_REWARD + 2 * Math.min(Math.max(streak - 1, 0), FAUCET_MAX_BONUS_DAYS)

export function levelFromXp(xp: number) {
  const safe = Math.max(0, Math.floor(xp))
  const intoLevel = safe % XP_PER_LEVEL
  return { level: Math.floor(safe / XP_PER_LEVEL) + 1, intoLevel, toNext: XP_PER_LEVEL - intoLevel, percent: (intoLevel / XP_PER_LEVEL) * 100 }
}

export function isStreakAlive(lastClaimAt: string | null, now: number) {
  return lastClaimAt !== null && now - Date.parse(lastClaimAt) < STREAK_WINDOW_MS
}

export function claimCooldownMs(lastClaimAt: string | null, now: number) {
  return lastClaimAt ? Math.max(0, Date.parse(lastClaimAt) + DAY_MS - now) : 0
}

export function formatCountdown(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`
}

export const formatPoints = (value: number) => value.toLocaleString('es-ES')

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
  const claimDays = new Set<string>()
  const monthClaimDays = new Set<string>()
  const monthBySource: Record<string, number> = {}
  const bySource: Record<string, number> = {}
  for (const row of rows) {
    const at = Date.parse(row.created_at)
    total += row.points
    bySource[row.source_type] = (bySource[row.source_type] ?? 0) + 1
    if (row.source_type === 'daily_faucet') claimDays.add(utcDayKey(at))
    if (at >= monthStart && at < monthEnd) {
      monthPoints += row.points
      monthBySource[row.source_type] = (monthBySource[row.source_type] ?? 0) + 1
      if (row.source_type === 'daily_faucet') monthClaimDays.add(utcDayKey(at))
    }
  }
  return {
    total,
    monthPoints,
    claimCount: bySource.daily_faucet ?? 0,
    claimDays: claimDays.size,
    monthClaimDays: monthClaimDays.size,
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
  claimCount: number
  bestStreak: number
  totalEarned: number
  completedTasks: string[]
  rewardedReferrals: number
}

export type Achievement = { key: string; title: string; description: string; goal: number; value: (context: AchievementContext) => number }

export const ACHIEVEMENTS: Achievement[] = [
  { key: 'first-claim', title: 'Primer paso', description: 'Reclama el faucet por primera vez.', goal: 1, value: (c) => c.claimCount },
  { key: 'claims-10', title: 'Constancia', description: 'Reclama el faucet 10 veces.', goal: 10, value: (c) => c.claimCount },
  { key: 'claims-50', title: 'Habitual', description: 'Reclama el faucet 50 veces.', goal: 50, value: (c) => c.claimCount },
  { key: 'streak-3', title: 'Racha de 3 días', description: 'Reclama 3 días seguidos.', goal: 3, value: (c) => c.bestStreak },
  { key: 'streak-7', title: 'Racha de 7 días', description: 'Reclama 7 días seguidos.', goal: 7, value: (c) => c.bestStreak },
  { key: 'streak-30', title: 'Racha de 30 días', description: 'Reclama 30 días seguidos.', goal: 30, value: (c) => c.bestStreak },
  { key: 'points-100', title: '100 puntos', description: 'Acumula 100 puntos en total.', goal: 100, value: (c) => c.totalEarned },
  { key: 'points-500', title: '500 puntos', description: 'Acumula 500 puntos en total.', goal: 500, value: (c) => c.totalEarned },
  { key: 'points-1000', title: '1.000 puntos', description: 'Acumula 1.000 puntos en total.', goal: 1000, value: (c) => c.totalEarned },
  { key: 'profile', title: 'Perfil completo', description: 'Completa la tarea de perfil.', goal: 1, value: (c) => Number(c.completedTasks.includes('complete_profile')) },
  { key: 'details', title: 'Datos al día', description: 'Añade país, bio y color de avatar.', goal: 1, value: (c) => Number(c.completedTasks.includes('profile_details')) },
  { key: 'two-factor', title: 'Cuenta protegida', description: 'Activa la autenticación en dos pasos.', goal: 1, value: (c) => Number(c.completedTasks.includes('enable_2fa')) },
  { key: 'referral', title: 'Embajador', description: 'Consigue un referido verificado.', goal: 1, value: (c) => c.rewardedReferrals },
]

export function evaluateAchievements(context: AchievementContext) {
  return ACHIEVEMENTS.map((achievement) => {
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

export const TASKS = [
  { key: 'complete_profile', title: 'Completar el perfil', description: 'Añade un nombre visible y verifica tu correo electrónico.', reward: 25 },
  { key: 'profile_details', title: 'Completar los datos del perfil', description: 'Indica tu país, escribe una breve bio y elige el color de tu avatar.', reward: 10 },
  { key: 'enable_2fa', title: 'Activar la autenticación en dos pasos', description: 'Protege tu cuenta con una app autenticadora (TOTP).', reward: 30 },
] as const

export const TASK_LABELS: Record<string, string> = Object.fromEntries(TASKS.map((task) => [task.key, task.title]))

export function describeLedgerEntry(sourceType: string, detail: string | null) {
  if (sourceType === 'earn_task') return `Tarea: ${(detail && TASK_LABELS[detail]) || 'completada'}`
  return LEDGER_SOURCE_LABELS[sourceType] ?? 'Recompensa'
}
