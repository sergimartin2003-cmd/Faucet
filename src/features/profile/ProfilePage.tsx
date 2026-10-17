import { useState, type FormEvent } from 'react'
import { Check } from 'lucide-react'
import { Alert, Avatar, Button, Card, CardHeader, PageHeader, Skeleton } from '../../ui'
import { useToast } from '../../ui/toastContext'
import { AVATAR_COLORS, COUNTRIES, saveProfile, useAccountPrefs, type AccountPrefs } from '../../lib/accountPrefs'
import { useSessionUser } from '../../app/sessionContext'

function ProfileForm({ prefs }: { prefs: AccountPrefs }) {
  const user = useSessionUser()
  const toast = useToast()
  const [displayName, setDisplayName] = useState(prefs.displayName)
  const [country, setCountry] = useState(prefs.country)
  const [bio, setBio] = useState(prefs.bio)
  const [avatarColor, setAvatarColor] = useState(prefs.avatarColor || AVATAR_COLORS[0])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await saveProfile({ displayName, country, bio, avatarColor })
      toast('Perfil actualizado.')
    } catch {
      setError('No se pudo guardar el perfil. Inténtalo de nuevo en unos minutos.')
    } finally {
      setSaving(false)
    }
  }

  return <form className="form-grid" onSubmit={(event) => void submit(event)}>
    <div className="row" style={{ gap: 'var(--space-4)', alignItems: 'center' }}>
      <Avatar name={displayName || user?.email} color={avatarColor} size="lg" />
      <div className="stack" style={{ gap: 'var(--space-2)' }}>
        <span className="field-label">Color del avatar</span>
        <div className="row" role="radiogroup" aria-label="Color del avatar" style={{ gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          {AVATAR_COLORS.map((color) => <button key={color} type="button" role="radio" className="swatch" aria-checked={avatarColor === color} aria-label={`Color ${color}`} style={{ background: color }} onClick={() => setAvatarColor(color)}>{avatarColor === color && <Check size={14} />}</button>)}
        </div>
      </div>
    </div>
    <div className="field"><label htmlFor="profile-email">Correo electrónico</label><input id="profile-email" className="input" value={user?.email ?? ''} readOnly /><span className="field-hint">Puedes cambiarlo desde Seguridad.</span></div>
    <div className="field"><label htmlFor="profile-name">Nombre visible</label><input id="profile-name" className="input" value={displayName} maxLength={50} onChange={(event) => setDisplayName(event.target.value)} placeholder="Cómo quieres que te llamemos" /><span className="field-hint">Aparece en el panel y, si lo permites, en la clasificación mensual.</span></div>
    <div className="field"><label htmlFor="profile-country">País</label><select id="profile-country" className="select" value={country} onChange={(event) => setCountry(event.target.value)}><option value="">Sin indicar</option>{COUNTRIES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></div>
    <div className="field"><label htmlFor="profile-bio">Sobre ti</label><textarea id="profile-bio" className="textarea" value={bio} maxLength={160} rows={3} onChange={(event) => setBio(event.target.value)} placeholder="Una línea sobre ti (opcional)" /><span className="field-hint">{bio.length}/160</span></div>
    {error && <Alert tone="error">{error}</Alert>}
    <div className="form-actions"><Button variant="primary" type="submit" loading={saving}>Guardar cambios</Button></div>
  </form>
}

export default function ProfilePage() {
  const { prefs, loading, schemaReady } = useAccountPrefs()
  return <>
    <PageHeader title="Perfil" description="Tu identidad dentro de Faucet: así apareces en la clasificación." />
    <Card>
      <CardHeader title="Datos personales" />
      {loading ? <div className="stack"><Skeleton height={56} /><Skeleton height={38} /><Skeleton height={38} /><Skeleton height={80} /></div>
        : <>
          {!schemaReady && <Alert tone="warning">El almacenamiento de perfiles aún no está disponible en este entorno, por lo que no se podrán guardar los cambios.</Alert>}
          <ProfileForm prefs={prefs} />
        </>}
    </Card>
  </>
}
