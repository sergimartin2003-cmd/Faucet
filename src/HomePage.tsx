import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import {
  Activity,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  CandlestickChart,
  Check,
  CircleDollarSign,
  Code2,
  Eye,
  EyeOff,
  Flame,
  Gamepad2,
  Gift,
  HandCoins,
  KeyRound,
  LockKeyhole,
  LogOut,
  Mail,
  Megaphone,
  MousePointerClick,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
  Wallet,
  X,
} from 'lucide-react'
import {
  ColorType,
  createChart,
  LineSeries,
  type IChartApi,
  type UTCTimestamp,
} from 'lightweight-charts'
import SupabaseStatus from './components/SupabaseStatus'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import { captureReferralFromUrl } from './lib/referral'
import CountUp from './components/CountUp'
import Captcha from './components/Captcha'
import { turnstileSiteKey } from './lib/turnstile'
import { useCardPointer, useParallax, useReveal } from './lib/motion'
import './HomePage.css'

const CURRENT_YEAR = new Date().getFullYear()
const API_BASE = 'https://api.binance.com/api/v3'
const MARKET_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'DOGEUSDT']

type MiniTicker = { symbol: string; lastPrice: string; priceChangePercent: string }
type KlineRow = [number, string, string, string, string, string]

const coinRows = [
  { symbol: 'BTC', name: 'Bitcoin', balance: '0.02481', value: '$1,642.80', mark: '₿', tone: 'coin-orange' },
  { symbol: 'ETH', name: 'Ethereum', balance: '0.4820', value: '$1,384.26', mark: 'Ξ', tone: 'coin-lilac' },
  { symbol: 'USDT', name: 'Tether', balance: '842.50', value: '$842.50', mark: '₮', tone: 'coin-green' },
]

const earnRows = [
  { icon: 'F', label: 'Faucets', detail: 'Recompensa diaria · puntos internos' },
  { icon: 'O', label: 'Offerwalls y encuestas', detail: 'Aún sin proveedor · ninguna oferta activa' },
  { icon: '↗', label: 'Paid-to-click', detail: 'Aún sin proveedor · ninguna campaña activa' },
]

function StaticButton({ children, className = '', onClick }: {
  children: React.ReactNode
  className?: string
  onClick?: () => void
}) {
  return <button className={`static-button ${className}`} type="button" disabled={!onClick} onClick={onClick}>{children}</button>
}

