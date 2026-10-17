import { useMemo, useState } from 'react'
import { ArrowUpFromLine, Award, ClipboardList, Coins, Users, type LucideIcon } from 'lucide-react'
import { Badge, Card, PageHeader, ProgressBar, Skeleton } from '../../ui'
import { evaluateAchievements, formatPoints, summarizeLedger } from '../../lib/game'
import { useLedger, useReferralSummary, useWithdrawals } from '../../lib/queries'
import { t } from '../../lib/i18n'

const ICONS: Record<string, LucideIcon> = {
  'first-offer': ClipboardList, 'offers-10': ClipboardList, 'offers-50': ClipboardList,
  'points-1000': Coins, 'points-5000': Coins, 'points-25000': Coins,
  withdrawal: ArrowUpFromLine, referral: Users, 'referrals-5': Users,
}

export default function AchievementsPage() {
  const ledger = useLedger()
  const withdrawals = useWithdrawals()
  const referral = useReferralSummary()
  const [now] = useState(() => new Date())
  const loading = ledger.isLoading || withdrawals.isLoading

  const achievements = useMemo(() => {
    const summary = ledger.data ? summarizeLedger(ledger.data, now) : null
    return evaluateAchievements({
      offerCount: summary?.offerCount ?? 0,
      totalEarned: summary?.total ?? 0,
      rewardedReferrals: referral.data?.rewarded_referrals ?? 0,
      paidWithdrawals: withdrawals.data?.filter((row) => row.status === 'paid').length ?? 0,
    })
  }, [ledger.data, withdrawals.data, referral.data, now])

  const unlocked = achievements.filter((achievement) => achievement.unlocked).length

  return <>
    <PageHeader title={t('Logros')} description={loading ? t('Cargando tu progreso…') : t('{unlocked} de {total} logros desbloqueados.', { unlocked, total: achievements.length })} />
    {loading ? <div className="achievement-grid">{Array.from({ length: 6 }, (_, key) => <Skeleton key={key} height={120} style={{ borderRadius: 12 }} />)}</div>
      : <div className="achievement-grid">{achievements.map((achievement) => {
        const Icon = ICONS[achievement.key] ?? Award
        return <Card key={achievement.key} className={`achievement ${achievement.unlocked ? 'achievement-unlocked' : 'achievement-locked'}`}>
          <div className="achievement-head">
            <span className="achievement-icon"><Icon size={18} /></span>
            <div style={{ flex: 1 }}><h3 style={{ fontSize: 'var(--text-base)' }}>{achievement.title}</h3></div>
            {achievement.unlocked && <Badge tone="success">{t('Logrado')}</Badge>}
          </div>
          <p>{achievement.description}</p>
          <div className="stack" style={{ gap: 6 }}>
            <ProgressBar value={(achievement.progress / achievement.goal) * 100} label={achievement.title} />
            <span className="faint tnum" style={{ fontSize: 'var(--text-xs)' }}>{formatPoints(achievement.progress)} / {formatPoints(achievement.goal)}</span>
          </div>
        </Card>
      })}</div>}
  </>
}
