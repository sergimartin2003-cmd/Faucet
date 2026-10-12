import { useId, type ReactNode } from 'react'

type GaugeProps = {
  fill: number
  size?: number
  ready?: boolean
  children?: ReactNode
  label?: string
}

const WAVE = 'M0 0 Q25 -9 50 0 T100 0 T150 0 T200 0 T250 0 T300 0 T350 0 T400 0 V240 H0 Z'

export default function Gauge({ fill, size = 220, ready = false, children, label }: GaugeProps) {
  const id = useId()
  const level = Math.min(1, Math.max(0, fill))
  const offset = 200 - level * 196 + 4

  return <div className={`gauge${ready ? ' gauge-ready' : ''}`} style={{ width: size, height: size }} role={label ? 'img' : undefined} aria-label={label}>
    <svg viewBox="0 0 200 200" aria-hidden="true">
      <defs>
        <clipPath id={`${id}-clip`}><circle cx="100" cy="100" r="88" /></clipPath>
        <linearGradient id={`${id}-water`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--accent-hover)" stopOpacity=".95" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity=".55" />
        </linearGradient>
      </defs>
      <circle className="gauge-ring" cx="100" cy="100" r="96" />
      <circle className="gauge-ticks" cx="100" cy="100" r="96" />
      <g clipPath={`url(#${id}-clip)`}>
        <circle className="gauge-bg" cx="100" cy="100" r="88" />
        <g className="gauge-level" style={{ transform: `translateY(${offset}px)` }}>
          <path className="gauge-wave gauge-wave-back" d={WAVE} fill="var(--accent)" fillOpacity=".28" />
          <path className="gauge-wave gauge-wave-front" d={WAVE} fill={`url(#${id}-water)`} />
        </g>
        <circle className="gauge-shine" cx="72" cy="62" r="34" />
      </g>
    </svg>
    <div className="gauge-content">{children}</div>
  </div>
}