export default function HomePage() {
  const [hasReferral] = useState(captureReferralFromUrl)
  const [authOpen, setAuthOpen] = useState(() => hasReferral || new URLSearchParams(window.location.search).get('login') === '1')
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'recovery' | 'update-password'>(hasReferral ? 'signup' : 'login')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authName, setAuthName] = useState('')
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState('')
  const [authMessage, setAuthMessage] = useState('')
  const [canResendConfirmation, setCanResendConfirmation] = useState(false)
  const [captchaToken, setCaptchaToken] = useState('')
  const [captchaKey, setCaptchaKey] = useState(0)
  const [authRedirect, setAuthRedirect] = useState('/dashboard')
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const pageRef = useRef<HTMLElement>(null)
  useParallax(pageRef)
  useReveal(pageRef)
  const spotlightHandlers = useCardPointer('.bento-card')
  const tiltHandlers = useCardPointer('.tilt-card')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('login') !== '1' && !params.has('ref')) return
    window.history.replaceState({}, '', window.location.pathname)
  }, [])

  useEffect(() => {
    if (!supabase) return
    let active = true
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setSignedInEmail(data.session?.user.email ?? null)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedInEmail(session?.user.email ?? null)
      if (_event === 'PASSWORD_RECOVERY') {
        setAuthMode('update-password')
        setAuthError('')
        setAuthMessage('')
        setAuthOpen(true)
      }
    })
    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const openAuth = (mode: 'login' | 'signup') => {
    setAuthMode(mode)
    setAuthError('')
    setAuthMessage('')
    setCanResendConfirmation(false)
    setAuthOpen(true)
  }

  const openWallet = async () => {
    if (signedInEmail) {
      window.location.assign('/dashboard')
      return
    }
    if (supabase) {
      const { data, error } = await supabase.auth.getSession()
      if (!error && data.session) {
        window.location.assign('/dashboard')
        return
      }
    }
    openAuth('signup')
  }

  const openDashboardSection = async (section: string) => {
    const destination = `/dashboard?section=${encodeURIComponent(section)}`
    if (signedInEmail) {
      window.location.assign(destination)
      return
    }
    if (supabase) {
      const { data, error } = await supabase.auth.getSession()
      if (!error && data.session) {
        window.location.assign(destination)
        return
      }
    }
    setAuthRedirect(destination)
    openAuth('login')
  }

  const submitAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase) {
      setAuthError('Supabase aún no está configurado. Añade la URL y la clave pública en .env.local.')
      return
    }
    setAuthBusy(true)
    setAuthError('')
    setAuthMessage('')
    setCanResendConfirmation(false)
    const needsCaptcha = Boolean(turnstileSiteKey) && authMode !== 'update-password'
    if (needsCaptcha && !captchaToken) {
      setAuthError('Completa la verificación anti-bots para continuar.')
      setAuthBusy(false)
      return
    }
    const captchaOptions = needsCaptcha ? { captchaToken } : {}
    try {
      if (authMode === 'signup') {
        const { data: emailAllowed } = await supabase.rpc('is_email_allowed', { p_email: authEmail.trim() })
        if (emailAllowed === false) throw new Error('disposable email')
        const { data, error } = await supabase.auth.signUp({
          email: authEmail.trim(),
          password: authPassword,
          options: { data: { display_name: authName.trim() || undefined }, emailRedirectTo: window.location.origin, ...captchaOptions },
        })
        if (error) throw error
        if (data.session) {
          setAuthMessage('Cuenta creada. Ya has iniciado sesión.')
          window.location.assign(authRedirect)
        } else {
          setAuthMessage('Cuenta creada. Revisa tu correo para confirmar la dirección antes de iniciar sesión.')
        }
      } else if (authMode === 'recovery') {
        const { error } = await supabase.auth.resetPasswordForEmail(authEmail.trim(), {
          redirectTo: window.location.origin,
          ...captchaOptions,
        })
        if (error) throw error
        setAuthMessage('Si existe una cuenta para este correo, recibirás un enlace para restablecer la contraseña.')
      } else if (authMode === 'update-password') {
        const { error } = await supabase.auth.updateUser({ password: authPassword })
        if (error) throw error
        setAuthMessage('Contraseña actualizada. Ya puedes seguir usando tu cuenta.')
        setAuthMode('login')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: authEmail.trim(), password: authPassword, options: captchaOptions })
        if (error) throw error
        setAuthMessage('Sesión iniciada correctamente.')
        window.location.assign(authRedirect)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo completar la solicitud. Inténtalo de nuevo.'
      const normalizedMessage = message.toLowerCase()
      if (authMode === 'signup' && normalizedMessage.includes('error sending confirmation email')) {
        setAuthError('Supabase no pudo enviar el correo. El SMTP de prueba solo entrega a correos del equipo y tiene un límite bajo. Configura un SMTP propio en Supabase → Authentication → SMTP Settings.')
      } else if (authMode === 'signup' && (normalizedMessage.includes('disposable') || normalizedMessage.includes('database error saving new user'))) {
        setAuthError('Los correos temporales o desechables no están permitidos. Usa tu correo personal.')
      } else if (normalizedMessage.includes('captcha')) {
        setAuthError('La verificación anti-bots falló. Inténtalo de nuevo.')
      } else if (normalizedMessage.includes('rate limit') || normalizedMessage.includes('too many')) {
        setAuthError('Demasiados intentos. Espera unos minutos antes de volver a probar.')
      } else if (authMode === 'login' && normalizedMessage.includes('email not confirmed')) {
        setAuthError('Tu correo todavía no está confirmado.')
        setCanResendConfirmation(true)
      } else {
        setAuthError(message)
      }
    } finally {
      setAuthBusy(false)
      setCaptchaToken('')
      setCaptchaKey((key) => key + 1)
    }
  }

  const resendConfirmation = async () => {
    if (!supabase || !authEmail.trim()) return
    setAuthBusy(true)
    setAuthError('')
    setAuthMessage('')
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: authEmail.trim(),
        options: { emailRedirectTo: window.location.origin },
      })
      if (error) throw error
      setCanResendConfirmation(false)
      setAuthMessage('Solicitud enviada. Revisa la bandeja de entrada y el spam.')
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      setAuthError(message.toLowerCase().includes('error sending confirmation email')
        ? 'Supabase no pudo enviar el correo. Configura un SMTP propio en Supabase → Authentication → SMTP Settings y vuelve a intentarlo.'
        : message || 'No se pudo reenviar el correo. Inténtalo de nuevo.')
    } finally {
      setAuthBusy(false)
    }
  }

  const signOut = async () => {
    if (!supabase) return
    setAuthBusy(true)
    setAuthError('')
    setAuthMessage('')
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      setAuthMessage('Sesión cerrada. Ya puedes revisar el correo de confirmación.')
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'No se pudo cerrar la sesión.')
    } finally {
      setAuthBusy(false)
    }
  }

  return (
    <main className="home-page" ref={pageRef}>
      <div className="scroll-progress" aria-hidden="true" />
      <header className="home-header">
        <a className="home-brand" href="/" aria-label="Faucet Protocol, inicio">
          <span className="home-brand-mark"><i /></span>
          <span className="home-brand-name">faucet<span>.</span></span>
          <span className="home-brand-tag">PROTOCOL</span>
        </a>
        <nav className={`home-nav ${menuOpen ? 'home-nav-open' : ''}`} aria-label="Secciones del producto">
          {[['Ganar', 'Earn'], ['Faucets', 'Faucets'], ['Juegos', 'Juegos'], ['Staking', 'Staking'], ['Anunciar', 'Anunciar'], ['API', 'API']].map(([label, section]) => <button key={section} onClick={() => { setMenuOpen(false); void openDashboardSection(section) }}>{label}</button>)}
        </nav>
        <div className="home-auth-actions">
          {signedInEmail ? <><span className="home-user-email">{signedInEmail}</span><StaticButton className="home-login" onClick={() => void signOut()}><LogOut size={14} />Salir</StaticButton></> : <><StaticButton className="home-login" onClick={() => openAuth('login')}>Iniciar sesión</StaticButton><StaticButton className="home-signup" onClick={() => openAuth('signup')}>Crear cuenta <ArrowRight size={15} /></StaticButton></>}
          <button className="home-burger" type="button" aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}><span /><span /></button>
        </div>
      </header>

      <section className="home-hero" aria-labelledby="hero-title">
        <div className="hero-backdrop" aria-hidden="true">
          <div className="hero-lines" data-depth="0.08" />
          <div className="hero-orb orb-a" data-depth="-0.12" style={{ '--md': 26 } as CSSProperties} />
          <div className="hero-orb orb-b" data-depth="0.16" style={{ '--md': -34 } as CSSProperties} />
          <div className="hero-orb orb-c" data-depth="-0.22" style={{ '--md': 18 } as CSSProperties} />
          <span className="float-coin coin-1" data-depth="-0.28" style={{ '--md': 42 } as CSSProperties}><i>₿</i></span>
          <span className="float-coin coin-2" data-depth="0.2" style={{ '--md': -52 } as CSSProperties}><i>Ξ</i></span>
          <span className="float-coin coin-3" data-depth="-0.1" style={{ '--md': 30 } as CSSProperties}><i>◎</i></span>
          <span className="float-coin coin-4" data-depth="0.32" style={{ '--md': -22 } as CSSProperties}><i>Ð</i></span>
          <span className="float-coin coin-5" data-depth="-0.34" style={{ '--md': 60 } as CSSProperties}><i>₮</i></span>
        </div>

        <div className="hero-inner">
          <div className="hero-copy">
            <div className="home-eyebrow hero-in" style={{ '--i': 0 } as CSSProperties}><span className="pulse-dot" /> MICRO-WALLET · EARN · WEB3</div>
            <h1 id="hero-title" className="hero-title">
              <span className="title-line"><span className="hero-in" style={{ '--i': 1 } as CSSProperties}>Tu cripto.</span></span>
              <span className="title-line"><span className="hero-in gradient-text" style={{ '--i': 2 } as CSSProperties}>En movimiento.</span></span>
            </h1>
            <p className="hero-lede hero-in" style={{ '--i': 3 } as CSSProperties}>Gana puntos con tareas verificadas, sigue los mercados en vivo y prepara tu wallet en un solo lugar. Una plataforma pensada para usuarios, creadores y comunidades cripto.</p>
            <div className="hero-actions hero-in" style={{ '--i': 4 } as CSSProperties}>
              <StaticButton className="hero-primary" onClick={() => void openWallet()}>Abrir mi cuenta <ArrowRight size={17} /></StaticButton>
              <StaticButton className="hero-secondary" onClick={() => void openDashboardSection('Earn')}>Ganar ahora <ArrowUpRight size={16} /></StaticButton>
            </div>
            <ul className="hero-proof hero-in" style={{ '--i': 5 } as CSSProperties}>
              <li><Check size={14} /> Faucet diario con puntos internos</li>
              <li><Check size={14} /> 2FA con app autenticadora</li>
              <li><Check size={14} /> Mercados Binance en vivo</li>
            </ul>
          </div>

          <div className="hero-stage hero-in" style={{ '--i': 3 } as CSSProperties} {...tiltHandlers}>
            <div className="stage-chip chip-earn" data-depth="-0.1" style={{ '--md': 20 } as CSSProperties}><span className="chip-icon"><Gift size={15} /></span><div><strong>Faucet diario</strong><small>+10 puntos cada 24 h</small></div></div>
            <div className="tilt-card"><MarketPreview /></div>
            <div className="stage-chip chip-secure" data-depth="0.14" style={{ '--md': -26 } as CSSProperties}><span className="chip-icon chip-icon-cyan"><ShieldCheck size={15} /></span><div><strong>Cuenta protegida</strong><small>TOTP + códigos de recuperación</small></div></div>
          </div>
        </div>
        <a className="scroll-hint" href="#ecosistema" aria-label="Ir al ecosistema"><span /></a>
      </section>

      <section className="home-ticker-strip" aria-label="Mercados destacados">
        <div className="ticker-intro"><span className="pulse-dot" /> MERCADOS EN VIVO</div>
        <MarketTickers />
      </section>

      <section className="home-facts" aria-label="Recompensas disponibles">
        {[
          { value: 10, suffix: '', unit: 'PTS', label: 'Faucet diario', detail: 'Una reclamación cada 24 horas' },
          { value: 25, suffix: '', unit: 'PTS', label: 'Primera tarea', detail: 'Completa tu perfil una sola vez' },
          { value: 15, suffix: '', unit: 'PTS', label: 'Por referido', detail: 'Cuando tu invitado completa su perfil' },
          { value: 2, suffix: 'FA', unit: '', label: 'Acceso seguro', detail: 'TOTP y códigos de recuperación' },
        ].map((fact, index) => <div className="fact" data-reveal style={{ '--d': `${index * 90}ms` } as CSSProperties} key={fact.label}>
          <strong className="fact-value">{fact.suffix === 'FA' ? <>2<span>FA</span></> : <><CountUp to={fact.value} /><span>{fact.unit}</span></>}</strong>
          <span className="fact-label">{fact.label}</span>
          <small>{fact.detail}</small>
        </div>)}
      </section>

      <div className="home-content">
        <section className="home-section-heading" id="ecosistema">
          <div data-reveal><span className="home-kicker">UN ECOSISTEMA COMPLETO</span><h2>Todo lo que necesitas.<br /><span className="gradient-text">Todo conectado.</span></h2></div>
          <p data-reveal style={{ '--d': '120ms' } as CSSProperties}>Desde la primera recompensa hasta las herramientas de crecimiento para tu proyecto. Lo que ya funciona está marcado como activo; el resto son vistas previas.</p>
        </section>

        <section className="bento" aria-label="Funciones de Faucet Protocol" {...spotlightHandlers}>
          <article className="bento-card b-wallet" data-reveal>
            <div className="card-head"><span className="card-icon ic-blue"><Wallet size={18} /></span><span className="card-label">WALLET</span><span className="badge badge-live">PUNTOS ACTIVOS</span></div>
            <h3>Tu micro-wallet, <span className="soft">paso a paso.</span></h3>
            <p>Hoy gestionas tu saldo de puntos internos con historial real. Los activos cripto de abajo son una vista previa de lo que llegará.</p>
            <div className="wallet-preview">
              <div className="wallet-preview-heading"><span>PORTAFOLIO <i>VISTA PREVIA</i></span><strong>$4,182.20 <small>USD</small></strong></div>
              {coinRows.map((coin) => <div className="wallet-coin-row" key={coin.symbol}><span className={`coin-mark ${coin.tone}`}>{coin.mark}</span><span className="coin-title"><strong>{coin.symbol}</strong><small>{coin.name}</small></span><span className="coin-balance"><strong>{coin.balance} <small>{coin.symbol}</small></strong><small>{coin.value}</small></span></div>)}
            </div>
            <button className="card-link" type="button" onClick={() => void openDashboardSection('Cartera')}>Ver mi cartera <ArrowRight size={15} /></button>
          </article>

          <article className="bento-card b-earn" data-reveal style={{ '--d': '90ms' } as CSSProperties}>
            <div className="card-head"><span className="card-icon ic-cyan"><HandCoins size={18} /></span><span className="card-label">EARN</span><span className="badge badge-live">ACTIVO</span></div>
            <h3>Tareas verificadas. <span className="soft">Puntos internos.</span></h3>
            <p>El faucet diario y la tarea de perfil ya acreditan puntos. Las ofertas externas llegarán cuando haya proveedor.</p>
            <div className="earn-preview-list">{earnRows.map((row) => <div className="earn-preview-row" key={row.label}><span>{row.icon}</span><div><strong>{row.label}</strong><small>{row.detail}</small></div><ArrowRight size={15} /></div>)}</div>
            <button className="card-link" type="button" onClick={() => void openDashboardSection('Earn')}>Empezar a ganar <ArrowRight size={15} /></button>
          </article>

          <article className="bento-card b-games" data-reveal>
            <div className="card-head"><span className="card-icon ic-violet"><Gamepad2 size={18} /></span><span className="card-label">FAIR PLAY</span><span className="badge">VISTA PREVIA</span></div>
            <h3>Juega con transparencia.</h3>
            <p>Dice, Plinko y Mines gratuitos de muestra, sin apuestas ni premios.</p>
            <div className="game-tile-row"><div><span className="game-glyph glyph-coral">7</span><strong>Dice</strong></div><div><span className="game-glyph glyph-blue">•••</span><strong>Plinko</strong></div><div><span className="game-glyph glyph-gold">✳</span><strong>Mines</strong></div></div>
            <button className="card-link" type="button" onClick={() => void openDashboardSection('Juegos')}>Ver juegos <ArrowRight size={15} /></button>
          </article>

          <article className="bento-card b-swap" data-reveal style={{ '--d': '90ms' } as CSSProperties}>
            <div className="card-head"><span className="card-icon ic-blue"><ArrowLeftRight size={18} /></span><span className="card-label">SWAP</span><span className="badge">VISTA PREVIA</span></div>
            <h3>Cambia de activo.</h3>
            <p>Cotización y comisiones a la vista antes de convertir. Aún sin operaciones reales.</p>
            <div className="swap-preview"><div><span className="coin-mark coin-orange">₿</span><strong>BTC</strong><small>Bitcoin</small></div><span className="swap-arrow"><ArrowLeftRight size={16} /></span><div><span className="coin-mark coin-green">₮</span><strong>USDT</strong><small>Tether</small></div></div>
            <button className="card-link" type="button" onClick={() => void openDashboardSection('Exchange')}>Ir al exchange <ArrowRight size={15} /></button>
          </article>

          <article className="bento-card b-staking" data-reveal style={{ '--d': '180ms' } as CSSProperties}>
            <div className="card-head"><span className="card-icon ic-gold"><Flame size={18} /></span><span className="card-label">TOKEN · DEFI</span><span className="badge">VISTA PREVIA</span></div>
            <h3>Utilidad que va más allá.</h3>
            <p>FEY para ventajas de plataforma y estrategias DeFi opt-in, con riesgos visibles.</p>
            <div className="token-utility-list"><span><Check size={14} /> Descuentos en comisiones</span><span><Check size={14} /> Staking flexible</span><span><Check size={14} /> Rendimiento variable, no garantizado</span></div>
            <button className="card-link" type="button" onClick={() => void openDashboardSection('Staking')}>Explorar staking <ArrowRight size={15} /></button>
          </article>

          <article className="bento-card b-social" data-reveal>
            <div className="card-head"><span className="card-icon ic-cyan"><Users size={18} /></span><span className="card-label">AFILIADOS · PROGRESO</span><span className="badge badge-live">REFERIDOS ACTIVOS</span></div>
            <div className="social-copy"><div><h3>Crece junto a tu comunidad.</h3><p>Invita con tu enlace y gana puntos cuando tus referidos completan su perfil. Temporadas y gremios, en vista previa.</p></div><div className="season-stamp"><Trophy size={20} /><span>SEASON<br /><strong>04</strong></span></div></div>
            <div className="level-preview"><div className="level-top"><span>NIVEL 08 <i>EXPLORER · MUESTRA</i></span><strong>680 <small>/ 1,000 XP</small></strong></div><div className="level-track"><span /></div></div>
            <button className="card-link" type="button" onClick={() => void openDashboardSection('Afiliados')}>Obtener mi enlace <ArrowRight size={15} /></button>
          </article>

          <article className="bento-card b-ads" data-reveal style={{ '--d': '90ms' } as CSSProperties}>
            <div className="card-head"><span className="card-icon ic-gold"><Megaphone size={18} /></span><span className="card-label">PARA ANUNCIANTES</span><span className="badge">VISTA PREVIA</span></div>
            <h3>Llega a usuarios que ya usan cripto.</h3>
            <p>PTC, banners, ubicaciones patrocinadas y anuncios nativos con medición clara.</p>
            <div className="ad-format-row"><span><MousePointerClick size={15} /> PTC</span><span><Activity size={15} /> Banners</span><span><Sparkles size={15} /> Nativos</span></div>
            <button className="card-link" type="button" onClick={() => void openDashboardSection('Anunciar')}>Ver campañas <ArrowRight size={15} /></button>
          </article>

          <article className="bento-card b-dev" data-reveal>
            <div className="card-head"><span className="card-icon ic-blue"><Code2 size={18} /></span><span className="card-label">PARA DEVELOPERS</span><span className="badge">VISTA PREVIA</span></div>
            <h3>Pagos listos para integrar.</h3>
            <p>API, webhooks idempotentes y sandbox para tu producto.</p>
            <div className="api-snippet"><span><i /> API · SANDBOX</span><code><b>POST</b> /v1/payouts</code><code>asset: <em>"USDT"</em> · amount: <em>"1.50"</em></code></div>
            <button className="card-link" type="button" onClick={() => void openDashboardSection('API')}>Ver la API <ArrowRight size={15} /></button>
          </article>

          <article className="bento-card b-security" data-reveal style={{ '--d': '90ms' } as CSSProperties}>
            <div className="card-head"><span className="card-icon ic-cyan"><ShieldCheck size={18} /></span><span className="card-label">CAPA DE CONFIANZA</span><span className="badge badge-live">ACTIVO</span></div>
            <h3>Protección desde el acceso.</h3>
            <p>Email, 2FA con TOTP y códigos de recuperación de un solo uso.</p>
            <div className="security-tags"><span><KeyRound size={14} /> Email · 2FA</span><span><LockKeyhole size={14} /> Códigos de recuperación</span><span><Check size={14} /> RLS en base de datos</span></div>
            <button className="card-link" type="button" onClick={() => void openDashboardSection('Seguridad')}>Revisar seguridad <ArrowRight size={15} /></button>
          </article>

          <article className="bento-card b-analytics" data-reveal style={{ '--d': '180ms' } as CSSProperties}>
            <div className="card-head"><span className="card-icon ic-violet"><Activity size={18} /></span><span className="card-label">ANALÍTICA</span><span className="badge badge-live">ACTIVO</span></div>
            <h3>Tu actividad, a la vista.</h3>
            <p>Mapa de actividad y puntos del mes calculados desde tu historial real.</p>
            <div className="analytics-preview"><div className="analytics-bars">{Array.from({ length: 36 }, (_, index) => <i key={index} style={{ '--n': index, '--h': 22 + (index * 37) % 78 } as CSSProperties} />)}</div></div>
            <button className="card-link" type="button" onClick={() => void openDashboardSection('Resumen')}>Ver mi dashboard <ArrowRight size={15} /></button>
          </article>
        </section>

        <section className="home-steps" aria-labelledby="steps-title">
          <div className="steps-heading" data-reveal><span className="home-kicker">EMPIEZA EN MINUTOS</span><h2 id="steps-title">Tu primera recompensa,<br /><span className="gradient-text">en tres pasos.</span></h2></div>
          <ol className="steps-list">
            {[
              { n: '01', title: 'Crea tu cuenta', text: 'Solo necesitas un correo. Verifícalo para desbloquear tus primeras tareas.', icon: <Mail size={20} />, depth: -0.04 },
              { n: '02', title: 'Reclama y completa', text: 'Cobra tu faucet diario y completa tu perfil para sumar puntos internos.', icon: <Gift size={20} />, depth: 0.05 },
              { n: '03', title: 'Protege y crece', text: 'Activa 2FA e invita a tu comunidad con tu enlace de referidos.', icon: <ShieldCheck size={20} />, depth: -0.07 },
            ].map((step, index) => <li className="step-card" key={step.n} data-reveal data-depth={step.depth} style={{ '--d': `${index * 110}ms` } as CSSProperties}><span className="step-number">{step.n}</span><span className="step-icon">{step.icon}</span><h3>{step.title}</h3><p>{step.text}</p></li>)}
          </ol>
        </section>

        <section className="home-cta" data-reveal>
          <div className="cta-orb cta-orb-a" data-depth="-0.1" />
          <div className="cta-orb cta-orb-b" data-depth="0.12" />
          <div className="cta-copy"><span className="home-kicker">FAUCET PROTOCOL</span><h2>Tu primer paso<br />está a un clic.</h2><p>Los puntos son promocionales y no tienen valor monetario. Sin custodia de fondos en esta fase.</p></div>
          <div className="cta-actions"><StaticButton className="hero-primary" onClick={() => openAuth('signup')}>Crear mi cuenta <ArrowRight size={17} /></StaticButton><StaticButton className="hero-secondary" onClick={() => openAuth('login')}>Ya tengo cuenta</StaticButton></div>
        </section>

        <footer className="home-footer">
          <div className="footer-brand"><span className="home-brand-mark"><i /></span><strong>faucet<span>.</span></strong><small>Una plataforma cripto, sin ruido.</small></div>
          <div className="footer-link-group"><span>PRODUCTO</span><b>Comisiones</b><b>Verificar pagos</b><b>API docs</b></div>
          <div className="footer-link-group"><span>RECURSOS</span><b>Centro de ayuda</b><b>Blog</b><b>Reportar abuso</b></div>
          <div className="footer-link-group"><span>LEGAL</span><b>Términos</b><b>Privacidad</b><b>Juego responsable</b></div>
          <div className="footer-status"><SupabaseStatus /><small>© {CURRENT_YEAR} Faucet Protocol</small></div>
        </footer>
      </div>

      {authOpen && <div className="auth-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !authBusy) setAuthOpen(false) }}>
        <section className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
          <button className="auth-close" type="button" aria-label="Cerrar" disabled={authBusy} onClick={() => setAuthOpen(false)}><X size={17} /></button>
          <span className="auth-mark"><LockKeyhole size={19} /></span>
          <span className="home-kicker">FAUCET PROTOCOL · CUENTA</span>
          <h2 id="auth-title">{authMode === 'signup' ? 'Crea tu cuenta' : authMode === 'recovery' ? 'Recupera el acceso' : authMode === 'update-password' ? 'Elige una contraseña nueva' : 'Qué bueno verte.'}</h2>
          <p className="auth-intro">{authMode === 'signup' ? 'Empieza con tu correo. Podrás conectar una wallet después.' : authMode === 'recovery' ? 'Te enviaremos un enlace para restablecer tu contraseña.' : authMode === 'update-password' ? 'Actualiza tu contraseña para recuperar el acceso a tu cuenta.' : 'Inicia sesión para continuar a tu wallet.'}</p>
          {!isSupabaseConfigured && <div className="auth-config-warning"><CircleDollarSign size={16} /><span>Falta configurar Supabase. Añade <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> en <code>.env.local</code> y reinicia el servidor.</span></div>}
          <form className="auth-form" onSubmit={(event) => void submitAuth(event)}>
            {authMode === 'signup' && <label><span>Nombre (opcional)</span><div className="auth-input-wrap"><Users size={15} /><input autoComplete="name" value={authName} onChange={(event) => setAuthName(event.target.value)} placeholder="Cómo te llamamos" maxLength={50} disabled={!isSupabaseConfigured || authBusy} /></div></label>}
            <label><span>Correo electrónico</span><div className="auth-input-wrap"><Mail size={15} /><input type="email" autoComplete="email" required value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="nombre@correo.com" disabled={!isSupabaseConfigured || authBusy} /></div></label>
            {authMode === 'login' && <label><span>Contraseña</span><div className="auth-input-wrap"><KeyRound size={15} /><input type={passwordVisible ? 'text' : 'password'} autoComplete="current-password" minLength={8} required value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} placeholder="Mínimo 8 caracteres" disabled={!isSupabaseConfigured || authBusy} /><button className="auth-password-toggle" type="button" aria-label={passwordVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={() => setPasswordVisible(!passwordVisible)} disabled={!isSupabaseConfigured || authBusy}>{passwordVisible ? <EyeOff size={15} /> : <Eye size={15} />}</button></div></label>}
            {(authMode === 'signup' || authMode === 'update-password') && <label><span>{authMode === 'signup' ? 'Contraseña' : 'Nueva contraseña'}</span><div className="auth-input-wrap"><KeyRound size={15} /><input type={passwordVisible ? 'text' : 'password'} autoComplete="new-password" minLength={8} required value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} placeholder="Mínimo 8 caracteres" disabled={!isSupabaseConfigured || authBusy} /><button className="auth-password-toggle" type="button" aria-label={passwordVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={() => setPasswordVisible(!passwordVisible)} disabled={!isSupabaseConfigured || authBusy}>{passwordVisible ? <EyeOff size={15} /> : <Eye size={15} />}</button></div></label>}
            {authMode === 'login' && <button className="auth-text-button auth-forgot" type="button" onClick={() => { setAuthMode('recovery'); setAuthError(''); setAuthMessage('') }}>¿Olvidaste tu contraseña?</button>}
            {authError && <p className="auth-feedback auth-feedback-error" role="alert">{authError}</p>}
            {canResendConfirmation && <button className="auth-text-button" type="button" disabled={authBusy || !authEmail.trim()} onClick={() => void resendConfirmation()}>{authBusy ? 'Enviando…' : 'Reenviar correo de verificación'}</button>}
            {authMessage && <p className="auth-feedback auth-feedback-success" role="status">{authMessage}</p>}
            {authMode === 'signup' && signedInEmail && <button className="auth-signout-button" type="button" disabled={authBusy} onClick={() => void signOut()}><LogOut size={14} />{authBusy ? 'Cerrando sesión…' : 'Cerrar sesión para revisar el correo'}</button>}
            {authMode !== 'update-password' && <Captcha key={captchaKey} onToken={setCaptchaToken} />}
            <button className="auth-submit" type="submit" disabled={!isSupabaseConfigured || authBusy}>{authBusy ? 'Procesando…' : authMode === 'signup' ? 'Crear cuenta' : authMode === 'recovery' ? 'Enviar enlace' : authMode === 'update-password' ? 'Guardar contraseña' : 'Iniciar sesión'} <ArrowRight size={15} /></button>
          </form>
          <div className="auth-switch">{authMode === 'recovery' || authMode === 'update-password' ? <button className="auth-text-button" type="button" onClick={() => { setAuthMode('login'); setAuthError(''); setAuthMessage('') }}>Volver a iniciar sesión</button> : <>{authMode === 'signup' ? '¿Ya tienes cuenta?' : '¿Primera vez por aquí?'} <button className="auth-text-button" type="button" onClick={() => { setAuthMode(authMode === 'signup' ? 'login' : 'signup'); setAuthError(''); setAuthMessage('') }}>{authMode === 'signup' ? 'Inicia sesión' : 'Crear cuenta'}</button></>}</div>
          <div className="auth-legal"><ShieldCheck size={13} /> Sesión protegida por Supabase Auth</div>
        </section>
      </div>}
    </main>
  )
}

