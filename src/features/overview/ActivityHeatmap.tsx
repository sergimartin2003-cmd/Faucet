const pointsFormat = new Intl.DateTimeFormat('es-ES', { dateStyle: 'long', timeZone: 'UTC' })

function level(points: number) {
  if (points <= 0) return 0
  if (points < 12) return 1
  if (points < 25) return 2
  return 3
}

export default function ActivityHeatmap({ days }: { days: { date: string; points: number }[] }) {
  const firstDay = new Date(`${days[0].date}T00:00:00Z`).getUTCDay()
  const offset = (firstDay + 6) % 7
  return <div>
    <div className="heatmap" role="img" aria-label="Mapa de actividad de las últimas 16 semanas">
      {Array.from({ length: offset }, (_, index) => <span key={`pad-${index}`} />)}
      {days.map((day) => <span key={day.date} className={`heat-cell${level(day.points) ? ` heat-${level(day.points)}` : ''}`} title={`${pointsFormat.format(new Date(`${day.date}T00:00:00Z`))}: ${day.points} puntos`} />)}
    </div>
    <div className="heat-legend"><span>Menos</span>{[0, 1, 2, 3].map((value) => <span key={value} className={`heat-cell${value ? ` heat-${value}` : ''}`} />)}<span>Más</span></div>
  </div>
}
