import { Alert } from '../../ui'
import { useSessionUser } from '../../app/sessionContext'
import { earnErrorMessage } from '../../lib/queries'

export function EmailNotice() {
  const user = useSessionUser()
  if (!user || user.emailConfirmed) return null
  return <Alert tone="warning">Confirma tu correo electrónico para poder cobrar puntos en esta actividad. Puedes explorarla mientras tanto.</Alert>
}

export function LoadError({ error }: { error: unknown }) {
  return <Alert tone="error">{earnErrorMessage(error)}</Alert>
}
