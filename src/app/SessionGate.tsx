import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { applyPendingReferral } from '../lib/referral'
import { navigate } from '../lib/router'
import { Alert, Button, Spinner } from '../ui'
import { t } from '../lib/i18n'
import { SessionContext, type SessionUser } from './sessionContext'

type GateStatus = 'loading' | 'signed-out' | 'ready' | 'mfa-required' | 'error'

const toSessionUser = (session: Session | null): SessionUser | null => session
  ? { id: session.user.id, email: session.user.email ?? '', emailConfirmed: Boolean(session.user.email_confirmed_at), createdAt: session.user.created_at }
  : null

export default function SessionGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<GateStatus>(() => supabase ? 'loading' : import.meta.env.DEV ? 'ready' : 'signed-out')
  const [user, setUser] = useState<SessionUser | null>(null)

  useEffect(() => {
    if (!supabase) return
    const client = supabase
    let active = true

    const evaluate = async (session: Session | null) => {
      if (!session) {
        if (active) { setUser(null); setStatus('signed-out') }
        return
      }
      try {
        const { data, error } = await client.auth.mfa.getAuthenticatorAssuranceLevel()
        if (error) throw error
        const mfaRequired = data.nextLevel === 'aal2' && data.currentLevel !== 'aal2'
        if (!mfaRequired) void applyPendingReferral()
        if (active) { setUser(toSessionUser(session)); setStatus(mfaRequired ? 'mfa-required' : 'ready') }
      } catch {
        if (active) setStatus('error')
      }
    }

    void client.auth.getSession().then(({ data, error }) => {
      if (error) { if (active) setStatus('error'); return }
      void evaluate(data.session)
    })
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      queueMicrotask(() => { void evaluate(session) })
    })
    return () => { active = false; subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    if (status === 'signed-out' && !import.meta.env.DEV) navigate('/?login=1', { replace: true })
  }, [status])

  if (status === 'loading') return <div className="gate-screen"><Spinner /><span>{t('Verificando sesión…')}</span></div>
  if (status === 'mfa-required') return <MfaChallenge onVerified={() => setStatus('ready')} />
  if (status === 'error') return <div className="gate-screen"><Alert tone="error">{t('No se pudo verificar la sesión. Recarga la página o vuelve a iniciar sesión.')}</Alert></div>
  if (status === 'signed-out' && !import.meta.env.DEV) return null
  return <SessionContext.Provider value={user}>{children}</SessionContext.Provider>
}

function MfaChallenge({ onVerified }: { onVerified: () => void }) {
  const [factorId, setFactorId] = useState('')
  const [mode, setMode] = useState<'totp' | 'recovery'>('totp')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let active = true
    const load = async () => {
      if (!supabase) return
      try {
        const { data, error } = await supabase.auth.mfa.listFactors()
        if (error) throw error
        const factor = data.totp.find((item) => item.status === 'verified')
        if (active) {
          setFactorId(factor?.id ?? '')
          if (!factor && !data.recovery_code.length) setErrorMessage(t('No se encontró un factor verificado ni códigos de recuperación. Contacta con soporte para recuperar el acceso.'))
        }
      } catch {
        if (active) setErrorMessage(t('No se pudo cargar tu factor de autenticación.'))
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [])

  const switchMode = (next: 'totp' | 'recovery') => { setMode(next); setCode(''); setErrorMessage('') }
  const valid = mode === 'totp' ? Boolean(factorId) && code.length === 6 : code.trim().length > 0

  const verify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase || !valid) return
    setBusy(true)
    setErrorMessage('')
    try {
      const { error } = mode === 'totp'
        ? await supabase.auth.mfa.challengeAndVerify({ factorId, code })
        : await supabase.auth.mfa.recoveryCodes.verify({ code })
      if (error) throw error
      onVerified()
    } catch {
      setErrorMessage(mode === 'totp'
        ? t('El código no es válido o ha caducado. Comprueba tu app autenticadora e inténtalo otra vez.')
        : t('El código de recuperación no es válido o ya se utilizó.'))
      setCode('')
    } finally {
      setBusy(false)
    }
  }

  const signOut = async () => {
    await supabase?.auth.signOut({ scope: 'local' })
    navigate('/', { replace: true })
  }

  return <main className="gate-screen">
    <form className="card card-pad gate-card" onSubmit={(event) => void verify(event)}>
      <span className="gate-icon"><ShieldCheck size={20} /></span>
      <h1>{t('Verificación en dos pasos')}</h1>
      <p className="muted">{mode === 'totp' ? t('Introduce el código de seis cifras de tu app autenticadora.') : t('Introduce uno de tus códigos de recuperación sin usar.')}</p>
      {factorId && <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={mode === 'totp'} className="tab" onClick={() => switchMode('totp')}>{t('App autenticadora')}</button>
        <button type="button" role="tab" aria-selected={mode === 'recovery'} className="tab" onClick={() => switchMode('recovery')}>{t('Código de recuperación')}</button>
      </div>}
      <div className="field">
        <label htmlFor="mfa-code">{mode === 'totp' ? t('Código TOTP') : t('Código de recuperación')}</label>
        <input id="mfa-code" className="input tnum" autoFocus inputMode={mode === 'totp' ? 'numeric' : 'text'} autoComplete={mode === 'totp' ? 'one-time-code' : 'off'} maxLength={mode === 'totp' ? 6 : 40} value={code} onChange={(event) => setCode(mode === 'totp' ? event.target.value.replace(/\D/g, '').slice(0, 6) : event.target.value)} />
      </div>
      {errorMessage && <Alert tone="error">{errorMessage}</Alert>}
      <Button variant="primary" type="submit" size="lg" loading={busy} disabled={loading || !valid}>{t('Verificar y continuar')}</Button>
      <button type="button" className="link-button" onClick={() => void signOut()}>{t('Cerrar sesión')}</button>
    </form>
  </main>
}
