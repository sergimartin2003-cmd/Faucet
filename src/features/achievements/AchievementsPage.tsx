import { useMemo, useState } from 'react'
import { Award, Coins, Flame, Gift, ShieldCheck, User, Users, type LucideIcon } from 'lucide-react'
import { Badge, Card, PageHeader, ProgressBar, Skeleton } from '../../ui'
import { evaluateAchievements, summarizeLedger } from '../../lib/game'
import { useCompletedTasks, useFaucetState, useLedger, useReferralSummary } from '../../lib/queries'

const ICONS: Record<string, LucideIcon> = {
  'first-claim': Gift, 'claims-10': Gift, 'claims-50': Gift,
  'streak-3': Flame, 'streak-7': Flame, 'streak-30': Flame,
  'points-100': Coins, 'points-500': Coins, 'points-1000': Coins,
  profile: User, details: User, 'two-factor': ShieldCheck, referral: Users,
}

export default function AchievementsPage() {
  const ledger = useLedger()
  const faucet = useFaucetState()
  const tasks = useCompletedTasks()
  const referral = useReferralSummary()
  const [now] = useState(() => new Date())
  const loading = ledger.isLoading || faucet.isLoading || tasks.isLoading

  const achievements = useMemo(() => {
    const summary = ledger.data ? summarizeLedger(ledger.data, now) : null
    return evaluateAchievements({
      claimCount: summary?.claimCount ?? 0,
      bestStreak: faucet.data?.bestStreak ?? 0,
      totalEarned: summary?.total ?? 0,
      completedTasks: tasks.data?.map((task) => task.task_key) ?? [],
      rewardedReferrals: referral.data?.rewarded_referrals ?? 0,
    })
  }, [ledger.data, faucet.data, tasks.data, referral.data, now])

  const unlocked = achievements.filter((achievement) => achievement.unlocked).length

  return <>
    <PageHeader title="Logros" description={loading ? 'Cargando tu progreso…' : `${unlocked} de ${achievements.length} logros desbloqueados.`} />
    {loading ? <div className="achievement-grid">{Array.from({ length: 6 }, (_, key) => <Skeleton key={key} height={120} style={{ borderRadius: 12 }} />)}</div>
      : <div className="achievement-grid">{achievements.map((achievement) => {
        const Icon = ICONS[achievement.key] ?? Award
        return <Card key={achievement.key} className={`achievement ${achievement.unlocked ? 'achievement-unlocked' : 'achievement-locked'}`}>
          <div className="achievement-head">
            <span className="achievement-icon"><Icon size={18} /></span>
            <div style={{ flex: 1 }}><h3 style={{ fontSize: 'var(--text-base)' }}>{achievement.title}</h3></div>
            {achievement.unlocked && <Badge tone="success">Logrado</Badge>}
          </div>
          <p>{achievement.description}</p>
          <div className="stack" style={{ gap: 6 }}>
            <ProgressBar value={(achievement.progress / achievement.goal) * 100} label={achievement.title} />
            <span className="faint tnum" style={{ fontSize: 'var(--text-xs)' }}>{achievement.progress.toLocaleString('es-ES')} / {achievement.goal.toLocaleString('es-ES')}</span>
          </div>
        </Card>
      })}</div>}
  </>
}
