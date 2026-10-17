import { formatPoints } from '../../lib/game'
import { locale, t } from '../../lib/i18n'

// Shades for a day's earnings (1.000 points = 1 USD).
function level(points: number) {
  if (points <= 0) return 0
  if (points < 500) return 1
  if (points < 2000) return 2
  return 3
}

export default function ActivityHeatmap({ days }: { days: { date: string; points: number }[] }) {
  const dayFormat = new Intl.DateTimeFormat(locale(), { dateStyle: 'long', timeZone: 'UTC' })
  const firstDay = new Date(`${days[0].date}T00:00:00Z`).getUTCDay()
  const offset = (firstDay + 6) % 7
  return <div>
    <div className="heatmap" role="img" aria-label={t('Mapa de actividad de las últimas 16 semanas')}>
      {Array.from({ length: offset }, (_, index) => <span key={`pad-${index}`} />)}
      {days.map((day) => <span key={day.date} className={`heat-cell${level(day.points) ? ` heat-${level(day.points)}` : ''}`} title={t('{date}: {points} puntos', { date: dayFormat.format(new Date(`${day.date}T00:00:00Z`)), points: formatPoints(day.points) })} />)}
    </div>
    <div className="heat-legend"><span>{t('Menos')}</span>{[0, 1, 2, 3].map((value) => <span key={value} className={`heat-cell${value ? ` heat-${value}` : ''}`} />)}<span>{t('Más')}</span></div>
  </div>
}
