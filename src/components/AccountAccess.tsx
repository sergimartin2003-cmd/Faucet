import { useEffect, useState, type FormEvent } from 'react'
import { KeyRound, Mail } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function AccountAccess() {
  const [currentEmail, setCurrentEmail] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    if (!supabase) return
    void supabase.auth.getUser().then(({ data }) => setCurrentEmail(data.user?.email ?? ''))
  }, [])

  const reset = (kind: string) => { setBusy(kind); setErrorMessage(''); setSuccessMessage('') }

  const changeEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase) return
    const email = newEmail.trim()
    if (!email || email.toLowerCase() === currentEmail.toLowerCase()) return setErrorMessage('Introduce un correo distinto al actual.')
    reset('email')
    try {
      const { data: allowed } = await supabase.rpc('is_email_allowed', { p_email: email })
      if (allowed === false) throw new Error('blocked')
      const { error } = await supabase.auth.updateUser({ email }, { emailRedirectTo: window.location.origin })
      if (error) throw error
      setNewEmail('')
      setSuccessMessage('Te hemos enviado un enlace de confirmación. El cambio se aplica al confirmarlo (puede que debas confirmar también desde el correo actual).')
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : ''
      setErrorMessage(message === 'blocked' || message.includes('disposable')
        ? 'Los correos temporales o desechables no están permitidos.'
        : message.includes('already') ? 'Ese correo ya está en uso.' : 'No se pudo solicitar el cambio de correo. Inténtalo de nuevo.')
    } finally {
      setBusy('')
    }
  }

  const changePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase) return
    if (newPassword.length < 8) return setErrorMessage('La contraseña debe tener al menos 8 caracteres.')
    if (newPassword !== confirmPassword) return setErrorMessage('Las contraseñas no coinciden.')
    reset('password')
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) {
      const message = error.message.toLowerCase()
      setErrorMessage(message.includes('same') ? 'La nueva contraseña debe ser distinta a la actual.'
        : message.includes('reauth') || message.includes('recent') ? 'Por seguridad, vuelve a iniciar sesión y repite el cambio.'
        : message.includes('weak') || message.includes('least') ? 'La contraseña es demasiado débil.' : 'No se pudo cambiar la contraseña.')
    } else {
      setNewPassword('')
      setConfirmPassword('')
      setSuccessMessage('Contraseña actualizada.')
    }
    setBusy('')
  }

  return <section className="security-panel access-panel">
    <div className="security-panel-heading"><span className="module-preview-icon"><KeyRound size={18} /></span><div><span className="section-kicker">ACCESO</span><h2>Correo y contraseña</h2></div></div>
    <form className="access-form" onSubmit={(event) => void changeEmail(event)}>
      <label><span>Nuevo correo electrónico</span><input type="email" autoComplete="email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} placeholder={currentEmail || 'nuevo@correo.com'} required /></label>
      <button className="action-secondary" type="submit" disabled={busy !== ''}><Mail size={14} />{busy === 'email' ? 'Enviando…' : 'Cambiar correo'}</button>
    </form>
    <form className="access-form" onSubmit={(event) => void changePassword(event)}>
      <label><span>Nueva contraseña</span><input type="password" autoComplete="new-password" minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required /></label>
      <label><span>Repite la contraseña</span><input type="password" autoComplete="new-password" minLength={8} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required /></label>
      <button className="action-secondary" type="submit" disabled={busy !== ''}><KeyRound size={14} />{busy === 'password' ? 'Guardando…' : 'Cambiar contraseña'}</button>
    </form>
    {errorMessage && <p className="profile-feedback-error" role="alert">{errorMessage}</p>}
    {successMessage && <p className="profile-feedback" role="status">{successMessage}</p>}
  </section>
}
