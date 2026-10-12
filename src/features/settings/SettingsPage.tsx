import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Card, CardHeader, Dialog, PageHeader, Switch } from '../../ui'
import { useToast } from '../../ui/toastContext'
import { saveSettings, useAccountPrefs } from '../../lib/accountPrefs'
import { browserNotificationsSupported } from '../../lib/faucetReminder'
import { navigate } from '../../lib/router'
import { supabase } from '../../lib/supabase'
import { useSessionUser } from '../../app/sessionContext'
import { useTheme, type ThemePreference } from '../../lib/theme'

const THEMES: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'Sistema' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
]

const date = new Intl.DateTimeFormat('es-ES', { dateStyle: 'long' })

export default function SettingsPage() {
  const { prefs, schemaReady, loading } = useAccountPrefs()
  const { preference, setPreference } = useTheme()
  const user = useSessionUser()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [deleteError, setDeleteError] = useState('')

  const update = async (partial: Parameters<typeof saveSettings>[0]) => {
    setBusy(true)
    try {
      await saveSettings(partial)
      toast('Ajustes guardados.')
    } catch {
      toast('No se pudieron guardar los ajustes.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const toggleNotify = async (value: boolean) => {
    if (value) {
      if (!browserNotificationsSupported()) return toast('Este navegador no admite notificaciones.', 'error')
      const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
      if (permission !== 'granted') return toast('Las notificaciones están bloqueadas en el navegador. Actívalas desde los permisos del sitio.', 'error')
    }
    await update({ notifyFaucetReady: value })
  }

  const signOutOthers = async () => {
    if (!supabase) return
    setBusy(true)
    const { error } = await supabase.auth.signOut({ scope: 'others' })
    toast(error ? 'No se pudieron cerrar las otras sesiones.' : 'Se cerró la sesión en el resto de dispositivos.', error ? 'error' : 'success')
    setBusy(false)
  }

  const deleteAccount = async () => {
    if (!supabase || confirmText !== 'ELIMINAR') return
    setBusy(true)
    setDeleteError('')
    const { error } = await supabase.rpc('delete_my_account')
    if (error) {
      setDeleteError('No se pudo eliminar la cuenta. Inténtalo de nuevo.')
      setBusy(false)
      return
    }
    await supabase.auth.signOut({ scope: 'local' })
    queryClient.clear()
    navigate('/', { replace: true })
  }

  const disabled = busy || loading || !schemaReady

  return <>
    <PageHeader title="Ajustes" description="Apariencia, avisos, privacidad y gestión de la cuenta." />
    {!loading && !schemaReady && <Alert tone="warning">Las preferencias de cuenta aún no están disponibles en este entorno.</Alert>}

    <Card>
      <CardHeader title="Apariencia" />
      <div className="setting">
        <div><strong>Tema</strong><span>Elige el aspecto de la aplicación.</span></div>
        <div className="tabs" role="radiogroup" aria-label="Tema">
          {THEMES.map((theme) => <button key={theme.value} type="button" role="radio" className="tab" aria-checked={preference === theme.value} aria-selected={preference === theme.value} onClick={() => setPreference(theme.value)}>{theme.label}</button>)}
        </div>
      </div>
    </Card>

    <Card>
      <CardHeader title="Avisos y privacidad" />
      <div className="setting">
        <div><strong>Aviso cuando el faucet esté listo</strong><span>Notificación del navegador. Funciona mientras tengas la aplicación abierta en una pestaña; no enviamos correos.</span></div>
        <Switch label="Aviso cuando el faucet esté listo" checked={prefs.notifyFaucetReady} disabled={disabled} onChange={(value) => void toggleNotify(value)} />
      </div>
      <div className="setting">
        <div><strong>Ocultar saldos por defecto</strong><span>Los saldos se muestran como ••• al abrir la aplicación. Puedes revelarlos con el icono del ojo.</span></div>
        <Switch label="Ocultar saldos por defecto" checked={prefs.hideBalance} disabled={disabled} onChange={(value) => void update({ hideBalance: value })} />
      </div>
      <div className="setting">
        <div><strong>Aparecer en la clasificación</strong><span>Si lo desactivas, tu posición sigue contando pero tu nombre se muestra de forma anónima.</span></div>
        <Switch label="Aparecer en la clasificación" checked={prefs.showOnLeaderboard} disabled={disabled} onChange={(value) => void update({ showOnLeaderboard: value })} />
      </div>
    </Card>

    <Card>
      <CardHeader title="Cuenta" description="Reglas de protección aplicadas a todas las cuentas." />
      <div className="setting">
        <div><strong>Correo verificado</strong><span>Obligatorio para reclamar recompensas y validar referidos.</span></div>
        <span className={`badge ${user?.emailConfirmed ? 'badge-success' : 'badge-warning'}`}>{user?.emailConfirmed ? 'Verificado' : 'Pendiente'}</span>
      </div>
      <div className="setting">
        <div><strong>Una reclamación cada 24 horas</strong><span>Se aplica en el servidor. La racha se mantiene si reclamas en un máximo de 48 horas.</span></div>
        <span className="badge badge-success">Activo</span>
      </div>
      <div className="setting">
        <div><strong>Correos temporales</strong><span>Las direcciones desechables se rechazan al registrarse o cambiar de correo.</span></div>
        <span className="badge badge-success">Activo</span>
      </div>
      <div className="setting">
        <div><strong>Miembro desde</strong><span>{user?.createdAt ? date.format(new Date(user.createdAt)) : '—'}</span></div>
      </div>
      <div className="setting">
        <div><strong>Cerrar otras sesiones</strong><span>Cierra la sesión en todos tus dispositivos excepto en este.</span></div>
        <Button size="sm" disabled={busy} onClick={() => void signOutOthers()}>Cerrar otras sesiones</Button>
      </div>
    </Card>

    <Card className="danger-card">
      <CardHeader title="Eliminar cuenta" description="Se borrarán de forma permanente tu perfil, tus puntos, tu historial y tus referidos. No se puede deshacer." />
      <Button variant="danger" onClick={() => { setConfirmText(''); setDeleteError(''); setConfirmDelete(true) }}>Eliminar mi cuenta</Button>
    </Card>

    {confirmDelete && <Dialog title="Eliminar cuenta" onClose={() => setConfirmDelete(false)}
      actions={<><Button variant="ghost" onClick={() => setConfirmDelete(false)} disabled={busy}>Cancelar</Button><Button variant="danger" loading={busy} disabled={confirmText !== 'ELIMINAR'} onClick={() => void deleteAccount()}>Eliminar definitivamente</Button></>}>
      <p className="muted">Esta acción es irreversible. Para confirmar, escribe <strong>ELIMINAR</strong>.</p>
      <div className="field" style={{ marginTop: 'var(--space-3)' }}><label htmlFor="delete-confirm">Confirmación</label><input id="delete-confirm" className="input" autoComplete="off" value={confirmText} onChange={(event) => setConfirmText(event.target.value)} /></div>
      {deleteError && <div style={{ marginTop: 'var(--space-3)' }}><Alert tone="error">{deleteError}</Alert></div>}
    </Dialog>}
  </>
}
