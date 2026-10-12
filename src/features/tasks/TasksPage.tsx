import { Check, Circle, ListChecks, Users } from 'lucide-react'
import Link from '../../lib/Link'
import { Alert, Badge, Button, Card, CardHeader, PageHeader, ProgressBar, Skeleton } from '../../ui'
import { useToast } from '../../ui/toastContext'
import { TASKS } from '../../lib/game'
import { useAccountPrefs } from '../../lib/accountPrefs'
import { useCompleteTask, useCompletedTasks, useMfaFactors, useReferralSummary } from '../../lib/queries'
import { useSessionUser } from '../../app/sessionContext'

type Requirement = { label: string; met: boolean }

export default function TasksPage() {
  const user = useSessionUser()
  const { prefs, loading: prefsLoading } = useAccountPrefs()
  const completed = useCompletedTasks()
  const factors = useMfaFactors()
  const referral = useReferralSummary()
  const complete = useCompleteTask()
  const toast = useToast()

  const emailOk = user ? user.emailConfirmed : false
  const requirements: Record<string, { items: Requirement[]; to: string; cta: string }> = {
    complete_profile: {
      items: [{ label: 'Correo electrónico verificado', met: emailOk }, { label: 'Nombre visible en el perfil', met: Boolean(prefs.displayName.trim()) }],
      to: '/dashboard/perfil', cta: 'Ir al perfil',
    },
    profile_details: {
      items: [{ label: 'Correo electrónico verificado', met: emailOk }, { label: 'País indicado', met: Boolean(prefs.country) }, { label: 'Bio escrita', met: Boolean(prefs.bio.trim()) }, { label: 'Color de avatar elegido', met: Boolean(prefs.avatarColor) }],
      to: '/dashboard/perfil', cta: 'Ir al perfil',
    },
    enable_2fa: {
      items: [{ label: 'Autenticación en dos pasos (TOTP) verificada', met: (factors.data ?? 0) > 0 }],
      to: '/dashboard/seguridad', cta: 'Ir a seguridad',
    },
  }

  const doneKeys = new Set(completed.data?.map((task) => task.task_key))
  const doneCount = TASKS.filter((task) => doneKeys.has(task.key)).length
  const loading = completed.isLoading || prefsLoading || factors.isLoading

  const submit = (key: string) => {
    complete.mutate(key, {
      onSuccess: (result) => toast(result.awarded ? `+${result.reward} puntos por completar la tarea` : 'Esta tarea ya estaba completada.', result.awarded ? 'success' : 'info'),
      onError: () => toast('Aún no se cumplen los requisitos de la tarea.', 'error'),
    })
  }

  return <>
    <PageHeader title="Tareas" description="Recompensas únicas por completar tu cuenta. Cada tarea se puede completar una sola vez." />
    <Card>
      <div className="row-between">
        <div className="stat"><span className="stat-label">Progreso</span><span className="stat-value">{doneCount} / {TASKS.length}<small>tareas</small></span></div>
        <div style={{ flex: '1 1 220px', maxWidth: 360 }}><ProgressBar value={(doneCount / TASKS.length) * 100} label="Tareas completadas" /></div>
      </div>
    </Card>
    {completed.isError && <Alert tone="error">No se pudieron cargar tus tareas. Inténtalo de nuevo en unos minutos.</Alert>}
    <Card>
      <CardHeader title="Tareas de cuenta" />
      {loading ? <div className="stack"><Skeleton height={72} /><Skeleton height={72} /><Skeleton height={72} /></div> : TASKS.map((task) => {
        const done = doneKeys.has(task.key)
        const config = requirements[task.key]
        const ready = config.items.every((item) => item.met)
        return <div className={`task${done ? ' task-done' : ''}`} key={task.key}>
          <span className="task-icon">{done ? <Check size={16} /> : <ListChecks size={16} />}</span>
          <div className="task-body">
            <div><strong>{task.title}</strong><p>{task.description}</p></div>
            {!done && <ul className="checklist">{config.items.map((item) => <li key={item.label} className={item.met ? 'ok' : ''}>{item.met ? <Check size={14} /> : <Circle size={14} />}{item.label}</li>)}</ul>}
          </div>
          <div className="task-side">
            <Badge tone={done ? 'success' : 'accent'}>{done ? 'Completada' : `+${task.reward} puntos`}</Badge>
            {!done && (ready
              ? <Button variant="primary" size="sm" loading={complete.isPending && complete.variables === task.key} onClick={() => submit(task.key)}>Reclamar</Button>
              : <Link to={config.to} className="btn btn-secondary btn-sm">{config.cta}</Link>)}
          </div>
        </div>
      })}
    </Card>
    <Card>
      <div className="task">
        <span className="task-icon"><Users size={16} /></span>
        <div className="task-body"><div><strong>Invitar amigos</strong><p>{referral.data ? `Recibes ${referral.data.reward_per_referral} puntos por cada amigo verificado, hasta ${referral.data.max_rewarded} referidos.` : 'Recibes puntos por cada amigo que se registre con tu enlace y complete su perfil.'}</p></div></div>
        <div className="task-side">
          {referral.data && <Badge>{referral.data.rewarded_referrals} / {referral.data.max_rewarded}</Badge>}
          <Link to="/dashboard/referidos" className="btn btn-secondary btn-sm">Ver mi enlace</Link>
        </div>
      </div>
    </Card>
  </>
}
