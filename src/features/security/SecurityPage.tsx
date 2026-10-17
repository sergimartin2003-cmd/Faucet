import { useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Badge, Button, Card, CardHeader, Dialog, PageHeader, Skeleton } from '../../ui'
import { useToast } from '../../ui/toastContext'
import { supabase } from '../../lib/supabase'
import { siteOrigin } from '../../lib/site'
import { errorCode } from '../../lib/queries'
import { useSessionUser } from '../../app/sessionContext'
import { t } from '../../lib/i18n'

type Factor = { id: string; name: string; verified: boolean }

const digits = (value: string) => value.replace(/\D/g, '').slice(0, 6)

function useFactors() {
  return useQuery({
    queryKey: ['mfa-factor-list'],
    enabled: Boolean(supabase),
    queryFn: async (): Promise<Factor[]> => {
      const { data, error } = await supabase!.auth.mfa.listFactors()
      if (error) throw error
      return data.all.filter((factor) => factor.factor_type === 'totp')
        .map((factor) => ({ id: factor.id, name: factor.friendly_name ?? t('App autenticadora'), verified: factor.status === 'verified' }))
    },
  })
}

function useRecoveryStatus(enabled: boolean) {
  return useQuery({
    queryKey: ['mfa-recovery'],
    enabled: Boolean(supabase) && enabled,
    retry: false,
    queryFn: async (): Promise<number | null> => {
      const { data, error } = await supabase!.auth.mfa.recoveryCodes.getStatus()
      if (error) return error.code === 'mfa_factor_not_found' ? 0 : null
      return data.remaining
    },
  })
}

