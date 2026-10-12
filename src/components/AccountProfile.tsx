import { useEffect, useState, type FormEvent } from 'react'
import { Check } from 'lucide-react'
import { AVATAR_COLORS, COUNTRIES, saveProfile, useAccountPrefs } from '../lib/accountPrefs'
import { supabase } from '../lib/supabase'

export default function AccountProfile() {
  const { prefs, loading, schemaReady } = useAccountPrefs()
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [country, setCountry] = useState('')
  const [bio, setBio] = useState('')
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0])
  const [hydrated, setHydrated] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    if (!supabase) return
    void supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ''))
  }, [])

  useEffect(() => {
    if (loading || hydrated) return
    void Promise.resolve().then(() => {
      setDisplayName(prefs.displayName)
      setCountry(prefs.country)
      setBio(prefs.bio)
      setAvatarColor(prefs.avatarColor || AVATAR_COLORS[0])
      setHydrated(true)
    })
  }, [loading, hydrated, prefs])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setErrorMessage('')
    setSuccessMessage('')
    try {
      await saveProfile({ displayName, country, bio, avatarColor })
      setSuccessMessage('Perfil actualizado.')
    } catch {
      setErrorMessage('No se pudo guardar el perfil. Comprueba que la migración 6 está aplicada en Supabase e inténtalo de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  const initial = (displayName.trim() || email || '?').slice(0, 1).toUpperCase()

  return <div className="account-profile">
    <form className="profile-form" onSubmit={(event) => void submit(event)}>
      <div><span className="section-kicker">IDENTIDAD</span><h2>Tu perfil</h2><p>Tu nombre se usa en el panel y para completar la tarea de perfil. El resto es opcional.</p></div>
      <div className="avatar-editor">
        <span className="avatar-preview" style={{ background: avatarColor }}>{initial}</span>
        <div className="avatar-swatches" role="radiogroup" aria-label="Color de avatar">
          {AVATAR_COLORS.map((color) => <button type="button" key={color} role="radio" aria-checked={avatarColor === color} aria-label={`Color ${color}`} className={avatarColor === color ? 'avatar-swatch avatar-swatch-active' : 'avatar-swatch'} style={{ background: color }} onClick={() => setAvatarColor(color)}>{avatarColor === color && <Check size={13} />}</button>)}
        </div>
      </div>
      <label><span>Correo electrónico</span><input type="email" value={email} readOnly placeholder={loading ? 'Cargando…' : 'No disponible'} /></label>
      <label><span>Nombre visible</span><input value={displayName} maxLength={50} onChange={(event) => setDisplayName(event.target.value)} placeholder="Cómo quieres que te llamemos" /></label>
      <label><span>País</span><select value={country} onChange={(event) => setCountry(event.target.value)}><option value="">Sin indicar</option>{COUNTRIES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label>
      <label><span>Sobre ti ({bio.length}/160)</span><textarea value={bio} maxLength={160} rows={3} onChange={(event) => setBio(event.target.value)} placeholder="Una línea sobre ti (opcional)" /></label>
      {!schemaReady && !loading && <p className="profile-feedback-error" role="alert">Faltan columnas de perfil en Supabase. Aplica la migración 202610120006 para guardar país, bio y color.</p>}
      {errorMessage && <p className="profile-feedback-error" role="alert">{errorMessage}</p>}
      {successMessage && <p className="profile-feedback" role="status">{successMessage}</p>}
      <button className="action-primary" type="submit" disabled={loading || saving}>{saving ? 'Guardando…' : 'Guardar perfil'}</button>
    </form>
  </div>
}