function MarketPreview() {
  const [tickers, setTickers] = useState<MiniTicker[]>([])
  const [streamStatus, setStreamStatus] = useState('CONECTANDO')

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams({ symbols: JSON.stringify(MARKET_SYMBOLS) })
    const refresh = async () => {
      try {
        const response = await fetch(`${API_BASE}/ticker/24hr?${params}`, { signal: controller.signal })
        if (!response.ok) throw new Error('Market data unavailable')
        setTickers(await response.json() as MiniTicker[])
      } catch {
        if (!controller.signal.aborted) setStreamStatus('SIN DATOS')
      }
    }
    void refresh()
    const timer = window.setInterval(() => void refresh(), 30_000)
    return () => { controller.abort(); window.clearInterval(timer) }
  }, [])

  return <div className="hero-market-card">
    <div className="market-card-top"><div><span className="market-card-kicker"><CandlestickChart size={13} /> MERCADO DESTACADO</span><strong>BTC <small>/ USDT</small></strong></div><span className={`market-card-status ${streamStatus === 'EN VIVO' ? 'status-live' : ''}`}><i />{streamStatus}</span></div>
    <MarketLineChart onLive={() => setStreamStatus('EN VIVO')} onError={() => setStreamStatus('SONDEO')} />
    <div className="market-card-bottom"><div><span>BITCOIN</span><strong>{tickers.find((ticker) => ticker.symbol === 'BTCUSDT') ? `$${Number(tickers.find((ticker) => ticker.symbol === 'BTCUSDT')?.lastPrice).toLocaleString('en-US', { maximumFractionDigits: 2 })}` : '—'}</strong></div><span className="market-card-live"><i /> REST + STREAM</span></div>
  </div>
}

