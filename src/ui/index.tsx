import { useEffect, useRef, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react'
import { CheckCircle2, CircleAlert, Info, TriangleAlert } from 'lucide-react'

export function Card({ children, className = '', pad = true }: { children: ReactNode; className?: string; pad?: boolean }) {
  return <section className={`card${pad ? ' card-pad' : ''} ${className}`.trim()}>{children}</section>
}

export function CardHeader({ title, description, action }: { title: ReactNode; description?: ReactNode; action?: ReactNode }) {
  return <div className="card-header">
    <div><h2 className="card-title">{title}</h2>{description && <p className="card-description">{description}</p>}</div>
    {action}
  </div>
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger' }) {
  return <span className={`badge${tone === 'neutral' ? '' : ` badge-${tone}`}`}>{children}</span>
}

export function Stat({ label, value, unit, hint }: { label: string; value: ReactNode; unit?: string; hint?: ReactNode }) {
  return <div className="stat">
    <span className="stat-label">{label}</span>
    <span className="stat-value">{value}{unit && <small>{unit}</small>}</span>
    {hint && <span className="stat-hint">{hint}</span>}
  </div>
}

export function Skeleton({ width = '100%', height = 16, style }: { width?: number | string; height?: number | string; style?: CSSProperties }) {
  return <span className="skeleton" style={{ width, height, ...style }} aria-hidden="true" />
}

export function ProgressBar({ value, label }: { value: number; label: string }) {
  const percent = Math.max(0, Math.min(100, value))
  return <div className="progress" role="progressbar" aria-label={label} aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${percent}%` }} /></div>
}

export function Avatar({ name, color, size = 'md' }: { name?: string | null; color?: string | null; size?: 'md' | 'lg' }) {
  const initial = (name?.trim() || '?').slice(0, 1).toUpperCase()
  return <span className={`avatar${size === 'lg' ? ' avatar-lg' : ''}`} style={color ? { background: color } : undefined} aria-hidden="true">{initial}</span>
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return <div className="empty">{icon}<strong>{title}</strong>{description && <p>{description}</p>}{action}</div>
}

const ALERT_ICONS = { info: Info, success: CheckCircle2, warning: TriangleAlert, error: CircleAlert }

export function Alert({ tone = 'info', children }: { tone?: keyof typeof ALERT_ICONS; children: ReactNode }) {
  const Icon = ALERT_ICONS[tone]
  return <div className={`alert alert-${tone}`} role={tone === 'error' ? 'alert' : 'status'}><Icon size={16} /><div>{children}</div></div>
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (value: boolean) => void; label: string; disabled?: boolean }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} className="switch" onClick={() => onChange(!checked)} />
}

export function Spinner() { return <span className="spinner" role="status" aria-label="Cargando" /> }

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' | 'md' | 'lg'; loading?: boolean }

export function Button({ variant = 'secondary', size = 'md', loading = false, className = '', children, disabled, ...rest }: ButtonProps) {
  return <button {...rest} disabled={disabled || loading} className={`btn btn-${variant}${size === 'md' ? '' : ` btn-${size}`} ${className}`.trim()}>{loading && <Spinner />}{children}</button>
}

export function Dialog({ title, children, actions, onClose }: { title: string; children: ReactNode; actions: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    ref.current?.focus()
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); previous?.focus() }
  }, [onClose])
  return <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <div className="dialog" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
      <h2>{title}</h2>
      <div className="dialog-body">{children}</div>
      <div className="dialog-actions">{actions}</div>
    </div>
  </div>
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return <div className="page-header-row">
    <div className="page-header"><h1>{title}</h1>{description && <p>{description}</p>}</div>
    {actions}
  </div>
}
