import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Droplet, Menu, Monitor, Moon, Sun, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { captureReferralFromUrl } from '../lib/referral'
import { navigate } from '../lib/router'
import { contactEmail, siteName } from '../lib/site'
import { useTheme, type ThemePreference } from '../lib/theme'
import Link from '../lib/Link'
import AuthDialog from './AuthDialog'
import { AuthDialogContext, type AuthDialogApi, type AuthMode } from './auth'
import './landing.css'

const NAV_LINKS = [
  { href: '/#como-funciona', label: 'Cómo funciona' },
  { href: '/#funciones', label: 'Funciones' },
  { href: '/#reglas', label: 'Reglas' },
  { href: '/#faq', label: 'Preguntas' },
]

const CURRENT_YEAR = new Date().getFullYear()

const THEME_CYCLE: Record<ThemePreference, ThemePreference> = { system: 'light', light: 'dark', dark: 'system' }
const THEME_LABEL: Record<ThemePreference, string> = { system: 'Tema del sistema', light: 'Tema claro', dark: 'Tema oscuro' }
const THEME_ICON = { system: Monitor, light: Sun, dark: Moon }

export function LogoMark() {
  return <span className="landing-logo-mark" aria-hidden="true"><Droplet size={15} strokeWidth={2.4} /></span>
}

function ThemeToggle() {
  const { preference, setPreference } = useTheme()
  const Icon = THEME_ICON[preference]
  return <button type="button" className="btn btn-ghost btn-sm landing-icon-btn" onClick={() => setPreference(THEME_CYCLE[preference])} aria-label={`${THEME_LABEL[preference]}. Cambiar tema`} title={THEME_LABEL[preference]}><Icon size={16} /></button>
}

export default function PublicLayout({ children }: { children: ReactNode }) {
  const [hasReferral] = useState(captureReferralFromUrl)
  const [authOpen, setAuthOpen] = useState(() => hasReferral || new URLSearchParams(window.location.search).get('login') === '1')
  const [authMode, setAuthMode] = useState<AuthMode>(hasReferral ? 'signup' : 'login')
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('login') !== '1' && !params.has('ref')) return
    window.history.replaceState({}, '', window.location.pathname + window.location.hash)
  }, [])

  useEffect(() => {
    if (!supabase) return
    let active = true
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setSignedInEmail(data.session?.user.email ?? null)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSignedInEmail(session?.user.email ?? null)
      if (event === 'PASSWORD_RECOVERY') {
        setAuthMode('update-password')
        setAuthOpen(true)
      }
    })
    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const api = useMemo<AuthDialogApi>(() => ({
    signedInEmail,
    openAuth: (mode) => {
      setMenuOpen(false)
      setAuthMode(mode)
      setAuthOpen(true)
    },
  }), [signedInEmail])

  const goToPanel = () => { setMenuOpen(false); navigate('/dashboard') }

  return <AuthDialogContext.Provider value={api}>
    <div className="landing-shell">
      <a className="landing-skip" href="#contenido">Saltar al contenido</a>
      <header className="landing-header">
        <div className="landing-container landing-header-inner">
          <Link to="/" className="landing-brand" aria-label={`${siteName}, inicio`}><LogoMark /><span>{siteName}</span></Link>
          <nav className="landing-nav" aria-label="Principal">
            {NAV_LINKS.map((link) => <a key={link.href} href={link.href}>{link.label}</a>)}
          </nav>
          <div className="landing-header-actions">
            <ThemeToggle />
            {signedInEmail
              ? <>
                <span className="landing-user" title={signedInEmail}>{signedInEmail}</span>
                <button type="button" className="btn btn-primary btn-sm" onClick={goToPanel}>Ir al panel</button>
              </>
              : <>
                <button type="button" className="btn btn-ghost btn-sm landing-login-desktop" onClick={() => api.openAuth('login')}>Iniciar sesión</button>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => api.openAuth('signup')}>Crear cuenta</button>
              </>}
            <button type="button" className="btn btn-ghost btn-sm landing-icon-btn landing-menu-btn" aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={menuOpen} aria-controls="landing-mobile-menu" onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? <X size={18} /> : <Menu size={18} />}</button>
          </div>
        </div>
        {menuOpen && <div className="landing-mobile-menu" id="landing-mobile-menu">
          <nav className="landing-container" aria-label="Secciones">
            {NAV_LINKS.map((link) => <a key={link.href} href={link.href} onClick={() => setMenuOpen(false)}>{link.label}</a>)}
            {!signedInEmail && <button type="button" className="landing-mobile-login" onClick={() => api.openAuth('login')}>Iniciar sesión</button>}
          </nav>
        </div>}
      </header>

      <main id="contenido" className="landing-main">{children}</main>

      <footer className="landing-footer">
        <div className="landing-container landing-footer-inner">
          <div className="landing-footer-brand">
            <span className="landing-brand"><LogoMark /><span>{siteName}</span></span>
            <p>Los puntos son promocionales, no tienen valor monetario y no pueden retirarse.</p>
          </div>
          <nav className="landing-footer-links" aria-label="Legal">
            <Link to="/terminos">Términos de uso</Link>
            <Link to="/privacidad">Política de privacidad</Link>
            {contactEmail && <a href={`mailto:${contactEmail}`}>Contacto</a>}
          </nav>
        </div>
        <div className="landing-container landing-footer-legal">© {CURRENT_YEAR} {siteName}. Todos los derechos reservados.</div>
      </footer>

      {authOpen && <AuthDialog mode={authMode} onModeChange={setAuthMode} signedInEmail={signedInEmail} onClose={() => setAuthOpen(false)} />}
    </div>
  </AuthDialogContext.Provider>
}
