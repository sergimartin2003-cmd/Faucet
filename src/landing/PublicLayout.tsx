import { useEffect, useMemo, useState, type ReactNode } from 'react'
import AdSlot from '../components/AdSlot'
import { Droplet, Menu, Monitor, Moon, Sun, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { captureReferralFromUrl } from '../lib/referral'
import { navigate } from '../lib/router'
import { contactEmail, siteName } from '../lib/site'
import { useTheme, type ThemePreference } from '../lib/theme'
import { t } from '../lib/i18n'
import LangSwitch from '../components/LangSwitch'
import Link from '../lib/Link'
import PriceTicker from '../components/PriceTicker'
import AuthDialog from './AuthDialog'
import { AuthDialogContext, type AuthDialogApi, type AuthMode } from './auth'
import './landing.css'

const navLinks = () => [
  { href: '/#ganar', label: t('Ganar') },
  { href: '/#como-funciona', label: t('Cómo funciona') },
  { href: '/#reglas', label: t('Reglas') },
  { href: '/#faq', label: t('Preguntas') },
]

const CURRENT_YEAR = new Date().getFullYear()

const THEME_CYCLE: Record<ThemePreference, ThemePreference> = { system: 'light', light: 'dark', dark: 'system' }
const themeLabel = (preference: ThemePreference) => ({ system: t('Tema del sistema'), light: t('Tema claro'), dark: t('Tema oscuro') })[preference]
const THEME_ICON = { system: Monitor, light: Sun, dark: Moon }

export function LogoMark() {
  return <span className="landing-logo-mark" aria-hidden="true"><Droplet size={15} strokeWidth={2.4} /></span>
}

function ThemeToggle() {
  const { preference, setPreference } = useTheme()
  const Icon = THEME_ICON[preference]
  return <button type="button" className="btn btn-ghost btn-sm landing-icon-btn" onClick={() => setPreference(THEME_CYCLE[preference])} aria-label={t('{theme}. Cambiar tema', { theme: themeLabel(preference) })} title={themeLabel(preference)}><Icon size={16} /></button>
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
      <a className="landing-skip" href="#contenido">{t('Saltar al contenido')}</a>
      <PriceTicker />
      <header className="landing-header">
        <div className="landing-container landing-header-inner">
          <Link to="/" className="landing-brand" aria-label={t('{site}, inicio', { site: siteName })}><LogoMark /><span>{siteName}</span></Link>
          <nav className="landing-nav" aria-label={t('Principal')}>
            {navLinks().map((link) => <a key={link.href} href={link.href}>{link.label}</a>)}
          </nav>
          <div className="landing-header-actions">
            <ThemeToggle />
            <LangSwitch className="btn btn-ghost btn-sm" />
            {signedInEmail
              ? <>
                <span className="landing-user" title={signedInEmail}>{signedInEmail}</span>
                <button type="button" className="btn btn-primary btn-sm" onClick={goToPanel}>{t('Ir al panel')}</button>
              </>
              : <>
                <button type="button" className="btn btn-ghost btn-sm landing-login-desktop" onClick={() => api.openAuth('login')}>{t('Iniciar sesión')}</button>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => api.openAuth('signup')}>{t('Crear cuenta')}</button>
              </>}
            <button type="button" className="btn btn-ghost btn-sm landing-icon-btn landing-menu-btn" aria-label={menuOpen ? t('Cerrar menú') : t('Abrir menú')} aria-expanded={menuOpen} aria-controls="landing-mobile-menu" onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? <X size={18} /> : <Menu size={18} />}</button>
          </div>
        </div>
        {menuOpen && <div className="landing-mobile-menu" id="landing-mobile-menu">
          <nav className="landing-container" aria-label={t('Secciones')}>
            {navLinks().map((link) => <a key={link.href} href={link.href} onClick={() => setMenuOpen(false)}>{link.label}</a>)}
            {!signedInEmail && <button type="button" className="landing-mobile-login" onClick={() => api.openAuth('login')}>{t('Iniciar sesión')}</button>}
          </nav>
        </div>}
      </header>

      <main id="contenido" className="landing-main">{children}</main>
      <div className="landing-container"><AdSlot /></div>

      <footer className="landing-footer">
        <div className="landing-container landing-footer-inner">
          <div className="landing-footer-brand">
            <span className="landing-brand"><LogoMark /><span>{siteName}</span></span>
            <p>{t('Gana puntos con encuestas y ofertas y retíralos en crypto: 1.000 puntos = 1 $. Solo mayores de 18 años.')}</p>
          </div>
          <nav className="landing-footer-links" aria-label={t('Legal')}>
            <Link to="/terminos">{t('Términos de uso')}</Link>
            <Link to="/privacidad">{t('Política de privacidad')}</Link>
            {contactEmail && <a href={`mailto:${contactEmail}`}>{t('Contacto')}</a>}
          </nav>
        </div>
        <div className="landing-container landing-footer-legal">© {CURRENT_YEAR} {siteName}. {t('Todos los derechos reservados.')}</div>
      </footer>

      {authOpen && <AuthDialog mode={authMode} onModeChange={setAuthMode} signedInEmail={signedInEmail} onClose={() => setAuthOpen(false)} />}
    </div>
  </AuthDialogContext.Provider>
}