function TwoFactorCard() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const factors = useFactors()
  const verified = factors.data?.filter((factor) => factor.verified) ?? []
  const pending = factors.data?.find((factor) => !factor.verified)
  const recovery = useRecoveryStatus(verified.length > 0)

  const [qr, setQr] = useState('')
  const [secret, setSecret] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [removing, setRemoving] = useState<Factor | null>(null)
  const [regenerating, setRegenerating] = useState(false)
  const [stepUp, setStepUp] = useState('')
  const [codes, setCodes] = useState<string[]>([])

  const refresh = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['mfa-factor-list'] }),
    queryClient.invalidateQueries({ queryKey: ['mfa-factors'] }),
    queryClient.invalidateQueries({ queryKey: ['mfa-recovery'] }),
  ])

  const enroll = async () => {
    if (!supabase) return
    setBusy(true)
    setError('')
    try {
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Faucet', issuer: 'Faucet' })
      if (enrollError) throw enrollError
      if (data.type !== 'totp') throw new Error('totp')
      setQr(data.totp.qr_code)
      setSecret(data.totp.secret)
      await refresh()
    } catch {
      setError(t('No se pudo iniciar la configuración. Si ya hay una pendiente, cancélala e inténtalo de nuevo.'))
    } finally {
      setBusy(false)
    }
  }

  const verify = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase || !pending) return
    setBusy(true)
    setError('')
    try {
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: pending.id, code })
      if (verifyError) throw verifyError
      setQr('')
      setSecret('')
      setCode('')
      await refresh()
      toast(t('Autenticación en dos pasos activada.'))
    } catch {
      setError(t('El código no es válido. Comprueba la hora de tu dispositivo e inténtalo de nuevo.'))
    } finally {
      setBusy(false)
    }
  }

  const remove = async (factor: Factor) => {
    if (!supabase) return
    setBusy(true)
    setError('')
    try {
      const { error: removeError } = await supabase.auth.mfa.unenroll({ factorId: factor.id })
      if (removeError) throw removeError
      if (!factor.verified) { setQr(''); setSecret(''); setCode('') }
      setRemoving(null)
      await refresh()
      toast(factor.verified ? t('Autenticación en dos pasos desactivada.') : t('Configuración cancelada.'))
    } catch {
      setRemoving(null)
      setError(t('No se pudo eliminar el factor. Inténtalo de nuevo.'))
    } finally {
      setBusy(false)
    }
  }

  const generateCodes = async (event: { preventDefault: () => void }) => {
    event.preventDefault()
    if (!supabase || !verified.length) return
    setBusy(true)
    setError('')
    try {
      const { error: stepError } = await supabase.auth.mfa.challengeAndVerify({ factorId: verified[0].id, code: stepUp })
      if (stepError) throw stepError
      const hasCodes = (recovery.data ?? 0) > 0
      const result = hasCodes ? await supabase.auth.mfa.recoveryCodes.regenerate() : await supabase.auth.mfa.recoveryCodes.generate({ friendlyName: 'Faucet' })
      if (result.error) throw result.error
      setCodes(result.data.codes)
      setRegenerating(false)
      setStepUp('')
      await refresh()
    } catch (caught) {
      const kind = errorCode(caught)
      setError(kind === 'mfa_recovery_codes_enroll_not_enabled' ? t('Los códigos de recuperación no están habilitados en este entorno.') : t('No se pudieron generar los códigos. Comprueba el código de tu app e inténtalo de nuevo.'))
      setRegenerating(false)
    } finally {
      setBusy(false)
    }
  }

  const remaining = recovery.data

  return <Card>
    <CardHeader title={t('Verificación en dos pasos')} description={t('Añade una capa extra de seguridad con una app autenticadora (TOTP).')}
      action={factors.isLoading ? undefined : <Badge tone={verified.length ? 'success' : 'neutral'}>{verified.length ? t('Activa') : t('Desactivada')}</Badge>} />
    {factors.isLoading ? <Skeleton height={40} /> : <div className="stack">
      {error && <Alert tone="error">{error}</Alert>}

      {pending && <div className="stack">
        {qr ? <>
          <p className="muted">{t('Escanea el código QR con tu app autenticadora y escribe el código de seis cifras para confirmar.')}</p>
          <img className="qr" src={qr} alt={t('Código QR para configurar la autenticación en dos pasos')} />
          <div className="field"><span className="field-label">{t('Clave manual')}</span><code className="secret">{secret}</code><span className="field-hint">{t('Si no puedes escanear el QR, introduce esta clave en tu app. No la compartas.')}</span></div>
        </> : <Alert tone="info">{t('Hay una configuración pendiente. El QR solo se muestra al crearla: cancélala para generar uno nuevo.')}</Alert>}
        <form className="row" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }} onSubmit={(event) => void verify(event)}>
          <div className="field"><label htmlFor="totp-code">{t('Código de seis cifras')}</label><input id="totp-code" className="input otp-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(digits(event.target.value))} /></div>
          <Button variant="primary" type="submit" loading={busy} disabled={code.length !== 6}>{t('Activar')}</Button>
          <Button variant="ghost" type="button" disabled={busy} onClick={() => void remove(pending)}>{t('Cancelar')}</Button>
        </form>
      </div>}

      {!pending && verified.length === 0 && <div className="row-between">
        <p className="muted" style={{ maxWidth: 520 }}>{t('Se te pedirá un código de tu app cada vez que inicies sesión. Es la mejor forma de proteger tu saldo.')}</p>
        <Button variant="primary" loading={busy} onClick={() => void enroll()}>{t('Configurar')}</Button>
      </div>}

      {verified.map((factor) => <div className="setting" key={factor.id}>
        <div><strong>{factor.name}</strong><span>{t('App autenticadora verificada.')}</span></div>
        <Button size="sm" disabled={busy} onClick={() => setRemoving(factor)}>{t('Desactivar')}</Button>
      </div>)}

      {verified.length > 0 && <div className="setting">
        <div><strong>{t('Códigos de recuperación')}</strong><span>{remaining == null ? t('No se pudo consultar su estado.') : remaining > 0 ? t('{n} sin usar. Cada uno sirve una sola vez si pierdes tu app.', { n: remaining }) : t('Aún no has generado códigos. Guárdalos por si pierdes el acceso a tu app.')}</span></div>
        <Button size="sm" disabled={busy || recovery.isLoading} onClick={() => { setStepUp(''); setRegenerating(true) }}>{remaining ? t('Regenerar') : t('Generar')}</Button>
      </div>}
    </div>}

    {removing && <Dialog title={removing.verified ? t('Desactivar verificación en dos pasos') : t('Cancelar configuración')} onClose={() => setRemoving(null)}
      actions={<><Button variant="ghost" onClick={() => setRemoving(null)} disabled={busy}>{t('Volver')}</Button><Button variant="danger" loading={busy} onClick={() => void remove(removing)}>{removing.verified ? t('Desactivar') : t('Cancelar configuración')}</Button></>}>
      <p className="muted">{removing.verified ? t('Tu cuenta dejará de pedir un código al iniciar sesión.') : t('Se descartará la configuración pendiente.')}</p>
    </Dialog>}

    {regenerating && <Dialog title={remaining ? t('Regenerar códigos de recuperación') : t('Generar códigos de recuperación')} onClose={() => setRegenerating(false)}
      actions={<><Button variant="ghost" onClick={() => setRegenerating(false)} disabled={busy}>{t('Cancelar')}</Button><Button variant="primary" loading={busy} disabled={stepUp.length !== 6} onClick={(event) => void generateCodes(event)}>{t('Continuar')}</Button></>}>
      <p className="muted">{remaining ? `${t('Los códigos actuales dejarán de funcionar de inmediato.')} ` : ''}{t('Confirma con un código actual de tu app autenticadora.')}</p>
      <div className="field" style={{ marginTop: 'var(--space-3)' }}><label htmlFor="step-up">{t('Código de seis cifras')}</label><input id="step-up" className="input otp-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={stepUp} onChange={(event) => setStepUp(digits(event.target.value))} autoFocus /></div>
    </Dialog>}

    {codes.length > 0 && <Dialog title={t('Guarda tus códigos de recuperación')} onClose={() => setCodes([])}
      actions={<Button variant="primary" onClick={() => setCodes([])}>{t('Ya los he guardado')}</Button>}>
      <p className="muted">{t('No volverán a mostrarse. Guárdalos fuera de este dispositivo; quien los tenga podría acceder a tu cuenta.')}</p>
      <div className="code-grid" style={{ marginTop: 'var(--space-3)' }}>{codes.map((value) => <code key={value}>{value.match(/.{1,4}/g)?.join('-') ?? value}</code>)}</div>
    </Dialog>}
  </Card>
}