function MarketTickers() {
  const [tickers, setTickers] = useState<MiniTicker[]>([])
  const marketNames = [
    { symbol: 'BTCUSDT', mark: '₿', name: 'BTC / USDT' },
    { symbol: 'ETHUSDT', mark: 'Ξ', name: 'ETH / USDT' },
    { symbol: 'SOLUSDT', mark: '◎', name: 'SOL / USDT' },
    { symbol: 'DOGEUSDT', mark: 'Ð', name: 'DOGE / USDT' },
  ]

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams({ symbols: JSON.stringify(MARKET_SYMBOLS) })
    const refresh = async () => {
      try {
        const response = await fetch(`${API_BASE}/ticker/24hr?${params}`, { signal: controller.signal })
        if (!response.ok) return
        setTickers(await response.json() as MiniTicker[])
      } catch { /* Keep the preview quiet when public market data is unavailable. */ }
    }
    void refresh()
    const timer = window.setInterval(() => void refresh(), 30_000)
    return () => { controller.abort(); window.clearInterval(timer) }
  }, [])

  return <div className="ticker-data">{marketNames.map((market) => {
    const ticker = tickers.find((item) => item.symbol === market.symbol)
    const change = Number(ticker?.priceChangePercent ?? 0)
    return <div className="ticker-item" key={market.symbol}><span className="ticker-coin">{market.mark}</span><span className="ticker-name"><strong>{market.name}</strong><small>{ticker ? `$${Number(ticker.lastPrice).toLocaleString('en-US', { maximumFractionDigits: Number(ticker.lastPrice) < 1 ? 5 : 2 })}` : 'Cargando'}</small></span><span className={`ticker-change ${change < 0 ? 'negative' : ''}`}>{ticker ? `${change >= 0 ? '+' : ''}${change.toFixed(2)}%` : '—'}</span></div>
  })}</div>
}

