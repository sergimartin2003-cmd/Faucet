import { useEffect, useState } from 'react'
import { Bell, Eye, ShieldCheck, Trash2 } from 'lucide-react'
import { saveSettings, useAccountPrefs } from '../lib/accountPrefs'
import { browserNotificationsSupported } from '../lib/faucetReminder'
import { supabase } from '../lib/supabase'

function Toggle({ checked, disabled, label, description, onChange }: { checked: boolean; disabled?: boolean; label: string; description: string; onChange: (value: boolean) => void }) {
  return <div className="setting-row">
    <span><strong>{label}</strong><small>{description}</small></span>
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} className={checked ? 'switch switch-on' : 'switch'} onClick={() => onChange(!checked)}><i /></button>
  </div>
}

export default function AccountSettings() {
  const { prefs, loading, schemaReady } = useAccountPrefs()
  const [notify, setNotify] = useState(false)
  const [hideBalance, setHideBalance] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [busy, setBusy] = useState(false)
  const [emailConfirmed, setEmailConfirmed] = useState<boolean | null>(null)
  const [createdAt, setCreatedAt] = useState('')
  const [confirmText, setConfirmText] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    if (!supabase) return
    void supabase.auth.getUser().then(({ data }) => {
      setEmailConfirmed(Boolean(data.user?.email_confirmed_at))
      setCreatedAt(data.user?.created_at ?? '')
    })
  }, [])

  useEffect(() => {
    if (loading || hydrated) return
    void Promise.resolve().then(() => {
      setNotify(prefs.notifyFaucetReady)
      setHideBalance(prefs.hideBalance)
      setHydrated(true)
    })
  }, [loading, hydrated, prefs])

  const persist = async (next: { notifyFaucetReady: boolean; hideBalance: boolean }) => {
    setBusy(true)
    setErrorMessage('')
    setSuccessMessage('')
    try {
      await saveSettings(next)
      setNotify(next.notifyFaucetReady)
      setHideBalance(next.hideBalance)
      setSuccessMessage('Ajustes guardados.')
    } catch {
      setErrorMessage('No se pudieron guardar los ajustes. Comprueba que la migración 6 está aplicada en Supabase.')
    } finally {
      setBusy(false)
    }
  }

  const toggleNotify = async (value: boolean) => {
    if (value) {
      if (!browserNotificationsSupported()) return setErrorMessage('Este navegador no admite notificaciones.')
      const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
      if (permission !== 'granted') return setErrorMessage('Has bloqueado las notificaciones en el navegador. Actívalas desde los permisos del sitio.')
    }
    await persist({ notifyFaucetReady: value, hideBalance })
  }

  const signOutOthers = async () => {
    if (!supabase) return
    setBusy(true)
    setErrorMessage('')
    setSuccessMessage('')
    const { error } = await supabase.auth.signOut({ scope: 'others' })
    if (error) setErrorMessage('No se pudieron cerrar las otras sesiones.')
    else setSuccessMessage('Se cerraron las sesiones en otros dispositivos.')
    setBusy(false)
  }

  const deleteAccount = async () => {
    if (!supabase || confirmText !== 'ELIMINAR') return
    setBusy(true)
    setErrorMessage('')
    const { error } = await supabase.rpc('delete_my_account')
    if (error) {
      setErrorMessage('No se pudo eliminar la cuenta. Inténtalo de nuevo.')
      setBusy(false)
      return
    }
    await supabase.auth.signOut({ scope: 'local' })
    window.location.replace('/')
  }

  return <div className="security-center">
    <section className="security-panel">
      <div className="security-panel-heading"><span className="module-preview-icon"><Bell size={18} /></span><div><span className="section-kicker">NOTIFICACIONES</span><h2>Avisos</h2></div></div>
      <Toggle checked={notify} disabled={busy || loading || !schemaReady} label="Aviso cuando el faucet esté listo" description="Notificación del navegador. Funciona mientras tengas el panel abierto en una pestaña; no enviamos correos." onChange={(value) => void toggleNotify(value)} />
    </section>

    <section className="security-panel">
      <div className="security-panel-heading"><span className="module-preview-icon"><Eye size={18} /></span><div><span className="section-kicker">VISUALIZACIÓN</span><h2>Privacidad en pantalla</h2></div></div>
      <Toggle checked={hideBalance} disabled={busy || loading || !schemaReady} label="Ocultar saldos por defecto" description="Los saldos aparecerán como ••• al abrir el panel; puedes mostrarlos con el icono del ojo." onChange={(value) => void persist({ notifyFaucetReady: notify, hideBalance: value })} />
    </section>

    <section className="security-panel">
      <div className="security-panel-heading"><span className="module-preview-icon"><ShieldCheck size={18} /></span><div><span className="section-kicker">ANTI-ABUSO</span><h2>Reglas de la cuenta</h2></div></div>
      <div className="security-check-row"><span><strong>Correo verificado</strong><small>Obligatorio para reclamar recompensas y referidos.</small></span><em className={emailConfirmed ? 'security-good' : 'security-warn'}>{emailConfirmed === null ? 'Comprobando' : emailConfirmed ? 'Verificado' : 'Pendiente'}</em></div>
      <div className="security-check-row"><span><strong>Correos desechables</strong><small>Las direcciones temporales se rechazan al registrarse o cambiar de correo.</small></span><em className="security-good">Activo</em></div>
      <div className="security-check-row"><span><strong>Una reclamación cada 24 h</strong><small>Se aplica en el servidor por cuenta. Una racha se mantiene si reclamas dentro de 48 h.</small></span><em className="security-good">Activo</em></div>
      <div className="security-check-row"><span><strong>Miembro desde</strong><small>{createdAt ? new Intl.DateTimeFormat('es-ES', { dateStyle: 'long' }).format(new Date(createdAt)) : '—'}</small></span></div>
      <div className="security-actions"><div><strong>Cerrar otras sesiones</strong><small>Cierra la sesión en todos los dispositivos excepto este.</small></div><button className="action-secondary" disabled={busy} onClick={() => void signOutOthers()}>Cerrar otras sesiones</button></div>
    </section>

    <section className="security-panel danger-zone">
      <div className="security-panel-heading"><span className="module-preview-icon"><Trash2 size={18} /></span><div><span className="section-kicker">ZONA DE PELIGRO</span><h2>Eliminar cuenta</h2></div></div>
      <p className="danger-copy">Se borrarán tu perfil, puntos, historial y referidos de forma permanente. No se puede deshacer.</p>
      <label className="access-form"><span>Escribe ELIMINAR para confirmar</span><input value={confirmText} onChange={(event) => setConfirmText(event.target.value)} autoComplete="off" /></label>
      <button className="danger-button" disabled={busy || confirmText !== 'ELIMINAR'} onClick={() => void deleteAccount()}><Trash2 size={14} />Eliminar mi cuenta</button>
    </section>

    {!schemaReady && !loading && <p className="profile-feedback-error" role="alert">Faltan tablas de ajustes en Supabase. Aplica la migración 202610120006.</p>}
    {errorMessage && <p className="profile-feedback-error" role="alert">{errorMessage}</p>}
    {successMessage && <p className="profile-feedback" role="status">{successMessage}</p>}
  </div>
}
