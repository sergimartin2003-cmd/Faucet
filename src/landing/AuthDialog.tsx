import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Eye, EyeOff, LogOut, X } from 'lucide-react'
import { Alert, Button } from '../ui'
import Captcha from '../components/Captcha'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { turnstileSiteKey } from '../lib/turnstile'
import { navigate } from '../lib/router'
import { siteOrigin } from '../lib/site'
import type { AuthMode } from './auth'

const TITLES: Record<AuthMode, string> = {
  login: 'Iniciar sesión',
  signup: 'Crear cuenta',
  recovery: 'Recuperar acceso',
  'update-password': 'Nueva contraseña',
}

const INTROS: Record<AuthMode, string> = {
  login: 'Accede a tu panel con tu correo y contraseña.',
  signup: 'Solo necesitas un correo. Te pediremos que lo verifiques.',
  recovery: 'Te enviaremos un enlace para restablecer tu contraseña.',
  'update-password': 'Elige una contraseña nueva para tu cuenta.',
}

const SUBMIT_LABELS: Record<AuthMode, string> = {
  login: 'Iniciar sesión',
  signup: 'Crear cuenta',
  recovery: 'Enviar enlace',
  'update-password': 'Guardar contraseña',
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])'

export default function AuthDialog({ mode, onModeChange, signedInEmail, onClose }: {
  mode: AuthMode
  onModeChange: (mode: AuthMode) => void
  signedInEmail: string | null
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const busyRef = useRef(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [canResend, setCanResend] = useState(false)
  const [captchaToken, setCaptchaToken] = useState('')
  const [captchaKey, setCaptchaKey] = useState(0)

  useEffect(() => { busyRef.current = busy }, [busy])

  const close = useCallback(() => { if (!busyRef.current) onClose() }, [onClose])

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const root = dialogRef.current
    root?.querySelector<HTMLElement>('input')?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { close(); return }
      if (event.key !== 'Tab' || !root) return
      const items = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((item) => item.offsetParent !== null)
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previous?.focus()
    }
  }, [close])

  const switchMode = (next: AuthMode) => {
    onModeChange(next)
    setError('')
    setMessage('')
    setCanResend(false)
    setPasswordVisible(false)
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase) return
    setError('')
    setMessage('')
    setCanResend(false)
    const needsCaptcha = Boolean(turnstileSiteKey) && mode !== 'update-password'
    if (needsCaptcha && !captchaToken) {
      setError('Completa la verificación anti-bots para continuar.')
      return
    }
    setBusy(true)
    const captchaOptions = needsCaptcha ? { captchaToken } : {}
    const address = email.trim()
    try {
      if (mode === 'signup') {
        const { data: emailAllowed } = await supabase.rpc('is_email_allowed', { p_email: address })
        if (emailAllowed === false) throw new Error('disposable email')
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: address,
          password,
          options: { data: { display_name: name.trim() || undefined }, emailRedirectTo: siteOrigin(), ...captchaOptions },
        })
        if (signUpError) throw signUpError
        if (data.session) {
          setMessage('Cuenta creada. Redirigiendo a tu panel.')
          navigate('/dashboard')
        } else {
          setMessage('Cuenta creada. Revisa tu correo y confirma la dirección antes de iniciar sesión.')
        }
      } else if (mode === 'recovery') {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(address, { redirectTo: siteOrigin(), ...captchaOptions })
        if (resetError) throw resetError
        setMessage('Si existe una cuenta con este correo, recibirás un enlace para restablecer la contraseña.')
      } else if (mode === 'update-password') {
        const { error: updateError } = await supabase.auth.updateUser({ password })
        if (updateError) throw updateError
        setPassword('')
        setMessage('Contraseña actualizada. Ya puedes seguir usando tu cuenta.')
        onModeChange('login')
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: address, password, options: captchaOptions })
        if (signInError) throw signInError
        navigate('/dashboard')
      }
    } catch (caught) {
      const text = caught instanceof Error ? caught.message : ''
      const lower = text.toLowerCase()
      if (mode === 'signup' && lower.includes('error sending confirmation email')) {
        setError('No pudimos enviar el correo de confirmación. Inténtalo de nuevo en unos minutos.')
      } else if (mode === 'signup' && (lower.includes('disposable') || lower.includes('database error saving new user'))) {
        setError('Los correos temporales o desechables no están permitidos. Usa tu correo personal.')
      } else if (lower.includes('captcha')) {
        setError('La verificación anti-bots ha fallado. Inténtalo de nuevo.')
      } else if (lower.includes('rate limit') || lower.includes('too many')) {
        setError('Demasiados intentos. Espera unos minutos antes de volver a probar.')
      } else if (mode === 'login' && lower.includes('email not confirmed')) {
        setError('Tu correo todavía no está confirmado. Revisa tu bandeja de entrada.')
        setCanResend(true)
      } else if (lower.includes('invalid login credentials')) {
        setError('Correo o contraseña incorrectos.')
      } else if (lower.includes('already registered') || lower.includes('already been registered')) {
        setError('Ya existe una cuenta con este correo. Prueba a iniciar sesión.')
      } else if (lower.includes('password') && (lower.includes('weak') || lower.includes('at least') || lower.includes('characters'))) {
        setError('La contraseña es demasiado débil. Usa al menos 8 caracteres y evita contraseñas comunes.')
      } else {
        setError(text || 'No se pudo completar la solicitud. Inténtalo de nuevo.')
      }
    } finally {
      setBusy(false)
      setCaptchaToken('')
      setCaptchaKey((key) => key + 1)
    }
  }

  const resend = async () => {
    if (!supabase || !email.trim()) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const { error: resendError } = await supabase.auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: siteOrigin() } })
      if (resendError) throw resendError
      setCanResend(false)
      setMessage('Correo reenviado. Revisa la bandeja de entrada y la carpeta de spam.')
    } catch (caught) {
      const text = caught instanceof Error ? caught.message : ''
      setError(text.toLowerCase().includes('rate limit') ? 'Demasiados intentos. Espera unos minutos antes de volver a probar.' : 'No se pudo reenviar el correo. Inténtalo de nuevo en unos minutos.')
    } finally {
      setBusy(false)
    }
  }

  const signOut = async () => {
    if (!supabase) return
    setBusy(true)
    setError('')
    try {
      const { error: outError } = await supabase.auth.signOut()
      if (outError) throw outError
      setMessage('Sesión cerrada.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo cerrar la sesión.')
    } finally {
      setBusy(false)
    }
  }

  const disabled = !isSupabaseConfigured || busy
  const showPassword = mode !== 'recovery'
  const passwordLabel = mode === 'update-password' ? 'Nueva contraseña' : 'Contraseña'

  return <div className="auth-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) close() }}>
    <div className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title" aria-describedby="auth-intro" ref={dialogRef}>
      <button className="btn btn-ghost btn-sm auth-close" type="button" aria-label="Cerrar" onClick={close} disabled={busy}><X size={16} /></button>
      <h2 id="auth-title" className="auth-title">{TITLES[mode]}</h2>
      <p id="auth-intro" className="auth-intro">{INTROS[mode]}</p>

      {!isSupabaseConfigured && <div className="auth-notice"><Alert tone="info">El servicio de cuentas no está disponible en este entorno. Vuelve a intentarlo más tarde.</Alert></div>}

      <form className="auth-form" onSubmit={(event) => void submit(event)}>
        {mode === 'signup' && <div className="field">
          <label htmlFor="auth-name">Nombre <span className="faint">(opcional)</span></label>
          <input id="auth-name" className="input" autoComplete="name" value={name} maxLength={50} onChange={(event) => setName(event.target.value)} disabled={disabled} />
        </div>}
        {mode !== 'update-password' && <div className="field">
          <label htmlFor="auth-email">Correo electrónico</label>
          <input id="auth-email" className="input" type="email" autoComplete="email" required value={email} placeholder="nombre@correo.com" onChange={(event) => setEmail(event.target.value)} disabled={disabled} />
        </div>}
        {showPassword && <div className="field">
          <div className="auth-label-row">
            <label htmlFor="auth-password">{passwordLabel}</label>
            {mode === 'login' && <button className="link-button auth-forgot" type="button" onClick={() => switchMode('recovery')}>¿Olvidaste tu contraseña?</button>}
          </div>
          <div className="auth-password">
            <input id="auth-password" className="input" type={passwordVisible ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'login' ? undefined : 8} required value={password} onChange={(event) => setPassword(event.target.value)} disabled={disabled} aria-describedby={mode === 'login' ? undefined : 'auth-password-hint'} />
            <button className="auth-password-toggle" type="button" aria-label={passwordVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={passwordVisible} onClick={() => setPasswordVisible((visible) => !visible)} disabled={disabled}>{passwordVisible ? <EyeOff size={16} /> : <Eye size={16} />}</button>
          </div>
          {mode !== 'login' && <span className="field-hint" id="auth-password-hint">Mínimo 8 caracteres.</span>}
        </div>}

        {mode !== 'update-password' && <Captcha key={captchaKey} onToken={setCaptchaToken} />}

        <div aria-live="polite" className="auth-feedback">
          {error && <Alert tone="error">{error}</Alert>}
          {message && <Alert tone="success">{message}</Alert>}
        </div>

        {canResend && <Button type="button" variant="secondary" size="sm" disabled={busy || !email.trim()} onClick={() => void resend()}>Reenviar correo de verificación</Button>}
        {mode === 'signup' && signedInEmail && <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => void signOut()}><LogOut size={14} />Cerrar sesión de {signedInEmail}</Button>}

        <Button type="submit" variant="primary" size="lg" className="btn-block" loading={busy} disabled={!isSupabaseConfigured}>{busy ? 'Procesando' : SUBMIT_LABELS[mode]}</Button>
      </form>

      <p className="auth-switch">
        {mode === 'recovery' || mode === 'update-password'
          ? <button className="link-button" type="button" onClick={() => switchMode('login')}>Volver a iniciar sesión</button>
          : <>{mode === 'signup' ? '¿Ya tienes cuenta? ' : '¿Aún no tienes cuenta? '}<button className="link-button" type="button" onClick={() => switchMode(mode === 'signup' ? 'login' : 'signup')}>{mode === 'signup' ? 'Inicia sesión' : 'Crea una cuenta'}</button></>}
      </p>
      {mode === 'signup' && <p className="auth-legal">Al crear una cuenta aceptas los <a href="/terminos" target="_blank" rel="noreferrer">Términos de uso</a> y la <a href="/privacidad" target="_blank" rel="noreferrer">Política de privacidad</a>.</p>}
    </div>
  </div>
}