function MarketLineChart({ onLive, onError }: { onLive: () => void; onError: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const callbackRef = useRef({ onLive, onError })
  useEffect(() => { callbackRef.current = { onLive, onError } }, [onLive, onError])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let chart: IChartApi | undefined
    let socket: WebSocket | undefined
    let timer: number | undefined
    let disposed = false
    const controller = new AbortController()

    chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      layout: { background: { type: ColorType.Solid, color: '#142137' }, textColor: '#91a4bf', fontFamily: 'Inter Variable, sans-serif', fontSize: 10 },
      grid: { vertLines: { color: '#ffffff08' }, horzLines: { color: '#ffffff08' } },
      rightPriceScale: { visible: false },
      timeScale: { visible: false, borderVisible: false, rightOffset: 4 },
      crosshair: { vertLine: { visible: false, labelVisible: false }, horzLine: { visible: false, labelVisible: false } },
      handleScroll: false,
      handleScale: false,
    })
    const line = chart.addSeries(LineSeries, { color: '#6eafff', lineWidth: 2, priceLineVisible: false, lastValueVisible: true, crosshairMarkerVisible: false })
    const resizeObserver = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width
      if (width && chart) chart.applyOptions({ width })
    })
    resizeObserver.observe(container)

    const getLatest = async () => {
      try {
        const response = await fetch(`${API_BASE}/klines?symbol=BTCUSDT&interval=1m&limit=2`, { signal: controller.signal })
        if (!response.ok) throw new Error('Price stream unavailable')
        const rows = await response.json() as KlineRow[]
        const row = rows[rows.length - 1]
        if (!disposed && row) line.update({ time: Math.floor(row[0] / 1000) as UTCTimestamp, value: Number(row[4]) })
      } catch {
        if (!disposed) callbackRef.current.onError()
      }
    }

    fetch(`${API_BASE}/klines?symbol=BTCUSDT&interval=1h&limit=72`, { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error('Chart unavailable'); return response.json() as Promise<KlineRow[]> })
      .then((rows) => {
        if (disposed) return
        line.setData(rows.map((row) => ({ time: Math.floor(row[0] / 1000) as UTCTimestamp, value: Number(row[4]) })))
        chart?.timeScale().fitContent()
        try {
          socket = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@kline_1m')
          socket.onopen = () => callbackRef.current.onLive()
          socket.onmessage = (event) => {
            const payload = JSON.parse(event.data) as { k?: { t: number; c: string } }
            if (!disposed && payload.k) line.update({ time: Math.floor(payload.k.t / 1000) as UTCTimestamp, value: Number(payload.k.c) })
          }
          socket.onerror = () => socket?.close()
          socket.onclose = () => {
            if (disposed) return
            callbackRef.current.onError()
            timer = window.setInterval(() => void getLatest(), 15_000)
            void getLatest()
          }
        } catch { callbackRef.current.onError(); timer = window.setInterval(() => void getLatest(), 15_000) }
      })
      .catch(() => { if (!disposed) callbackRef.current.onError() })

    return () => {
      disposed = true
      controller.abort()
      resizeObserver.disconnect()
      if (timer) window.clearInterval(timer)
      socket?.close()
      chart?.remove()
    }
  }, [])

  return <div ref={containerRef} className="hero-market-chart" aria-label="Gráfico real de Bitcoin frente a USDT" />
}