function AccessCard() {
  const user = useSessionUser()
  const toast = useToast()
  const [newEmail, setNewEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState('')
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')

  const changeEmail = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase) return
    const email = newEmail.trim()
    setEmailError('')
    if (!email || email.toLowerCase() === user?.email.toLowerCase()) return setEmailError(t('Introduce un correo distinto al actual.'))
    setBusy('email')
    try {
      const { data: allowed } = await supabase.rpc('is_email_allowed', { p_email: email })
      if (allowed === false) throw new Error('blocked')
      const { error } = await supabase.auth.updateUser({ email }, { emailRedirectTo: siteOrigin() })
      if (error) throw error
      setNewEmail('')
      toast(t('Te hemos enviado un enlace de confirmación. Puede que debas confirmarlo también desde tu correo actual.'))
    } catch (caught) {
      const message = caught instanceof Error ? caught.message.toLowerCase() : ''
      setEmailError(message === 'blocked' || message.includes('disposable') ? t('No se permiten correos temporales o desechables.') : message.includes('already') ? t('Ese correo ya está en uso.') : t('No se pudo solicitar el cambio de correo.'))
    } finally {
      setBusy('')
    }
  }

  const changePassword = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase) return
    setPasswordError('')
    if (password.length < 8) return setPasswordError(t('La contraseña debe tener al menos 8 caracteres.'))
    if (password !== confirm) return setPasswordError(t('Las contraseñas no coinciden.'))
    setBusy('password')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      const message = error.message.toLowerCase()
      setPasswordError(message.includes('same') ? t('La nueva contraseña debe ser distinta a la actual.') : message.includes('reauth') || message.includes('recent') ? t('Por seguridad, vuelve a iniciar sesión y repite el cambio.') : message.includes('weak') || message.includes('least') ? t('La contraseña es demasiado débil.') : t('No se pudo cambiar la contraseña.'))
    } else {
      setPassword('')
      setConfirm('')
      toast(t('Contraseña actualizada.'))
    }
    setBusy('')
  }

  const sendReset = async () => {
    if (!supabase || !user?.email) return
    setBusy('reset')
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, { redirectTo: siteOrigin() })
    toast(error ? t('No se pudo enviar el correo de recuperación.') : t('Enlace enviado. Revisa tu correo y la carpeta de spam.'), error ? 'error' : 'success')
    setBusy('')
  }

  return <Card>
    <CardHeader title={t('Acceso')} description={user ? t('Sesión iniciada como {email}.', { email: user.email }) : undefined} />
    <div className="stack" style={{ gap: 'var(--space-6)' }}>
      <form className="form-grid" onSubmit={(event) => void changeEmail(event)}>
        <div className="field"><label htmlFor="new-email">{t('Nuevo correo electrónico')}</label><input id="new-email" className="input" type="email" autoComplete="email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} required /></div>
        {emailError && <Alert tone="error">{emailError}</Alert>}
        <div className="form-actions"><Button type="submit" loading={busy === 'email'} disabled={busy !== ''}>{t('Cambiar correo')}</Button></div>
      </form>
      <form className="form-grid" onSubmit={(event) => void changePassword(event)}>
        <div className="field"><label htmlFor="new-password">{t('Nueva contraseña')}</label><input id="new-password" className="input" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required /><span className="field-hint">{t('Mínimo 8 caracteres.')}</span></div>
        <div className="field"><label htmlFor="confirm-password">{t('Repite la contraseña')}</label><input id="confirm-password" className="input" type="password" autoComplete="new-password" minLength={8} value={confirm} onChange={(event) => setConfirm(event.target.value)} required /></div>
        {passwordError && <Alert tone="error">{passwordError}</Alert>}
        <div className="form-actions"><Button type="submit" loading={busy === 'password'} disabled={busy !== ''}>{t('Cambiar contraseña')}</Button><Button type="button" variant="ghost" loading={busy === 'reset'} disabled={busy !== ''} onClick={() => void sendReset()}>{t('Enviarme un enlace de restablecimiento')}</Button></div>
      </form>
    </div>
  </Card>
}

export default function SecurityPage() {
  return <>
    <PageHeader title={t('Seguridad')} description={t('Protege tu cuenta y gestiona tus credenciales de acceso.')} />
    <TwoFactorCard />
    <AccessCard />
  </>
}
