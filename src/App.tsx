import { lazy, Suspense, useEffect, useRef, useState, type FormEvent } from 'react'
import HomePage from './HomePage'
import EarnPlayground from './EarnPlayground'
import { supabase } from './lib/supabase'
import { applyPendingReferral } from './lib/referral'
import { CLAIM_EVENT, useAccountPrefs } from './lib/accountPrefs'
import { useFaucetReminder } from './lib/faucetReminder'
import AccountProfile from './components/AccountProfile'
import AccountAccess from './components/AccountAccess'
import AccountSettings from './components/AccountSettings'
import type { Session } from '@supabase/supabase-js'
import {
  Activity, ArrowDownLeft, ArrowLeftRight, ArrowRight, ArrowUpRight, Bell, Blocks, CandlestickChart, Check,
  ChevronDown, Clock3, Code2, Coins, Eye, EyeOff, Flame, Gamepad2, Gift, Grid2X2,
  HandCoins, History, Link2, Megaphone, Menu, MousePointerClick, Plus, Search,
  Settings, ShieldCheck, Sparkles, Ticket, TrendingUp, Trophy, UserRound, Users, WalletCards,
  X,
} from 'lucide-react'
import './App.css'

type NavItem = { label: string; icon: typeof Grid2X2 }
const PortfolioChart = lazy(() => import('./PortfolioChart'))
const MarketExplorer = lazy(() => import('./MarketExplorer'))

const dashboardNav: { group: string; items: NavItem[] }[] = [
  { group: 'GENERAL', items: [{ label: 'Resumen', icon: Grid2X2 }, { label: 'Mercados', icon: CandlestickChart }] },
  { group: 'WALLET', items: [
    { label: 'Cartera', icon: WalletCards }, { label: 'Depositar', icon: ArrowDownLeft },
    { label: 'Retirar', icon: ArrowUpRight }, { label: 'Transferir', icon: ArrowRight },
    { label: 'Exchange', icon: ArrowLeftRight }, { label: 'Historial', icon: History },
    { label: 'Direcciones', icon: Link2 },
  ] },
  { group: 'GANAR', items: [
    { label: 'Faucets', icon: Coins }, { label: 'Offerwalls', icon: HandCoins },
    { label: 'Shortlinks', icon: Link2 }, { label: 'PTC', icon: MousePointerClick },
  ] },
  { group: 'JUEGOS', items: [{ label: 'Juegos', icon: Gamepad2 }, { label: 'Lotería', icon: Ticket }] },
  { group: 'CRECER', items: [
    { label: 'Staking', icon: Flame }, { label: 'Afiliados', icon: Users },
    { label: 'Anunciar', icon: Megaphone }, { label: 'Campañas', icon: Activity },
    { label: 'Listings patrocinados', icon: Sparkles },
  ] },
  { group: 'SOCIAL', items: [{ label: 'Temporada', icon: Trophy }, { label: 'Gremio', icon: Blocks }] },
  { group: 'DESARROLLADORES', items: [{ label: 'API', icon: Code2 }] },
  { group: 'CUENTA', items: [
    { label: 'Perfil', icon: UserRound }, { label: 'Seguridad', icon: ShieldCheck },
    { label: 'Ajustes', icon: Settings },
  ] },
]
const chartSets = {
  '1D': [{ time: '00:00', value: 3200 }, { time: '04:00', value: 3460 }, { time: '08:00', value: 3370 }, { time: '12:00', value: 3720 }, { time: '16:00', value: 3590 }, { time: '20:00', value: 3940 }, { time: 'Ahora', value: 4182 }],
  '1S': [{ time: 'Lun', value: 2870 }, { time: 'Mar', value: 3140 }, { time: 'Mié', value: 3020 }, { time: 'Jue', value: 3490 }, { time: 'Vie', value: 3340 }, { time: 'Sáb', value: 3810 }, { time: 'Dom', value: 4182 }],
  '1M': [{ time: '01', value: 2460 }, { time: '05', value: 2980 }, { time: '10', value: 2710 }, { time: '15', value: 3420 }, { time: '20', value: 3260 }, { time: '25', value: 3890 }, { time: '30', value: 4182 }],
  '1A': [{ time: 'Ene', value: 1900 }, { time: 'Feb', value: 2250 }, { time: 'Mar', value: 2140 }, { time: 'Abr', value: 2740 }, { time: 'May', value: 2980 }, { time: 'Jun', value: 3670 }, { time: 'Jul', value: 4182 }],
}
const assets = [
  { ticker: 'BTC', name: 'Bitcoin', amount: '0.02481', value: '$1,642.80', price: '$66,219.04', change: '+2.41%', icon: '₿', color: 'bitcoin' },
  { ticker: 'ETH', name: 'Ethereum', amount: '0.4820', value: '$1,384.26', price: '$2,872.12', change: '+1.82%', icon: 'Ξ', color: 'ethereum' },
  { ticker: 'USDT', name: 'Tether', amount: '842.50', value: '$842.50', price: '$1.00', change: '0.01%', icon: '₮', color: 'tether' },
  { ticker: 'SOL', name: 'Solana', amount: '2.184', value: '$312.64', price: '$143.15', change: '+5.68%', icon: '◎', color: 'solana' },
]
const sectionCopy: Record<string, { eyebrow: string; title: string; description: string }> = {
  Cartera: { eyebrow: 'WALLET', title: 'Tu cartera.', description: 'Consulta por separado tus puntos promocionales reales y los balances cripto que todavía son solo una demo.' },
  Depositar: { eyebrow: 'PAGO POR QR', title: 'Depositar por QR.', description: 'Preparamos depósitos con QR para enviar fondos sin conectar una wallet.' },
  Retirar: { eyebrow: 'WALLET · SALIDA', title: 'Retirar fondos.', description: 'Envía activos a una dirección externa con una revisión clara de red y comisión.' },
  Transferir: { eyebrow: 'WALLET · INTERNO', title: 'Transferir a un usuario.', description: 'Envía saldo a otra cuenta FaucetPay mediante transferencia interna.' },
  Exchange: { eyebrow: 'CONVERSIÓN', title: 'Exchange de criptomonedas.', description: 'Consulta los pares disponibles, el tipo de cambio y el coste antes de convertir.' },
  Historial: { eyebrow: 'ACTIVIDAD', title: 'Historial de recompensas.', description: 'Consulta acreditaciones de puntos registradas en el servidor. Los movimientos cripto todavía no están conectados.' },
  Direcciones: { eyebrow: 'WALLET · DIRECCIONES', title: 'Direcciones de depósito.', description: 'Gestiona las direcciones asociadas a tus activos y redes.' },
  Faucets: { eyebrow: 'GANAR · FAUCETS', title: 'Tu recompensa diaria.', description: 'Reclama puntos internos cada 24 horas. No son criptomonedas ni tienen valor monetario.' },
  Offerwalls: { eyebrow: 'GANAR · OFFERWALLS', title: 'Ofertas y encuestas.', description: 'Explora tareas de proveedores, requisitos y recompensas estimadas.' },
  Shortlinks: { eyebrow: 'GANAR · SHORTLINKS', title: 'Shortlinks disponibles.', description: 'Completa enlaces patrocinados y revisa el estado de tus recompensas.' },
  PTC: { eyebrow: 'GANAR · PUBLICIDAD', title: 'Paid-to-click.', description: 'Ve anuncios patrocinados y consulta la recompensa indicada por visita.' },
  Juegos: { eyebrow: 'JUEGOS · PROVABLY FAIR', title: 'Juegos originales.', description: 'Explora Dice, Crash, Plinko, Mines, Ruleta y más juegos verificables.' },
  Lotería: { eyebrow: 'JUEGOS · SORTEOS', title: 'Loterías y sorteos.', description: 'Consulta sorteos activos, entradas y resultados publicados.' },
  Staking: { eyebrow: 'FEY · STAKING', title: 'Staking y ventajas.', description: 'Consulta posiciones, periodos y beneficios disponibles para FEY.' },
  Afiliados: { eyebrow: 'AFILIADOS', title: 'Invita y gana.', description: 'Comparte tu enlace. Recibes puntos internos cuando una persona invitada verifica su correo y completa su perfil.' },
  Anunciar: { eyebrow: 'PUBLICIDAD', title: 'Llega a usuarios cripto.', description: 'Crea campañas PTC, listings patrocinados y anuncios para la red.' },
  Campañas: { eyebrow: 'PUBLICIDAD · CAMPAÑAS', title: 'Gestiona tus campañas.', description: 'Consulta presupuesto, impresiones, clics y estado de tus anuncios.' },
  'Listings patrocinados': { eyebrow: 'PUBLICIDAD · DIRECTORIO', title: 'Promociona tu faucet.', description: 'Destaca un sitio en el directorio y consulta el alcance de la publicación.' },
  API: { eyebrow: 'DESARROLLADORES', title: 'API y pagos para sitios.', description: 'Integra pagos, callbacks y verificación desde tus aplicaciones.' },
  Perfil: { eyebrow: 'CUENTA', title: 'Tu perfil.', description: 'Edita tu nombre, país, bio y color de avatar.' },
  Seguridad: { eyebrow: 'CUENTA · SEGURIDAD', title: 'Protege tu cuenta.', description: 'Gestiona 2FA, códigos de recuperación, correo y contraseña.' },
  Ajustes: { eyebrow: 'CUENTA · PREFERENCIAS', title: 'Ajustes de cuenta.', description: 'Notificaciones, privacidad en pantalla, reglas anti-abuso y eliminación de cuenta.' },
  Mercados: { eyebrow: 'MERCADOS SPOT', title: 'Mercados cripto', description: 'Precios y velas de mercado en vivo desde Binance Spot.' },
  Earn: { eyebrow: 'CENTRO DE RECOMPENSAS', title: 'Gana a tu ritmo.', description: 'Tareas internas verificables y actividades de proveedores, claramente diferenciadas.' },
  Swap: { eyebrow: 'CONVERSIÓN', title: 'Un activo. Otro activo.', description: 'Consulta una cotización de demostración. Las operaciones reales todavía no están habilitadas.' },
  Arcade: { eyebrow: 'JUEGO RESPONSABLE', title: 'Juega por diversión.', description: 'Esta vista previa no acepta apuestas ni distribuye premios. Los juegos con valor real requieren disponibilidad legal.' },
  Anuncios: { eyebrow: 'AD NETWORK', title: 'Tu audiencia, con intención.', description: 'Explora formatos y una estimación de campaña en modo demo.' },
  Temporada: { eyebrow: 'TEMPORADA MENSUAL', title: 'Sube de nivel.', description: 'Tu nivel se calcula con los puntos internos reales de tu historial. Sin valor monetario.' },
  Gremio: { eyebrow: 'SOCIAL FI', title: 'Mejor en equipo.', description: 'Únete a un gremio de demostración y mira el progreso colectivo.' },
  Desarrolladores: { eyebrow: 'FAUCET PROTOCOL', title: 'Integra pagos sin fricción.', description: 'El portal de desarrolladores está en vista previa. Las claves y endpoints aún no están conectados.' },
}

export function DashboardPrototype() {
  const [activePage, setActivePage] = useState(() => {
    const requestedPage = new URLSearchParams(window.location.search).get('section')
    const availablePages = dashboardNav.flatMap((group) => group.items.map((item) => item.label))
    return requestedPage && (availablePages.includes(requestedPage) || requestedPage === 'Earn') ? requestedPage : 'Resumen'
  })
  const [period, setPeriod] = useState<keyof typeof chartSets>('1S')
  const [balanceVisible, setBalanceVisible] = useState(true)
  const [selectedAsset, setSelectedAsset] = useState<(typeof assets)[number] | null>(null)
  const [modal, setModal] = useState('')
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notificationsRead, setNotificationsRead] = useState(false)
  const [toast, setToast] = useState('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [earnFilter, setEarnFilter] = useState('Para ti')
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [accountEmail, setAccountEmail] = useState('Cuenta')
  const [accountName, setAccountName] = useState('')
  const { prefs } = useAccountPrefs()
  const [balancePrefApplied, setBalancePrefApplied] = useState(false)
  useFaucetReminder(prefs.notifyFaucetReady)
  useEffect(() => {
    if (balancePrefApplied || !prefs.hideBalance) return
    void Promise.resolve().then(() => { setBalanceVisible(false); setBalancePrefApplied(true) })
  }, [prefs.hideBalance, balancePrefApplied])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchInputRef.current?.focus()
        setSearchOpen(true)
      }
      if (event.key === 'Escape') setSearchOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (!supabase) return
    let active = true
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      const user = data.session?.user
      setAccountEmail(user?.email ?? 'Cuenta')
      const displayName = user?.user_metadata?.display_name
      setAccountName(typeof displayName === 'string' && displayName.trim() ? displayName.trim() : user?.email?.split('@')[0] ?? '')
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return
      const user = session?.user
      setAccountEmail(user?.email ?? 'Cuenta')
      const displayName = user?.user_metadata?.display_name
      setAccountName(typeof displayName === 'string' && displayName.trim() ? displayName.trim() : user?.email?.split('@')[0] ?? '')
    })
    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const notify = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2800)
  }
  const selectPage = (label: string) => { setActivePage(label); setMobileMenuOpen(false) }
  const openAction = (action: string) => {
    if (action === 'Depositar') {
      setActivePage('Depositar')
      setModal('')
      return
    }
    setModal(action)
  }
  const signOut = async () => {
    if (!supabase) return notify('Supabase no está configurado.')
    const { error } = await supabase.auth.signOut()
    if (error) return notify('No se pudo cerrar la sesión.')
    window.location.replace('/?login=1')
  }
  const fundsActionSteps = modal === 'Depositar'
    ? ['Seleccionar activo y red compatibles.', 'Generar una dirección única asociada a tu cuenta.', 'Acreditar el depósito tras las confirmaciones de red.']
    : ['Comprobar saldo disponible y red del activo.', 'Validar dirección de destino y comisión.', 'Revisar y confirmar desde un servicio seguro.']
  const isFundsAction = modal === 'Depositar' || modal === 'Retirar'
  const isOverview = activePage === 'Resumen'
  const searchResults = search.trim() ? [
    ...dashboardNav.flatMap((group) => group.items.map(({ label }) => ({ label, detail: 'Sección', page: label, query: '' }))),
    { label: 'Earn', detail: 'Tareas y recompensas internas', page: 'Earn', query: '' },
    ...['Faucets', 'Offerwalls', 'Shortlinks', 'PTC'].map((label) => ({ label, detail: label === 'Faucets' ? 'Puntos internos activos' : 'Proveedor pendiente', page: label, query: '' })),
  ].filter((result) => `${result.label} ${result.detail}`.toLowerCase().includes(search.trim().toLowerCase())).slice(0, 6) : []
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenuOpen ? 'sidebar-open' : ''}`}>
        <a className="brand" href="#inicio" onClick={() => selectPage('Resumen')} aria-label="Faucet, inicio">
          <span className="brand-mark"><span /></span><span className="brand-word">faucet<span className="brand-period">.</span></span><span className="brand-beta">BETA</span>
        </a>
        <button className="workspace-switch" aria-label="Abrir perfil de cuenta" onClick={() => selectPage('Perfil')}>
          <span className="workspace-avatar" style={prefs.avatarColor ? { background: prefs.avatarColor, color: '#0b1220' } : undefined}>{accountEmail.slice(0, 1).toUpperCase()}</span><span className="workspace-copy"><strong>Mi espacio</strong><small>Cuenta personal</small></span><ChevronDown size={15} />
        </button>
        <nav className="side-nav" aria-label="Navegación del dashboard">
          {dashboardNav.map((group) => <div className="nav-group" key={group.group}>
            <span className="nav-caption">{group.group}</span>
            {group.items.map(({ label, icon: Icon }) => <button key={label} className={`nav-link ${activePage === label ? 'nav-link-active' : ''}`} onClick={() => selectPage(label)}><Icon size={16} strokeWidth={1.8} /><span>{label}</span></button>)}
          </div>)}
        </nav>
        <div className="sidebar-bottom">
          <div className="safety-card"><div className="safety-icon"><ShieldCheck size={16} /></div><div><strong>Acceso protegido</strong><small>{supabase ? 'Sesión Supabase' : 'Vista local'}</small></div><span className="status-dot" /></div>
          <button className="profile-row" onClick={() => void signOut()}><span className="profile-avatar" style={prefs.avatarColor ? { background: prefs.avatarColor, color: '#0b1220' } : undefined}>{accountEmail.slice(0, 2).toUpperCase()}</span><span className="profile-copy"><strong>{accountEmail}</strong><small>{supabase ? 'Cerrar sesión' : 'Cuenta demo'}</small></span><ChevronDown size={15} /></button>
        </div>
      </aside>

      {mobileMenuOpen && <button className="mobile-backdrop" aria-label="Cerrar menú" onClick={() => setMobileMenuOpen(false)} />}
      <main className="main-area">
        <header className="topbar">
          <button className="icon-button mobile-menu-trigger" aria-label="Abrir menú" onClick={() => setMobileMenuOpen(true)}><Menu size={19} /></button>
          <div className="breadcrumb"><span>Workspace</span><span className="crumb-slash">/</span><strong>{activePage}</strong></div>
          <div className="topbar-actions">
            <div className="search-wrap"><label className="search-field"><Search size={16} /><input ref={searchInputRef} aria-label="Buscar secciones y actividades" aria-expanded={searchOpen} aria-controls="dashboard-search-results" placeholder="Buscar..." value={search} onFocus={() => setSearchOpen(true)} onChange={(event) => { setSearch(event.target.value); setSearchOpen(true) }} onKeyDown={(event) => { if (event.key === 'ArrowDown') { event.preventDefault(); document.querySelector<HTMLButtonElement>('[data-search-result]')?.focus() } }} /><kbd>⌘ K</kbd></label>{searchOpen && search.trim() && <div className="search-results" id="dashboard-search-results" role="listbox" aria-label="Resultados de búsqueda">{searchResults.length ? searchResults.map((result) => <button data-search-result role="option" aria-selected="false" key={`${result.page}-${result.label}`} onClick={() => { selectPage(result.page); setSearch(result.query); setSearchOpen(false); searchInputRef.current?.blur() }}><span><strong>{result.label}</strong><small>{result.detail}</small></span><ArrowRight size={14} /></button>) : <p>No hay secciones u ofertas coincidentes.</p>}</div>}</div>
            <div className="notification-wrap">
              <button className="icon-button notification-button" aria-label="Centro de actividad" aria-expanded={notificationsOpen} onClick={() => { setNotificationsOpen((open) => !open); setNotificationsRead(true) }}><Bell size={17} />{!notificationsRead && <i />}</button>
              {notificationsOpen && <section className="notification-panel" aria-label="Centro de actividad"><div className="notification-panel-heading"><div><span className="section-kicker">CUENTA</span><strong>Centro de actividad</strong></div><button aria-label="Cerrar centro de actividad" onClick={() => setNotificationsOpen(false)}><X size={15} /></button></div><div className="notification-item"><span className="notification-state" /><div><strong>Depósitos por QR en preparación</strong><small>Estamos preparando depósitos con una dirección única por cuenta. No envíes fondos todavía.</small><button onClick={() => { setNotificationsOpen(false); selectPage('Depositar') }}>Ver estado <ArrowRight size={13} /></button></div></div><div className="notification-item"><span className="notification-state notification-state-info" /><div><strong>Proveedores Earn pendientes</strong><small>El faucet y la tarea de perfil acreditan puntos internos. Las ofertas externas todavía son demostraciones sin pagos.</small><button onClick={() => { setNotificationsOpen(false); selectPage('Earn') }}>Ver tareas <ArrowRight size={13} /></button></div></div><div className="notification-panel-footer">Estado de integraciones, no notificaciones de transacciones.</div></section>}
            </div>
            <button className="connect-button" onClick={() => { setNotificationsOpen(false); selectPage('Depositar') }} aria-label="Depositar por QR"><span className="connect-indicator" />Depositar por QR</button>
          </div>
        </header>
        <div className="page-content" key={activePage}>
          {isOverview ? <>
            <section className="welcome-row"><div><div className="eyebrow"><span className="live-dot" /> TU CENTRO FINANCIERO <span className="demo-tag">DEMO</span></div><h1>Buenos días, {accountName ? `${accountName[0].toUpperCase()}${accountName.slice(1)}` : 'bienvenido'} <span className="wave">✳</span></h1><p className="welcome-subtitle">Tu actividad cripto, en un solo lugar.</p></div><label className="date-select"><Clock3 size={15} /><select aria-label="Periodo del portafolio" value={period} onChange={(event) => setPeriod(event.target.value as keyof typeof chartSets)}><option value="1D">Hoy</option><option value="1S">Últimos 7 días</option><option value="1M">Últimos 30 días</option><option value="1A">Último año</option></select><ChevronDown size={14} /></label></section>

            <section className="hero-grid">
              <div className="balance-panel">
                <div className="balance-topline"><span>VALOR TOTAL DEL PORTAFOLIO</span><button className="subtle-icon" aria-label={balanceVisible ? 'Ocultar saldo' : 'Mostrar saldo'} onClick={() => setBalanceVisible(!balanceVisible)}>{balanceVisible ? <Eye size={16} /> : <EyeOff size={16} />}</button></div>
                <div className="balance-line"><strong>{balanceVisible ? '$4,182.20' : '••••••••'}</strong><span className="balance-currency">USD</span></div>
                <div className="balance-change"><span><TrendingUp size={14} /> +$284.65</span><span>+7.3% esta semana</span><span className="change-divider" /><span className="balance-note">estimación · demo</span></div>
                <div className="balance-chart" aria-label="Gráfico ilustrativo del valor del portafolio"><Suspense fallback={<div className="chart-loading" aria-hidden="true" />}><PortfolioChart data={chartSets[period]} /></Suspense></div>
                <div className="chart-periods" role="group" aria-label="Periodo del gráfico">{(Object.keys(chartSets) as Array<keyof typeof chartSets>).map((item) => <button key={item} className={period === item ? 'period-active' : ''} onClick={() => setPeriod(item)}>{item}</button>)}</div>
                <div className="balance-actions"><button className="action-primary" onClick={() => openAction('Depositar')}><ArrowDownLeft size={16} />Depositar</button><button className="action-secondary" onClick={() => openAction('Retirar')}><ArrowUpRight size={16} />Retirar</button><button className="action-secondary" onClick={() => selectPage('Swap')}><ArrowLeftRight size={16} />Swap</button><button className="action-more" aria-label="Más opciones" onClick={() => openAction('Más opciones')}><Plus size={18} /></button></div>
              </div>
              <EarnSummary onNavigate={selectPage} hidden={!balanceVisible} />
            </section>

            <section className="portfolio-section"><div className="section-header"><div><span className="section-kicker">TUS ACTIVOS · DEMO</span><h2>Portafolio</h2></div><button className="view-all" onClick={() => selectPage('Cartera')}>Ver activos <ArrowRight size={14} /></button></div><AssetPortfolio balanceVisible={balanceVisible} onSelect={setSelectedAsset} /></section>

            <section className="bottom-grid">
              <ActivityPanel />
              <SeasonCard onOpen={() => selectPage('Temporada')} />
            </section>

            <section className="clan-strip"><div className="clan-symbol"><Blocks size={19} /></div><div className="clan-copy"><span className="section-kicker">GREMIO · EJEMPLO DEMO</span><strong>Night Owls <span>· #14 global</span></strong></div><div className="clan-members"><span className="mini-avatar mini-a">J</span><span className="mini-avatar mini-b">K</span><span className="mini-avatar mini-c">S</span><span className="mini-avatar mini-more">+8</span></div><div className="clan-stat"><span>XP del gremio</span><strong>24,680 <small>/ 30,000</small></strong></div><button className="clan-open" aria-label="Abrir gremio" onClick={() => selectPage('Gremio')}><ArrowRight size={16} /></button></section>
            <footer className="page-footer"><span>© {CURRENT_YEAR} Faucet Protocol <i className="footer-dot" /> Vista previa del producto</span><span><button onClick={() => notify('Centro de ayuda demo')}>Ayuda</button><button onClick={() => notify('Estado: entorno de demostración')}>Estado del sistema <i className="status-dot" /></button></span></footer>
          </> : activePage === 'Mercados' ? <Suspense fallback={<div className="market-loading-page"><span className="live-dot" />Conectando con Binance Spot...</div>}><MarketExplorer search={search} /></Suspense> : <SectionView key={activePage} page={activePage} onAction={openAction} onNavigate={selectPage} onAssetSelect={setSelectedAsset} earnFilter={earnFilter} setEarnFilter={setEarnFilter} />}
        </div>
      </main>
      <nav className="mobile-nav" aria-label="Navegación móvil">{['Resumen', 'Cartera', 'Faucets', 'Juegos'].map((label) => { const Icon = dashboardNav.flatMap((group) => group.items).find((item) => item.label === label)?.icon ?? Grid2X2; return <button key={label} className={activePage === label ? 'mobile-nav-active' : ''} onClick={() => selectPage(label)}><Icon size={19} /><span>{label}</span></button> })}</nav>
      {selectedAsset && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedAsset(null) }}><section className="demo-modal asset-dialog" role="dialog" aria-modal="true" aria-labelledby="asset-dialog-title"><button className="modal-close" aria-label="Cerrar detalle de activo" onClick={() => setSelectedAsset(null)}><X size={18} /></button><span className={`coin-icon ${selectedAsset.color} asset-dialog-icon`}>{selectedAsset.icon}</span><span className="section-kicker">DETALLE DEL ACTIVO · DEMO</span><h2 id="asset-dialog-title">{selectedAsset.name}</h2><p>Datos de ejemplo. No representan saldos ni precios de una cuenta conectada.</p><div className="asset-detail-list"><div><span>Precio de referencia</span><strong>{selectedAsset.price}</strong></div><div><span>Balance de muestra</span><strong>{selectedAsset.amount} {selectedAsset.ticker}</strong></div><div><span>Valor estimado</span><strong>{selectedAsset.value}</strong></div><div><span>Variación ilustrativa 24 h</span><strong className={selectedAsset.change.startsWith('+') ? 'positive' : ''}>{selectedAsset.change}</strong></div></div><button className="modal-primary" onClick={() => { setSelectedAsset(null); selectPage('Depositar') }}>Ver opciones de depósito <ArrowRight size={15} /></button></section></div>}
      {modal && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal('') }}><section className="demo-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button className="modal-close" aria-label="Cerrar" onClick={() => setModal('')}><X size={18} /></button><span className="modal-mark"><ShieldCheck size={20} /></span><span className="section-kicker">{isFundsAction ? `${modal.toUpperCase()} · REQUISITOS` : 'ENTORNO DE DEMOSTRACIÓN'}</span><h2 id="modal-title">{modal}</h2><p>{modal === 'Depositar' ? 'Todavía no se generan direcciones de depósito: falta conectar un proveedor de custodia o infraestructura de wallets.' : modal === 'Retirar' ? 'Los retiros están deshabilitados hasta integrar saldos reales, verificación de seguridad y un servicio de transacciones.' : 'Esta acción todavía no está conectada a una wallet ni a servicios financieros. No se realizará ninguna transacción.'}</p>{isFundsAction && <ol className="action-checklist">{fundsActionSteps.map((step) => <li key={step}><span>{step}</span></li>)}</ol>}<div className="modal-note"><span className="status-dot" />{isFundsAction ? 'No se crearán direcciones ni se moverán fondos en esta vista.' : 'Tus fondos no están en riesgo en esta vista previa.'}</div><button className="modal-primary" onClick={() => setModal('')}>Cerrar <Check size={16} /></button></section></div>}
      <div className={`toast ${toast ? 'toast-visible' : ''}`} role="status" aria-live="polite"><Check size={15} />{toast}</div>
    </div>
  )
}

const CURRENT_YEAR = new Date().getFullYear()
const XP_PER_LEVEL = 100

type SeasonStats = { xp: number; level: number; intoLevel: number; bySource: Record<string, { count: number; days: number }>; daysLeft: number; seasonLabel: string }

function useSeasonStats() {
  const [rows, setRows] = useState<{ created_at: string; source_type: string; points: number }[] | null>(null)
  const [errorMessage, setErrorMessage] = useState(() => supabase ? '' : 'Configura Supabase e inicia sesión para ver tu progreso.')

  useEffect(() => {
    if (!supabase) return
    let active = true
    void supabase.from('reward_ledger').select('created_at, source_type, points').order('created_at', { ascending: false }).limit(1000).then(({ data, error }) => {
      if (!active) return
      if (error) setErrorMessage('No se pudo cargar tu progreso.')
      else setRows(data ?? [])
    })
    return () => { active = false }
  }, [])

  const [now] = useState(() => new Date())
  const stats: SeasonStats | null = rows && (() => {
    const xp = rows.reduce((sum, row) => sum + row.points, 0)
    const bySource: SeasonStats['bySource'] = {}
    const daySets: Record<string, Set<string>> = {}
    for (const row of rows) {
      bySource[row.source_type] ??= { count: 0, days: 0 }
      bySource[row.source_type].count += 1
      ;(daySets[row.source_type] ??= new Set()).add(new Date(row.created_at).toDateString())
    }
    for (const key of Object.keys(daySets)) bySource[key].days = daySets[key].size
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    return {
      xp,
      level: Math.floor(xp / XP_PER_LEVEL) + 1,
      intoLevel: xp % XP_PER_LEVEL,
      bySource,
      daysLeft: Math.max(1, Math.ceil((monthEnd.getTime() - now.getTime()) / DAY_MS)),
      seasonLabel: new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(now),
    }
  })()
  return { stats, errorMessage, loading: !rows && !errorMessage }
}

function SeasonCard({ onOpen }: { onOpen: () => void }) {
  const { stats, errorMessage, loading } = useSeasonStats()
  const percent = stats ? (stats.intoLevel / XP_PER_LEVEL) * 100 : 0
  return <div className="season-panel"><div className="season-top"><span className="season-icon"><Trophy size={17} /></span><span className="season-live"><i /> {stats ? stats.seasonLabel.toUpperCase() : 'TEMPORADA'}</span><button className="subtle-icon" aria-label="Más sobre temporada" onClick={onOpen}><ArrowUpRight size={15} /></button></div><div className="season-title"><div><span className="section-kicker">XP DE PUNTOS</span><h2>Ruta del explorador</h2></div><span className="season-level">{stats ? `LVL ${String(stats.level).padStart(2, '0')}` : 'LVL —'}</span></div><div className="season-progress"><span style={{ width: `${percent}%` }} /></div><div className="season-progress-copy"><span>{stats ? `${stats.intoLevel} / ${XP_PER_LEVEL} XP` : errorMessage || (loading ? 'Cargando…' : '—')}</span><span>{stats ? <>Faltan <strong>{XP_PER_LEVEL - stats.intoLevel} XP</strong></> : ''}</span></div><button className="season-button" onClick={onOpen}>Ver misiones <ArrowRight size={15} /></button></div>
}

const SEASON_MISSIONS = [
  { key: 'daily_faucet', title: 'Reclama el faucet diario', goal: 7, unit: 'días', icon: Gift, hint: 'Reclama en 7 días distintos' },
  { key: 'earn_task', title: 'Completa tu perfil', goal: 1, unit: 'tarea', icon: ShieldCheck, hint: 'Tarea de recompensa única' },
  { key: 'referral', title: 'Invita a un amigo verificado', goal: 1, unit: 'referido', icon: Users, hint: 'Cuando complete su perfil' },
  { key: 'offerwall', title: 'Completa una oferta de proveedor', goal: 1, unit: 'oferta', icon: MousePointerClick, hint: 'Requiere un proveedor conectado' },
] as const

function SeasonPanel() {
  const { stats, errorMessage, loading } = useSeasonStats()
  const percent = stats ? (stats.intoLevel / XP_PER_LEVEL) * 100 : 0
  return <>
    <div className="season-large"><div className="season-large-head"><span className="season-icon"><Trophy size={19} /></span><span className="season-live"><i /> EN CURSO</span><strong>{stats ? `${stats.daysLeft} días restantes` : '—'}</strong></div><h2>Ruta del explorador</h2><p>Tu XP es la suma de puntos promocionales internos que has recibido (1 punto = 1 XP, {XP_PER_LEVEL} XP por nivel). No tiene valor monetario.</p><div className="season-progress"><span style={{ width: `${percent}%` }} /></div><div className="season-progress-copy"><span>{stats ? `Nivel ${String(stats.level).padStart(2, '0')} · ${stats.intoLevel} / ${XP_PER_LEVEL} XP · ${stats.xp.toLocaleString('es-ES')} XP totales` : errorMessage || (loading ? 'Cargando…' : '—')}</span><span>{stats ? <>Siguiente nivel: <strong>{XP_PER_LEVEL - stats.intoLevel} XP</strong></> : ''}</span></div></div>
    {SEASON_MISSIONS.map((mission) => {
      const source = stats?.bySource[mission.key]
      const progress = Math.min(mission.goal, mission.key === 'daily_faucet' ? source?.days ?? 0 : source?.count ?? 0)
      const done = progress >= mission.goal
      const Icon = mission.icon
      return <div className={`mission-row${done ? ' mission-done' : ''}`} key={mission.key}><span className="mission-icon"><Icon size={17} /></span><div><strong>{mission.title}</strong><small>{mission.hint} · {stats ? `${progress} / ${mission.goal} ${mission.unit}` : '—'}</small></div><span className="mission-reward">{!stats ? '—' : done ? 'Completada' : 'En curso'}</span>{done ? <Check size={15} /> : <ArrowRight size={15} />}</div>
    })}
  </>
}

const ACTIVITY_DAYS = 112
const DAY_MS = 86_400_000

function ActivityPanel() {
  const [entries, setEntries] = useState<{ created_at: string; points: number }[] | null>(null)
  const [errorMessage, setErrorMessage] = useState(() => supabase ? '' : 'Configura Supabase para ver tu actividad.')

  useEffect(() => {
    if (!supabase) return
    let active = true
    const since = new Date(Date.now() - ACTIVITY_DAYS * DAY_MS).toISOString()
    void supabase.from('reward_ledger').select('created_at, points').gte('created_at', since).then(({ data, error }) => {
      if (!active) return
      if (error) setErrorMessage('No se pudo cargar tu actividad.')
      else setEntries(data ?? [])
    })
    return () => { active = false }
  }, [])

  const [today] = useState(() => { const date = new Date(); date.setHours(0, 0, 0, 0); return date })
  const firstDay = today.getTime() - (ACTIVITY_DAYS - 1) * DAY_MS
  const counts = new Array<number>(ACTIVITY_DAYS).fill(0)
  let monthPoints = 0
  for (const entry of entries ?? []) {
    const created = new Date(entry.created_at)
    const index = Math.floor((new Date(created).setHours(0, 0, 0, 0) - firstDay) / DAY_MS)
    if (index >= 0 && index < ACTIVITY_DAYS) counts[index] += 1
    if (created.getFullYear() === today.getFullYear() && created.getMonth() === today.getMonth()) monthPoints += entry.points
  }
  const activeDays = counts.filter(Boolean).length
  const monthLabels = Array.from({ length: 5 }, (_, i) => new Intl.DateTimeFormat('es-ES', { month: 'short' }).format(new Date(firstDay + Math.floor((i * ACTIVITY_DAYS) / 5) * DAY_MS)))

  return <div className="activity-panel">
    <div className="section-header"><div><span className="section-kicker">TU ACTIVIDAD</span><h2>Ritmo de recompensas</h2></div><span className="activity-total"><span /> {entries ? `${activeDays} días activos` : '—'}</span></div>
    <div className="heatmap-wrap"><div className="heatmap-months">{monthLabels.map((label, i) => <span key={i}>{label}</span>)}</div><div className="heatmap-grid" role="img" aria-label={`Actividad de recompensas de los últimos ${ACTIVITY_DAYS} días`}>{counts.map((count, index) => <span key={index} className={`heat-cell heat-${Math.min(count, 3)}`} title={`${new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(new Date(firstDay + index * DAY_MS))}: ${count} recompensa${count === 1 ? '' : 's'}`} />)}</div></div>
    <div className="heatmap-legend"><span>Menos</span><i className="heat-0" /><i className="heat-1" /><i className="heat-2" /><i className="heat-3" /><span>Más</span><span className="heatmap-total">{errorMessage || (entries ? `${monthPoints.toLocaleString('es-ES')} puntos este mes` : 'Cargando…')}</span></div>
  </div>
}

function DepositByQr() {
  return <section className="deposit-qr-panel">
    <div className="deposit-qr-header">
      <div>
        <span className="section-kicker">DEPÓSITO POR QR</span>
        <h2>Deposita sin conectar tu wallet</h2>
      </div>
      <span className="deposit-badge">En preparación</span>
    </div>

    <div className="deposit-qr-layout">
      <div className="deposit-qr-placeholder" aria-hidden="true">
        <WalletCards size={36} />
        <span>QR pendiente</span>
      </div>

      <div className="deposit-qr-info">
        <strong>Los depósitos todavía no están habilitados.</strong>
        <p>Conectaremos un proveedor que genere una dirección única y un QR para tu cuenta. No envíes fondos a direcciones compartidas o de prueba.</p>
        <div className="deposit-qr-supported">
          <span>Sin conexión de wallet</span>
          <span>Sin dirección activa</span>
          <span>Sin acreditación automática</span>
        </div>
      </div>
    </div>

    <div className="deposit-qr-steps">
      <div><strong>1</strong><span>Selecciona un activo y una red compatibles.</span></div>
      <div><strong>2</strong><span>Escanea el QR único o copia la dirección de tu cuenta.</span></div>
      <div><strong>3</strong><span>El proveedor confirma la transacción y el servidor acredita el saldo.</span></div>
    </div>
  </section>
}

function AssetPortfolio({ balanceVisible, onSelect }: { balanceVisible: boolean; onSelect: (asset: (typeof assets)[number]) => void }) {
  return <div className="asset-table"><div className="asset-head"><span>ACTIVO</span><span>PRECIO DEMO</span><span>BALANCE DEMO</span><span>CAMBIO</span><span /></div>{assets.map((asset) => <button key={asset.ticker} className="asset-row" onClick={() => onSelect(asset)}><span className="asset-name"><span className={`coin-icon ${asset.color}`}>{asset.icon}</span><span><strong>{asset.ticker}</strong><small>{asset.name}</small></span></span><span className="asset-price">{asset.price}</span><span className="asset-balance"><strong>{asset.amount} <small>{asset.ticker}</small></strong><em>{balanceVisible ? asset.value : '••••••'}</em></span><span className={`asset-change ${asset.change.startsWith('+') ? 'positive' : ''}`}>{asset.change}</span><ArrowRight className="asset-arrow" size={15} /></button>)}</div>
}

const EARN_TASKS = [
  {
    key: 'complete_profile',
    title: 'Completa tu perfil',
    description: 'Confirma tu correo y añade un nombre visible en Perfil. Recompensa única.',
    reward: 25,
    requirement: 'Correo confirmado · nombre visible',
    enabled: true,
  },
  {
    key: 'community_join',
    title: 'Únete a la comunidad',
    description: 'Acepta la regla de la comunidad y participa en el canal oficial del proyecto.',
    reward: 50,
    requirement: 'Próximamente',
    enabled: false,
  },
] as const

function EarnSummary({ onNavigate, hidden = false }: { onNavigate: (page: string) => void; hidden?: boolean }) {
  const [points, setPoints] = useState<number | null>(null)
  const [loading, setLoading] = useState(Boolean(supabase))
  const [errorMessage, setErrorMessage] = useState(() => supabase ? '' : 'Configura Supabase para consultar recompensas.')

  useEffect(() => {
    let active = true
    if (!supabase) return
    const client = supabase
    void client.from('daily_faucet_accounts').select('points').maybeSingle().then(({ data, error }) => {
      if (!active) return
      if (error) setErrorMessage('No se pudo cargar el saldo de puntos.')
      else setPoints(data?.points ?? 0)
      setLoading(false)
    })
    return () => { active = false }
  }, [])

  const visibleEarnTasks = EARN_TASKS.filter((task) => task.enabled)

  return <div className="earn-panel">
    <div className="panel-heading"><div><span className="section-kicker">RECOMPENSAS</span><h2>Tus puntos</h2></div><button className="text-link" onClick={() => onNavigate('Earn')}>Ver tareas <ArrowRight size={14} /></button></div>
    <div className="earn-total"><span>Saldo promocional interno</span><strong>{loading ? '…' : points === null ? '—' : hidden ? '•••' : points.toLocaleString('es-ES')} <small>PTS</small></strong></div>
    <div className="earn-progress-label"><span>Sin valor monetario ni retiros</span><button className="text-link" onClick={() => onNavigate('Historial')}>Historial</button></div>
    <div className="earn-list">
      <button className="earn-row" onClick={() => onNavigate('Faucets')}><span className="earn-brand blue">◉</span><span className="earn-info"><strong>Faucet diario</strong><small>Una reclamación cada 24 horas</small></span><span className="earn-reward">+10<small>PTS</small></span><ArrowRight className="earn-arrow" size={14} /></button>
      {visibleEarnTasks.map((task) => <button key={task.key} className="earn-row" onClick={() => onNavigate('Earn')}><span className="earn-brand lime">P</span><span className="earn-info"><strong>{task.title}</strong><small>{task.requirement}</small></span><span className="earn-reward">+{task.reward}<small>PTS</small></span><ArrowRight className="earn-arrow" size={14} /></button>)}
    </div>
    {errorMessage && <p className="earn-summary-error" role="alert">{errorMessage}</p>}
    <button className="earn-cta" onClick={() => onNavigate('Earn')}><Sparkles size={15} />Explorar tareas verificadas <ArrowRight size={15} /></button>
  </div>
}

function SwapPreview() {
  const [fromTicker, setFromTicker] = useState('BTC')
  const [toTicker, setToTicker] = useState('ETH')
  const [amount, setAmount] = useState('0.01')
  const fromAsset = assets.find((asset) => asset.ticker === fromTicker) ?? assets[0]
  const toAsset = assets.find((asset) => asset.ticker === toTicker) ?? assets[1]
  const fromPrice = Number(fromAsset.price.replace(/[$,]/g, ''))
  const toPrice = Number(toAsset.price.replace(/[$,]/g, ''))
  const parsedAmount = Number(amount)
  const estimate = Number.isFinite(parsedAmount) && parsedAmount > 0 ? (parsedAmount * fromPrice) / toPrice : 0
  const rate = fromPrice / toPrice

  return <div className="swap-demo">
    <div className="swap-field"><span>DESDE · DEMO</span><div><select aria-label="Activo de origen" value={fromTicker} onChange={(event) => setFromTicker(event.target.value)}>{assets.map((asset) => <option key={asset.ticker} value={asset.ticker}>{asset.ticker} · {asset.name}</option>)}</select><span className="swap-balance">Balance demo: {fromAsset.amount}</span></div><input type="number" min="0" step="any" value={amount} onChange={(event) => setAmount(event.target.value)} aria-label={`Importe de ${fromTicker}`} /></div>
    <button className="swap-switch" aria-label="Intercambiar activos" onClick={() => { setFromTicker(toTicker); setToTicker(fromTicker) }}><ArrowLeftRight size={17} /></button>
    <div className="swap-field"><span>HACIA · ESTIMACIÓN</span><div><select aria-label="Activo de destino" value={toTicker} onChange={(event) => setToTicker(event.target.value)}>{assets.map((asset) => <option key={asset.ticker} value={asset.ticker}>{asset.ticker} · {asset.name}</option>)}</select><span className="swap-balance">Balance demo: {toAsset.amount}</span></div><output className="swap-estimate" aria-live="polite">{estimate.toFixed(toTicker === 'USDT' ? 2 : 6)} {toTicker}</output></div>
    <div className="swap-rate"><span>Tipo ilustrativo</span><strong>1 {fromTicker} ≈ {rate.toFixed(4)} {toTicker}</strong><small>Precio fijo de muestra</small></div>
    <div className="swap-unavailable"><ShieldCheck size={15} /><span>Las operaciones reales aún no están conectadas. Esta estimación no es ejecutable.</span></div>
    <button className="modal-primary swap-submit" disabled>Operaciones no disponibles</button>
  </div>
}

function SectionView({ page, onAction, onNavigate, onAssetSelect, earnFilter, setEarnFilter }: {
  page: string; onAction: (action: string) => void; onNavigate: (page: string) => void
  onAssetSelect: (asset: (typeof assets)[number]) => void
  earnFilter: string; setEarnFilter: (filter: string) => void
}) {
  const [selectedActivity, setSelectedActivity] = useState<{ mode: 'survey' | 'offer' | 'game'; title: string; detail: string; reward: string } | null>(null)
  const copy = sectionCopy[page] ?? sectionCopy.Earn
  const selectedEarnFilter = page === 'Faucets' ? 'Faucets'
    : page === 'Offerwalls' ? 'Offerwalls'
      : page === 'Shortlinks' ? 'Shortlinks'
        : page === 'PTC' ? 'PTC' : earnFilter
  return <section className="section-view">
    <div className="section-view-heading"><div><div className="eyebrow"><span className="live-dot" /> {copy.eyebrow} {page === 'Faucets' ? <span className="demo-tag">PUNTOS INTERNOS</span> : ['Offerwalls', 'Shortlinks', 'PTC'].includes(page) ? <span className="demo-tag">SIN CONECTAR</span> : <span className="demo-tag">DEMO</span>}</div><h1>{copy.title}</h1><p>{copy.description}</p></div><button className="date-select" onClick={() => onNavigate('Resumen')}><Grid2X2 size={15} />Volver al resumen</button></div>
    {selectedActivity ? <EarnPlayground {...selectedActivity} onBack={() => setSelectedActivity(null)} />
      : page === 'Depositar' ? <DepositByQr />
      : page === 'Faucets' ? <DailyFaucet />
      : page === 'Cartera' ? <><PointsWallet onNavigate={onNavigate} /><div className="notice-line"><ShieldCheck size={16} /><span>Los saldos y precios cripto siguientes son ilustrativos; no representan activos depositados ni retirables.</span></div><AssetPortfolio balanceVisible onSelect={onAssetSelect} /></>
      : page === 'Historial' ? <PointsWallet showHistory />
      : page === 'Earn' || ['Offerwalls', 'Shortlinks', 'PTC'].includes(page) ? <>
      {page === 'Earn' && <EarnTasks onNavigate={onNavigate} />}
      {page === 'Earn' && <div className="filter-tabs">{['Para ti', 'Encuestas', 'Faucets', 'Offerwalls', 'Shortlinks', 'PTC'].map((filter) => <button key={filter} className={selectedEarnFilter === filter ? 'filter-active' : ''} onClick={() => setEarnFilter(filter)}>{filter}</button>)}</div>}
      {selectedEarnFilter === 'Faucets' ? <DailyFaucet /> : <div className="earn-provider-pending" role="status"><ShieldCheck size={19} /><div><span className="section-kicker">{selectedEarnFilter === 'Para ti' ? 'PROVEEDORES EXTERNOS' : selectedEarnFilter.toUpperCase()}</span><strong>{selectedEarnFilter === 'Para ti' ? 'Las ofertas aún no están conectadas.' : `${selectedEarnFilter} todavía no disponible.`}</strong><p>No hay ofertas activas ni recompensas de terceros disponibles en esta categoría. Las tareas de puntos internos y el faucet diario sí funcionan.</p><button className="text-link" onClick={() => { setEarnFilter('Faucets'); onNavigate('Earn') }}>Ir al faucet de puntos internos <ArrowRight size={13} /></button></div></div>}
    </> : page === 'Swap' || page === 'Exchange' ? <SwapPreview />
      : page === 'Arcade' || page === 'Juegos' ? <><div className="game-grid">{[{ name: 'Dice', label: 'Lanza el dado · gratis', icon: '01', color: 'game-coral', ready: true }, { name: 'Mines', label: 'Tablero de 16 casillas', icon: '✳', color: 'game-yellow', ready: true }, { name: 'Plinko', label: 'Suelta una ficha · gratis', icon: '•••', color: 'game-blue', ready: true }, { name: 'Crash', label: 'En preparación', icon: '↗', color: 'game-lime', ready: false }, { name: 'Ruleta', label: 'En preparación', icon: '◉', color: 'game-blue', ready: false }, { name: 'Limbo', label: 'En preparación', icon: '↗', color: 'game-lime', ready: false }].map((game) => <button className="game-card" key={game.name} disabled={!game.ready} onClick={() => setSelectedActivity({ mode: 'game', title: game.name, detail: game.label, reward: 'Sin valor monetario' })}><span className={`game-art ${game.color}`}>{game.icon}</span><span className="game-meta"><strong>{game.name}</strong><small>{game.label}</small></span>{game.ready && <ArrowUpRight size={16} />}</button>)}</div><div className="notice-line"><ShieldCheck size={16} /><span>Juegos gratuitos de muestra. No aceptan apuestas ni entregan premios.</span></div></>
      : ['Anuncios', 'Anunciar', 'Campañas', 'Listings patrocinados'].includes(page) ? <><div className="ad-metrics">{[['IMPRESIONES DEMO', '24,680'], ['CTR ESTIMADO', '2.84%'], ['COSTE MEDIO', '$0.012']].map(([label, value]) => <div className="ad-metric" key={label}><span>{label}</span><strong>{value}</strong><small><Activity size={13} /> Campaña de muestra</small></div>)}</div><button className="campaign-cta" onClick={() => onAction(page === 'Listings patrocinados' ? 'Crear listing' : 'Crear campaña')}><span><Megaphone size={18} /><strong>{page === 'Listings patrocinados' ? 'Promociona tu faucet' : 'Configura tu primera campaña'}</strong><small>{page === 'Listings patrocinados' ? 'Ubicación destacada en el directorio · simulación' : 'PTC, banners y anuncios nativos · simulación'}</small></span><ArrowRight size={18} /></button></>
      : page === 'Temporada' ? <SeasonPanel />
      : page === 'Gremio' ? <div className="guild-panel"><div className="guild-banner"><div className="guild-emblem"><Blocks size={26} /></div><div><span className="section-kicker">GREMIO · #14 GLOBAL</span><h2>Night Owls</h2><p>Juntos desde hace 42 días</p></div><button className="action-secondary" onClick={() => onAction('Invitar al gremio')}><Users size={15} />Invitar</button></div><div className="guild-stats"><div><span>XP colectiva</span><strong>24,680 <small>/ 30,000</small></strong></div><div><span>Miembros activos</span><strong>12 <small>/ 20</small></strong></div><div><span>Posición semanal</span><strong>#14 <small>↑ 3</small></strong></div></div><div className="guild-footer"><span><Flame size={15} /> Racha de gremio: 8 días</span><button className="text-link" onClick={() => onAction('Tabla de posiciones')}>Ver tabla <ArrowRight size={14} /></button></div></div>
      : page === 'Desarrolladores' || page === 'API' ? <div className="developer-panel"><div className="developer-icon"><Code2 size={24} /></div><div><span className="section-kicker">API DE PAGOS</span><h2>Integra. Prueba. Lanza.</h2><p>Consulta documentación, crea credenciales de sandbox y simula webhooks cuando el portal esté conectado.</p><div className="developer-actions"><button className="action-primary" onClick={() => onAction('Documentación API')}><Code2 size={15} />Ver documentación</button><button className="action-secondary" onClick={() => onAction('Crear API key')}><Plus size={15} />Crear API key</button></div></div><div className="code-preview"><span><i /> SANDBOX · EJEMPLO</span><pre>{`POST /v1/payouts\nAuthorization: Bearer demo_key\n\n{\n  "asset": "USDT",\n  "amount": "1.50"\n}`}</pre></div></div>
      : page === 'Afiliados' ? <ReferralPanel />
      : page === 'Perfil' ? <AccountProfile />
        : page === 'Seguridad' ? <><SecurityCenter /><AccountAccess /></>
          : page === 'Ajustes' ? <AccountSettings />
      : <ModuleOverview page={page} onAction={onAction} />}
  </section>
}

const moduleOptions: Record<string, { metric: string; value: string; caption: string; rows: { title: string; detail: string; value: string }[] }> = {
  Cartera: { metric: 'ACTIVOS EN VISTA', value: '4', caption: 'balances ilustrativos', rows: assets.map((asset) => ({ title: `${asset.name} · ${asset.ticker}`, detail: `${asset.amount} ${asset.ticker}`, value: asset.value })) },
  Depositar: { metric: 'REDES DISPONIBLES', value: '12', caption: 'redes en el catálogo', rows: [{ title: 'Bitcoin', detail: 'BTC · Red Bitcoin', value: 'Activo' }, { title: 'Ethereum', detail: 'ETH · ERC-20', value: 'Activo' }, { title: 'USDT', detail: 'Selecciona red antes de depositar', value: 'Revisar' }] },
  Retirar: { metric: 'ESTADO', value: 'Listo', caption: 'verificación de cuenta requerida', rows: [{ title: 'Seleccionar activo', detail: 'Elige una moneda y red compatible', value: 'Paso 1' }, { title: 'Dirección de destino', detail: 'Se valida antes de confirmar', value: 'Paso 2' }, { title: 'Revisión de retiro', detail: 'Límites y comisiones visibles', value: 'Paso 3' }] },
  Transferir: { metric: 'COMISIÓN INTERNA', value: '0', caption: 'para pagos entre usuarios', rows: [{ title: 'Nombre de usuario', detail: 'Identifica al destinatario', value: 'Requerido' }, { title: 'Activo y cantidad', detail: 'Se muestra el total antes de enviar', value: 'Requerido' }, { title: 'Confirmación', detail: 'Las transferencias son finales', value: 'Revisar' }] },
  Historial: { metric: 'OPERACIONES', value: '24', caption: 'actividad reciente de demo', rows: [{ title: 'Recompensa de faucet', detail: 'BTC · Hoy, 10:42', value: '+0.00000042' }, { title: 'Pago interno', detail: 'USDT · Ayer, 18:06', value: '-2.50' }, { title: 'Retiro on-chain', detail: 'LTC · 08 oct, 13:27', value: '-0.025' }] },
  Direcciones: { metric: 'DIRECCIONES GUARDADAS', value: '0', caption: 'ninguna en esta vista demo', rows: [{ title: 'Lista de permitidas', detail: 'Guarda direcciones de retiro verificadas', value: 'Vacía' }, { title: 'Red correcta', detail: 'La red de destino debe coincidir', value: 'Importante' }] },
  Lotería: { metric: 'SORTEOS ACTIVOS', value: '3', caption: 'muestra ilustrativa', rows: [{ title: 'Sorteo semanal', detail: 'BTC · Cierra en 2 d 14 h', value: 'Ver reglas' }, { title: 'Premio comunitario', detail: 'DOGE · Cierra en 5 d', value: 'Ver reglas' }] },
  Staking: { metric: 'RENDIMIENTO', value: 'Variable', caption: 'no garantizado · depende del protocolo', rows: [{ title: 'FEY flexible', detail: 'Sin periodo fijo · riesgos del token', value: 'Más información' }, { title: 'Yield DeFi', detail: 'Estrategia externa · riesgo de contrato', value: 'No conectado' }] },
}

type RewardLedgerEntry = {
  id: number
  source_type: 'daily_faucet' | 'earn_task' | 'offerwall' | 'referral'
  points: number
  balance_after: number
  created_at: string
}

const LEDGER_SOURCE_LABELS: Record<RewardLedgerEntry['source_type'], string> = {
  daily_faucet: 'Faucet diario',
  earn_task: 'Tarea: perfil completo',
  offerwall: 'Oferta de proveedor',
  referral: 'Referido verificado',
}

function PointsWallet({ showHistory = false, onNavigate }: { showHistory?: boolean; onNavigate?: (page: string) => void }) {
  const [loading, setLoading] = useState(true)
  const [balance, setBalance] = useState<number | null>(null)
  const [ledger, setLedger] = useState<RewardLedgerEntry[]>([])
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let active = true
    const load = async () => {
      if (!supabase) {
        setErrorMessage('Configura Supabase para consultar tu saldo de puntos.')
        setLoading(false)
        return
      }

      try {
        const [accountResult, ledgerResult] = await Promise.all([
          supabase.from('daily_faucet_accounts').select('points').maybeSingle(),
          supabase.from('reward_ledger').select('id, source_type, points, balance_after, created_at').order('created_at', { ascending: false }).limit(50),
        ])
        if (accountResult.error) throw accountResult.error
        if (ledgerResult.error) throw ledgerResult.error
        if (!active) return
        setBalance(accountResult.data?.points ?? 0)
        setLedger(ledgerResult.data ?? [])
      } catch {
        if (active) setErrorMessage('No se pudo cargar el saldo o el historial de puntos. Revisa las migraciones de Supabase.')
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()
    return () => { active = false }
  }, [])

  const title = showHistory ? 'Movimientos de puntos' : 'Puntos promocionales'
  return <section className="points-wallet">
    <div className="points-wallet-summary"><div><span className="section-kicker">{showHistory ? 'LEDGER DE RECOMPENSAS' : 'SALDO INTERNO · NO ES CRIPTOMONEDA'}</span><h2>{title}</h2><p>Sin valor monetario, transferencias ni retiros.</p></div><strong>{loading ? '…' : balance === null ? '—' : balance.toLocaleString('es-ES')}<small> puntos</small></strong></div>
    {errorMessage && <p className="profile-feedback-error" role="alert">{errorMessage}</p>}
    {showHistory && (loading
      ? <p className="reward-history-empty">Cargando movimientos…</p>
      : ledger.length
        ? <div className="points-wallet-history">{ledger.map((entry) => <div className="reward-history-row" key={entry.id}><span><strong>{LEDGER_SOURCE_LABELS[entry.source_type]}</strong><small>{new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(entry.created_at))}</small></span><strong>+{entry.points} <small>· saldo {entry.balance_after}</small></strong></div>)}</div>
        : !errorMessage && <p className="reward-history-empty">Todavía no hay recompensas acreditadas.</p>)}
    {!showHistory && onNavigate && <button className="text-link points-wallet-link" onClick={() => onNavigate('Historial')}>Ver historial de puntos <ArrowRight size={13} /></button>}
  </section>
}

type ReferralSummary = {
  code: string
  total_referrals: number
  rewarded_referrals: number
  points_earned: number
  was_referred: boolean
  max_rewarded: number
  reward_per_referral: number
}

function ReferralPanel() {
  const [summary, setSummary] = useState<ReferralSummary | null>(null)
  const [loading, setLoading] = useState(Boolean(supabase))
  const [errorMessage, setErrorMessage] = useState(() => supabase ? '' : 'Configura Supabase para usar afiliados.')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!supabase) return
    let active = true
    void supabase.rpc('get_referral_summary').then(({ data, error }) => {
      if (!active) return
      if (error || !data?.[0]) setErrorMessage('No se pudo cargar tu enlace de invitación. Comprueba que aplicaste la migración de referidos.')
      else setSummary(data[0])
      setLoading(false)
    })
    return () => { active = false }
  }, [])

  const link = summary ? `${window.location.origin}/?ref=${summary.code}` : ''
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setErrorMessage('No se pudo copiar el enlace. Cópialo manualmente.')
    }
  }

  return <section className="points-wallet referral-panel">
    <div className="points-wallet-summary"><div><span className="section-kicker">PROGRAMA DE REFERIDOS · PUNTOS INTERNOS</span><h2>Tu enlace de invitación</h2><p>{summary ? `+${summary.reward_per_referral} puntos por referido verificado, hasta ${summary.max_rewarded} referidos.` : 'Sin valor monetario, transferencias ni retiros.'}</p></div><strong>{loading ? '…' : summary ? summary.points_earned.toLocaleString('es-ES') : '—'}<small> puntos ganados</small></strong></div>
    {summary && <div className="referral-link-row"><input readOnly aria-label="Enlace de invitación" value={link} onFocus={(event) => event.currentTarget.select()} /><button className="action-primary" onClick={() => void copyLink()}>{copied ? 'Copiado' : 'Copiar enlace'}</button></div>}
    {summary && <div className="referral-stats"><div><span>Invitados registrados</span><strong>{summary.total_referrals}</strong></div><div><span>Referidos verificados</span><strong>{summary.rewarded_referrals} <small>/ {summary.max_rewarded}</small></strong></div><div><span>Tu cuenta</span><strong>{summary.was_referred ? 'Invitada' : 'Directa'}</strong></div></div>}
    {errorMessage && <p className="profile-feedback-error" role="alert">{errorMessage}</p>}
    <div className="notice-line"><ShieldCheck size={16} /><span>El código solo puede aplicarse durante los primeros 7 días de una cuenta nueva y no se puede usar con la propia cuenta. Los puntos no son criptomonedas ni se pueden retirar.</span></div>
  </section>
}

function EarnTasks({ onNavigate }: { onNavigate: (page: string) => void }) {
  const [loading, setLoading] = useState(true)
  const [hasSession, setHasSession] = useState(false)
  const [taskStatuses, setTaskStatuses] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)
  const [balance, setBalance] = useState<number | null>(null)
  const [ledger, setLedger] = useState<RewardLedgerEntry[]>([])
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let active = true
    const load = async () => {
      if (!supabase) {
        if (active) {
          setErrorMessage('Configura Supabase para usar tareas con recompensa.')
          setLoading(false)
        }
        return
      }

      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) throw sessionError
        if (!sessionData.session) {
          if (active) {
            setErrorMessage('Inicia sesión para participar en las tareas recompensadas.')
            setLoading(false)
          }
          return
        }
        if (active) setHasSession(true)

        const enabledTaskKeys = EARN_TASKS.filter((task) => task.enabled).map((task) => task.key)
        const [accountResult, completionResult, ledgerResult] = await Promise.all([
          supabase.from('daily_faucet_accounts').select('points').maybeSingle(),
          enabledTaskKeys.length
            ? supabase.from('earn_task_completions').select('task_key, reward, completed_at').in('task_key', enabledTaskKeys)
            : Promise.resolve({ data: [], error: null }),
          supabase.from('reward_ledger').select('id, source_type, points, balance_after, created_at').order('created_at', { ascending: false }).limit(10),
        ])
        if (accountResult.error) throw accountResult.error
        if (completionResult && 'error' in completionResult && completionResult.error) throw completionResult.error
        if (ledgerResult.error) throw ledgerResult.error
        if (!active) return

        const completionMap = new Map((completionResult && 'data' in completionResult ? completionResult.data ?? [] : []).map((item: { task_key: string }) => [item.task_key, true]))
        const nextTaskStatuses = Object.fromEntries(EARN_TASKS.map((task) => [task.key, task.enabled && Boolean(completionMap.has(task.key))]))

        setBalance(accountResult.data?.points ?? 0)
        setTaskStatuses(nextTaskStatuses)
        setLedger(ledgerResult.data ?? [])
      } catch {
        if (active) setErrorMessage('No se pudo cargar el estado de las tareas. Comprueba que aplicaste todas las migraciones.')
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()
    return () => { active = false }
  }, [])

  const completeEarnTask = async (taskKey: string) => {
    const taskDefinition = EARN_TASKS.find((task) => task.key === taskKey)
    if (!supabase || !hasSession || !taskDefinition || !taskDefinition.enabled || taskStatuses[taskKey] || busy) return

    setBusy(true)
    setMessage('')
    setErrorMessage('')

    try {
      const { data, error } = await supabase.rpc('complete_earn_task', { task_key: taskKey })
      if (error) {
        if (error.code === '22023') {
          setErrorMessage('Confirma tu correo y guarda un nombre visible en Perfil antes de reclamar esta recompensa.')
          return
        }
        throw error
      }
      const result = data?.[0]
      if (!result) throw new Error('El servidor no devolvió el estado de la tarea.')

      setTaskStatuses((current) => ({ ...current, [taskKey]: true }))
      setBalance(result.balance)

      if (result.awarded) {
        const entry: RewardLedgerEntry = {
          id: -Date.parse(result.completed_at),
          source_type: 'earn_task',
          points: result.reward,
          balance_after: result.balance,
          created_at: result.completed_at,
        }
        setLedger((entries) => [entry, ...entries].slice(0, 10))
      }

      setMessage(result.awarded ? `¡Tarea completada! +${result.reward} puntos internos.` : 'Esta tarea ya estaba completada.')
    } catch {
      setErrorMessage('No se pudo completar la tarea. Comprueba la conexión e inténtalo de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  return <section className="earn-tasks">
    <div className="earn-tasks-heading"><div><span className="section-kicker">TAREAS CON RECOMPENSA INTERNA</span><h2>Progreso de tu cuenta</h2></div><span className="earn-tasks-balance">{balance === null ? '—' : balance.toLocaleString('es-ES')} puntos</span></div>
    {EARN_TASKS.map((task, index) => {
      const isCompleted = Boolean(taskStatuses[task.key])
      const isDisabled = !task.enabled || loading || busy || isCompleted || !hasSession

      return <div className="earn-task-row" key={task.key}>
        <span className="earn-task-number">{String(index + 1).padStart(2, '0')}</span>
        <div className="earn-task-copy"><strong>{task.title}</strong><small>{task.description}</small></div>
        <span className="earn-task-reward">+{task.reward} puntos</span>
        <button className="action-secondary" disabled={isDisabled} onClick={() => void (task.enabled ? completeEarnTask(task.key) : undefined)}>{
          loading ? 'Cargando…'
            : busy ? 'Verificando…'
              : !task.enabled ? 'Próximamente'
                : isCompleted ? 'Completada'
                  : 'Reclamar'}
        </button>
      </div>
    })}
    <div className="earn-task-row">
      <span className="earn-task-number">03</span>
      <div className="earn-task-copy"><strong>Reclama el faucet diario</strong><small>Disponible cada 24 horas · una recompensa por cuenta.</small></div>
      <span className="earn-task-reward">+10 puntos</span>
      <button className="action-secondary" disabled={!hasSession} onClick={() => onNavigate('Faucets')}>Abrir faucet <ArrowRight size={13} /></button>
    </div>
    {!hasSession && !loading && <p className="earn-task-feedback" role="status">{errorMessage}<button className="text-link" onClick={() => window.location.assign('/?login=1')}>Iniciar sesión <ArrowRight size={13} /></button></p>}
    {hasSession && errorMessage && <p className="profile-feedback-error" role="alert">{errorMessage}</p>}
    {message && <p className="profile-feedback" role="status">{message}</p>}
    <p className="earn-task-disclaimer"><ShieldCheck size={14} />Puntos promocionales internos, sin valor monetario ni conversión o retiro en cripto.</p>
    {hasSession && <div className="reward-history"><div className="reward-history-heading"><span className="section-kicker">ACTIVIDAD RECIENTE</span><strong>Historial de puntos</strong></div>{ledger.length ? ledger.map((entry) => <div className="reward-history-row" key={entry.id}><span><strong>{LEDGER_SOURCE_LABELS[entry.source_type]}</strong><small>{new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(entry.created_at))}</small></span><strong>+{entry.points} <small>· saldo {entry.balance_after}</small></strong></div>) : <p className="reward-history-empty">Todavía no hay recompensas acreditadas.</p>}</div>}
  </section>
}

const FAUCET_BASE_REWARD = 10
const FAUCET_MAX_BONUS_DAYS = 6
const faucetReward = (streak: number) => FAUCET_BASE_REWARD + 2 * Math.min(Math.max(streak - 1, 0), FAUCET_MAX_BONUS_DAYS)

function DailyFaucet() {
  const [points, setPoints] = useState<number | null>(null)
  const [lastClaimAt, setLastClaimAt] = useState<string | null>(null)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [hasSession, setHasSession] = useState(false)
  const [now, setNow] = useState(0)
  const [feedback, setFeedback] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let active = true
    const load = async () => {
      if (!supabase) {
        setErrorMessage('Conecta Supabase para activar las recompensas.')
        setLoading(false)
        return
      }

      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) throw sessionError
        if (!sessionData.session) {
          if (active) {
            setErrorMessage('Inicia sesión para consultar y reclamar tus puntos.')
            setLoading(false)
          }
          return
        }
        if (active) setHasSession(true)

        const [accountResult, claimResult] = await Promise.all([
          supabase.from('daily_faucet_accounts').select('points, streak, best_streak').maybeSingle(),
          supabase.from('daily_faucet_claims').select('claimed_at').order('claimed_at', { ascending: false }).limit(1).maybeSingle(),
        ])
        let account = accountResult.data as { points: number; streak?: number; best_streak?: number } | null
        if (accountResult.error) {
          const legacy = await supabase.from('daily_faucet_accounts').select('points').maybeSingle()
          if (legacy.error) throw legacy.error
          account = legacy.data
        }
        if (claimResult.error) throw claimResult.error
        if (!active) return
        setPoints(account?.points ?? 0)
        setStreak(account?.streak ?? 0)
        setBestStreak(account?.best_streak ?? 0)
        setLastClaimAt(claimResult.data?.claimed_at ?? null)
      } catch {
        if (active) setErrorMessage('No se pudo cargar el saldo o el historial del faucet. Revisa la migración de Supabase e inténtalo de nuevo.')
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()
    return () => { active = false }
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const DAY_MS = 24 * 60 * 60 * 1000
  const nextClaimAt = lastClaimAt ? Date.parse(lastClaimAt) + DAY_MS : 0
  const cooldownMs = Math.max(0, nextClaimAt - now)
  const available = cooldownMs === 0
  const streakAlive = lastClaimAt !== null && now > 0 && now - Date.parse(lastClaimAt) < 2 * DAY_MS
  const activeStreak = streakAlive ? streak : 0
  const nextReward = faucetReward(activeStreak + 1)
  const countdown = `${Math.floor(cooldownMs / 3_600_000).toString().padStart(2, '0')}:${Math.floor((cooldownMs % 3_600_000) / 60_000).toString().padStart(2, '0')}:${Math.floor((cooldownMs % 60_000) / 1000).toString().padStart(2, '0')}`

  const claimReward = async () => {
    if (!supabase || !hasSession || busy || !available) return
    setBusy(true)
    setFeedback('')
    setErrorMessage('')
    try {
      const { data, error } = await supabase.rpc('claim_daily_faucet')
      if (error) throw error
      const result = data?.[0]
      if (!result) throw new Error('El servidor no devolvió el estado de la recompensa.')
      setPoints(result.balance)
      setLastClaimAt(result.last_claim_at)
      if (typeof result.streak === 'number') {
        setStreak(result.streak)
        setBestStreak((best) => Math.max(best, result.streak))
      }
      setFeedback(result.claimed
        ? `¡Recompensa acreditada! +${result.reward} puntos internos${result.streak > 1 ? ` · racha de ${result.streak} días` : ''}.`
        : 'Esta cuenta ya reclamó la recompensa. Vuelve cuando termine el contador.')
      if (result.claimed) window.dispatchEvent(new Event(CLAIM_EVENT))
    } catch (error) {
      const code = (error as { code?: string } | null)?.code
      const message = error instanceof Error ? error.message : ''
      setErrorMessage(code === '22023' || message.includes('Email confirmation required')
        ? 'Confirma tu correo electrónico para poder reclamar. Revisa tu bandeja de entrada y el spam.'
        : 'No se pudo reclamar la recompensa. Comprueba la conexión e inténtalo de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  return <section className="daily-faucet">
    <div className="daily-faucet-card">
      <div className="daily-faucet-icon"><Gift size={22} /></div>
      <div className="daily-faucet-copy">
        <span className="section-kicker">RECOMPENSA CADA 24 HORAS</span>
        <h2>Reclama tus puntos diarios.</h2>
        <p>Reclama cada día para mantener tu racha: 10 puntos y +2 por cada día seguido, hasta 22. Si pasan más de 48 horas, la racha vuelve a empezar.</p>
      </div>
      <div className="daily-faucet-balance"><span>TU SALDO</span><strong>{points === null ? '—' : points.toLocaleString('es-ES')}</strong><small>puntos internos</small></div>
    </div>
    <div className="streak-row" aria-label="Racha de reclamaciones">
      <div><span>RACHA ACTUAL</span><strong>{activeStreak} <small>{activeStreak === 1 ? 'día' : 'días'}</small></strong></div>
      <div><span>MEJOR RACHA</span><strong>{bestStreak} <small>{bestStreak === 1 ? 'día' : 'días'}</small></strong></div>
      <div><span>PRÓXIMA RECOMPENSA</span><strong>+{nextReward} <small>PTS</small></strong></div>
    </div>
    <div className="daily-faucet-action">
      <div><strong>{loading ? 'Comprobando disponibilidad…' : available ? 'Tu recompensa está lista' : `Próxima recompensa en ${countdown}`}</strong><small>{nextReward} puntos internos · una reclamación cada 24 horas · requiere correo verificado</small></div>
      <button className="action-primary" disabled={loading || busy || !hasSession || !available} onClick={() => void claimReward()}>{busy ? 'Acreditando…' : available ? `Reclamar ${nextReward} puntos` : 'Recompensa reclamada'}<Gift size={15} /></button>
    </div>
    {!hasSession && !loading && <p className="daily-faucet-message" role="status">{errorMessage}<button className="text-link" onClick={() => window.location.assign('/?login=1')}>Iniciar sesión <ArrowRight size={13} /></button></p>}
    {hasSession && errorMessage && <p className="profile-feedback-error" role="alert">{errorMessage}</p>}
    {feedback && <p className="profile-feedback" role="status">{feedback}</p>}
    <div className="notice-line"><ShieldCheck size={16} /><span>Los puntos son promocionales: no son criptomonedas, no tienen valor monetario y no se pueden retirar ni transferir.</span></div>
  </section>
}

function ModuleOverview({ page, onAction }: { page: string; onAction: (action: string) => void }) {
  const module = moduleOptions[page] ?? {
    metric: 'ESTADO DEL MÓDULO', value: 'Vista previa', caption: 'sin integración activa',
    rows: [{ title: 'Configuración del servicio', detail: 'Conectaremos esta función en su siguiente fase', value: 'Pendiente' }],
  }
  const Icon = dashboardNav.flatMap((group) => group.items).find((item) => item.label === page)?.icon ?? WalletCards
  return <div className="module-preview-grid">
    <div className="module-preview-panel">
      <div className="module-preview-heading"><span className="module-preview-icon"><Icon size={19} /></span><div><span className="section-kicker">{page.toUpperCase()} · VISTA PREVIA</span><h2>Opciones de {page.toLowerCase()}</h2></div></div>
      <div className="module-preview-list">{module.rows.map((row) => <button className="module-preview-row" key={row.title} onClick={() => onAction(`${row.title} · vista demo`)}><span><strong>{row.title}</strong><small>{row.detail}</small></span><em>{row.value}</em><ArrowRight size={15} /></button>)}</div>
      <div className="module-preview-notice"><ShieldCheck size={15} />Vista de demostración: no se envían fondos ni se modifican datos.</div>
    </div>
    <aside className="module-summary-panel"><span className="section-kicker">RESUMEN</span><strong>{module.value}</strong><small>{module.metric}</small><p>{module.caption}</p><div className="module-summary-foot"><span className="market-status-dot" /> Servicio en preparación</div></aside>
  </div>
}

function SecurityCenter() {
  const [loading, setLoading] = useState(Boolean(supabase))
  const [email, setEmail] = useState('')
  const [emailConfirmed, setEmailConfirmed] = useState(false)
  const [verifiedTotpFactors, setVerifiedTotpFactors] = useState<{ id: string; friendlyName: string }[]>([])
  const [pendingFactorId, setPendingFactorId] = useState('')
  const [qrCode, setQrCode] = useState('')
  const [secret, setSecret] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [recoveryCodesRemaining, setRecoveryCodesRemaining] = useState<number | null>(null)
  const [hasRecoveryCodes, setHasRecoveryCodes] = useState(false)
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])
  const [recoveryTotpCode, setRecoveryTotpCode] = useState('')
  const [recoveryRefresh, setRecoveryRefresh] = useState(false)
  const [recoveryStatusMessage, setRecoveryStatusMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const refreshFactors = async () => {
    if (!supabase) return
    const { data, error } = await supabase.auth.mfa.listFactors()
    if (error) throw error
    const totpFactors = data.all.filter((factor) => factor.factor_type === 'totp')
    setVerifiedTotpFactors(totpFactors
      .filter((factor) => factor.status === 'verified')
      .map((factor) => ({ id: factor.id, friendlyName: factor.friendly_name ?? 'App autenticadora' })))
    setPendingFactorId(totpFactors.find((factor) => factor.status === 'unverified')?.id ?? '')
  }

  const refreshRecoveryStatus = async () => {
    if (!supabase) return
    const { data, error } = await supabase.auth.mfa.recoveryCodes.getStatus()
    if (error) {
      if (error.code === 'mfa_factor_not_found') {
        setRecoveryCodesRemaining(0)
        setHasRecoveryCodes(false)
        setRecoveryStatusMessage('')
        return
      }
      setRecoveryCodesRemaining(null)
      setHasRecoveryCodes(false)
      setRecoveryStatusMessage('No se pudo consultar el estado de los códigos. Comprueba que la versión y la configuración de Supabase Auth admiten códigos de recuperación.')
      return
    }
    setRecoveryCodesRemaining(data.remaining)
    setHasRecoveryCodes(true)
    setRecoveryStatusMessage('')
  }

  useEffect(() => {
    let active = true
    if (!supabase) return
    const client = supabase
    const load = async () => {
      try {
        const [userResult] = await Promise.all([client.auth.getUser(), refreshFactors(), refreshRecoveryStatus()])
        if (!active) return
        if (userResult.error) throw userResult.error
        setEmail(userResult.data.user?.email ?? '')
        setEmailConfirmed(Boolean(userResult.data.user?.email_confirmed_at))
      } catch {
        if (active) setErrorMessage('No se pudo cargar toda la información de seguridad.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [])

  const startTotpEnrollment = async () => {
    if (!supabase || busy || pendingFactorId) return
    setBusy(true)
    setErrorMessage('')
    setSuccessMessage('')
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Faucet authenticator',
        issuer: 'Faucet Protocol',
      })
      if (error) throw error
      if (data.type !== 'totp') throw new Error('Supabase no devolvió un factor TOTP.')
      setPendingFactorId(data.id)
      setQrCode(data.totp.qr_code)
      setSecret(data.totp.secret)
      setSuccessMessage('Escanea el QR con una app autenticadora y confirma el código de seis cifras.')
    } catch {
      setErrorMessage('No se pudo iniciar la configuración MFA. Si ya hay una configuración pendiente, elimínala y vuelve a intentarlo.')
    } finally {
      setBusy(false)
    }
  }

  const verifyTotpEnrollment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase || !pendingFactorId || !/^\d{6}$/.test(totpCode)) {
      setErrorMessage('Introduce el código de seis cifras de tu app autenticadora.')
      return
    }
    setBusy(true)
    setErrorMessage('')
    setSuccessMessage('')
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: pendingFactorId, code: totpCode })
      if (error) throw error
      setQrCode('')
      setSecret('')
      setTotpCode('')
      await refreshFactors()
      setSuccessMessage('Autenticación en dos pasos activada.')
    } catch {
      setErrorMessage('No se pudo verificar el código. Comprueba la hora del dispositivo e inténtalo otra vez.')
    } finally {
      setBusy(false)
    }
  }

  const removeTotpFactor = async (factorId: string) => {
    if (!supabase || busy) return
    if (!window.confirm('¿Eliminar este factor de autenticación? Asegúrate de conservar acceso a tu cuenta.')) return
    setBusy(true)
    setErrorMessage('')
    setSuccessMessage('')
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId })
      if (error) throw error
      if (factorId === pendingFactorId) {
        setQrCode('')
        setSecret('')
        setTotpCode('')
      }
      await refreshFactors()
      setSuccessMessage('Factor de autenticación eliminado.')
    } catch {
      setErrorMessage('No se pudo eliminar el factor. Inténtalo de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  const createRecoveryCodes = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase || !verifiedTotpFactors.length || busy) return
    if (!recoveryRefresh || !/^\d{6}$/.test(recoveryTotpCode)) {
      setRecoveryRefresh(true)
      setErrorMessage('Introduce un código TOTP actual para confirmar la generación.')
      return
    }
    const replacing = hasRecoveryCodes
    if (replacing && !window.confirm('Regenerar los códigos invalidará inmediatamente todos los códigos de recuperación actuales. ¿Continuar?')) return
    setBusy(true)
    setErrorMessage('')
    setSuccessMessage('')
    setRecoveryCodes([])
    try {
      const { error: stepUpError } = await supabase.auth.mfa.challengeAndVerify({
        factorId: verifiedTotpFactors[0].id,
        code: recoveryTotpCode,
      })
      if (stepUpError) throw stepUpError

      const result = replacing
        ? await supabase.auth.mfa.recoveryCodes.regenerate()
        : await supabase.auth.mfa.recoveryCodes.generate({ friendlyName: 'Faucet recovery codes' })
      if (result.error) throw result.error
      setRecoveryCodes(result.data.codes)
      setRecoveryCodesRemaining(result.data.codes.length)
      setHasRecoveryCodes(true)
      setRecoveryTotpCode('')
      setRecoveryRefresh(false)
      setSuccessMessage('Guarda estos códigos ahora. No volverán a mostrarse y cada uno sirve una sola vez.')
    } catch (error) {
      setRecoveryRefresh(true)
      const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : ''
      setErrorMessage(code === 'insufficient_aal'
        ? 'La verificación TOTP no elevó la sesión a AAL2. Vuelve a introducir un código actual e inténtalo otra vez.'
        : code === 'mfa_recovery_codes_enroll_not_enabled'
          ? 'Supabase Auth no tiene habilitada la generación de códigos de recuperación para este proyecto.'
          : 'No se pudieron generar los códigos. Comprueba el TOTP y la configuración de Supabase Auth.')
    } finally {
      setBusy(false)
    }
  }

  const sendRecoveryEmail = async () => {
    if (!supabase || !email) return
    setBusy(true)
    setErrorMessage('')
    setSuccessMessage('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
    if (error) setErrorMessage('No se pudo enviar el correo de recuperación. Revisa el SMTP y los límites de Supabase.')
    else setSuccessMessage('Enlace solicitado. Revisa tu correo y la carpeta de spam.')
    setBusy(false)
  }

  return <div className="security-center"><section className="security-panel">
    <div className="security-panel-heading"><span className="module-preview-icon"><ShieldCheck size={18} /></span><div><span className="section-kicker">ESTADO DE LA CUENTA</span><h2>Seguridad</h2></div></div>
    <div className="security-check-row"><span><strong>Correo electrónico</strong><small>{email || (loading ? 'Cargando…' : 'No disponible')}</small></span><em className={emailConfirmed ? 'security-good' : 'security-warn'}>{loading ? 'Comprobando' : emailConfirmed ? 'Verificado' : 'Sin verificar'}</em></div>
    <div className="security-check-row"><span><strong>Segundo factor (TOTP)</strong><small>{verifiedTotpFactors.length ? `${verifiedTotpFactors.length} app${verifiedTotpFactors.length === 1 ? '' : 's'} autenticadora${verifiedTotpFactors.length === 1 ? '' : 's'}` : loading ? 'Comprobando…' : 'No configurado'}</small></span><em className={verifiedTotpFactors.length ? 'security-good' : 'security-warn'}>{loading ? 'Comprobando' : verifiedTotpFactors.length ? 'Activo' : 'No configurado'}</em></div>
    {!pendingFactorId && <div className="security-actions"><div><strong>App autenticadora</strong><small>Configura códigos TOTP de seis cifras para proteger el inicio de sesión.</small></div><button className="action-secondary" disabled={loading || busy || !supabase} onClick={() => void startTotpEnrollment()}>{busy ? 'Preparando…' : 'Configurar TOTP'}</button></div>}
    {pendingFactorId && <div className="mfa-enrollment">
      <div><strong>{qrCode ? 'Vincula tu app autenticadora' : 'Hay una configuración pendiente'}</strong><small>{qrCode ? 'Escanea el QR. Si no puedes, introduce la clave manualmente. No compartas esta clave.' : 'El QR solo se muestra al crear el factor. Elimina esta configuración pendiente para generar uno nuevo.'}</small></div>
      {qrCode && <img className="mfa-qr" src={qrCode} alt="Código QR secreto para configurar TOTP" />}
      {secret && <label className="mfa-secret"><span>Clave manual (secreta)</span><code>{secret}</code></label>}
      <form className="mfa-verify-form" onSubmit={(event) => void verifyTotpEnrollment(event)}><label><span>Código de seis cifras</span><input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={totpCode} onChange={(event) => setTotpCode(event.target.value.replace(/\D/g, '').slice(0, 6))} aria-label="Código TOTP de seis cifras" /></label><button className="action-primary" type="submit" disabled={busy || totpCode.length !== 6}>{busy ? 'Verificando…' : 'Verificar y activar'}</button></form>
      <button className="text-link mfa-cancel" disabled={busy} onClick={() => void removeTotpFactor(pendingFactorId)}>Cancelar configuración</button>
    </div>}
    {verifiedTotpFactors.map((factor) => <div className="security-actions" key={factor.id}><div><strong>{factor.friendlyName}</strong><small>Factor TOTP verificado.</small></div><button className="action-secondary" disabled={busy} onClick={() => void removeTotpFactor(factor.id)}>Eliminar</button></div>)}
    {verifiedTotpFactors.length > 0 && <div className="mfa-recovery">
      <div className="mfa-recovery-heading"><strong>Códigos de recuperación</strong><small>{recoveryCodesRemaining === null ? 'Estado desconocido' : `${recoveryCodesRemaining} códigos sin usar`} · cada código funciona una sola vez.</small></div>
      {recoveryStatusMessage && <p className="profile-feedback-error" role="alert">{recoveryStatusMessage}</p>}
      {recoveryCodes.length > 0 ? <>
        <p role="alert">Guárdalos en un lugar seguro fuera de este dispositivo. Cualquiera que los obtenga podría acceder a tu cuenta.</p>
        <div className="mfa-recovery-codes" aria-label="Códigos de recuperación">{recoveryCodes.map((code) => <code key={code}>{code.match(/.{1,4}/g)?.join('-') ?? code}</code>)}</div>
        <button className="action-secondary" disabled={busy} onClick={() => { setRecoveryCodes([]); setSuccessMessage('Los códigos se han retirado de la pantalla.') }}>Ya los guardé</button>
      </> : <form className="mfa-verify-form" onSubmit={(event) => void createRecoveryCodes(event)}>
        {recoveryRefresh && <label><span>Confirma con tu app autenticadora</span><input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={recoveryTotpCode} onChange={(event) => setRecoveryTotpCode(event.target.value.replace(/\D/g, '').slice(0, 6))} aria-label="Código TOTP para generar códigos de recuperación" /></label>}
        <button className="action-secondary" type="submit" disabled={busy || loading || recoveryCodesRemaining === null}>{busy ? 'Generando…' : hasRecoveryCodes ? 'Regenerar códigos' : 'Generar códigos'}</button>
      </form>}
    </div>}
    <div className="security-actions"><div><strong>Restablecer contraseña</strong><small>Te enviaremos un enlace al correo de esta cuenta.</small></div><button className="action-secondary" disabled={loading || busy || !email} onClick={() => void sendRecoveryEmail()}>{busy ? 'Procesando…' : 'Enviar enlace'}</button></div>
    {errorMessage && <p className="profile-feedback-error" role="alert">{errorMessage}</p>}{successMessage && <p className="profile-feedback" role="status">{successMessage}</p>}
    <div className="module-preview-notice"><ShieldCheck size={15} />Al activar TOTP, se solicitará un código antes de abrir el dashboard en cada nuevo inicio de sesión.</div>
  </section></div>
}

export default function App() {
  const [path, setPath] = useState(window.location.pathname)
  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname)
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])
  return path === '/dashboard' ? <DashboardRoute /> : <HomePage />
}

function DashboardRoute() {
  const [authStatus, setAuthStatus] = useState<'loading' | 'signed-out' | 'ready' | 'mfa-required' | 'error'>(() => supabase ? 'loading' : import.meta.env.DEV ? 'ready' : 'signed-out')

  useEffect(() => {
    if (!supabase) return
    const client = supabase

    let active = true
    const checkSession = async (session: Session | null) => {
      if (!session) {
        if (active) setAuthStatus('signed-out')
        return
      }
      try {
        const { data, error } = await client.auth.mfa.getAuthenticatorAssuranceLevel()
        if (error) throw error
        const mfaRequired = data.nextLevel === 'aal2' && data.currentLevel !== 'aal2'
        if (!mfaRequired) void applyPendingReferral()
        if (active) setAuthStatus(mfaRequired ? 'mfa-required' : 'ready')
      } catch {
        if (active) setAuthStatus('error')
      }
    }
    void client.auth.getSession().then(({ data, error }) => {
      if (error) {
        if (active) setAuthStatus('error')
        return
      }
      void checkSession(data.session)
    })
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      queueMicrotask(() => { void checkSession(session) })
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (authStatus === 'signed-out' && !import.meta.env.DEV) {
      window.location.replace('/?login=1')
    }
  }, [authStatus])

  if (authStatus === 'loading') return <div className="market-loading-page"><span className="live-dot" />Verificando sesión…</div>
  if (authStatus === 'mfa-required') return <MfaChallenge onVerified={() => setAuthStatus('ready')} />
  if (authStatus === 'error') return <div className="market-loading-page" role="alert">No se pudo verificar el nivel de seguridad de la sesión. Recarga la página o vuelve a iniciar sesión.</div>
  if (authStatus === 'signed-out' && !import.meta.env.DEV) return null
  return <DashboardPrototype />
}

function MfaChallenge({ onVerified }: { onVerified: () => void }) {
  const [factorId, setFactorId] = useState('')
  const [verificationMode, setVerificationMode] = useState<'totp' | 'recovery'>('totp')
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
          if (!factor && !data.recovery_code.length) setErrorMessage('No se encontró un factor verificado ni códigos de recuperación. Contacta con soporte para recuperar el acceso.')
        }
      } catch {
        if (active) setErrorMessage('No se pudo cargar tu factor de autenticación.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [])

  const verifyCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase || (verificationMode === 'totp' && (!factorId || !/^\d{6}$/.test(code))) || (verificationMode === 'recovery' && !code.trim())) return
    setBusy(true)
    setErrorMessage('')
    try {
      const { error } = verificationMode === 'totp'
        ? await supabase.auth.mfa.challengeAndVerify({ factorId, code })
        : await supabase.auth.mfa.recoveryCodes.verify({ code })
      if (error) throw error
      onVerified()
    } catch {
      setErrorMessage(verificationMode === 'totp'
        ? 'El código no es válido o ha caducado. Comprueba tu app autenticadora e inténtalo otra vez.'
        : 'El código de recuperación no es válido, ya se utilizó o no está habilitado. Comprueba el código e inténtalo otra vez.')
      setCode('')
    } finally {
      setBusy(false)
    }
  }

  return <main className="mfa-gate"><form className="mfa-gate-card" onSubmit={(event) => void verifyCode(event)}><span className="module-preview-icon"><ShieldCheck size={20} /></span><span className="section-kicker">VERIFICACIÓN EN DOS PASOS</span><h1>Confirma que eres tú.</h1><p>{verificationMode === 'totp' ? 'Introduce el código actual de seis cifras de tu app autenticadora.' : 'Introduce uno de tus códigos de recuperación no utilizados.'}</p>
    {factorId && <div className="mfa-mode-switch"><button type="button" className={verificationMode === 'totp' ? 'mfa-mode-active' : ''} onClick={() => { setVerificationMode('totp'); setCode(''); setErrorMessage('') }}>App autenticadora</button><button type="button" className={verificationMode === 'recovery' ? 'mfa-mode-active' : ''} onClick={() => { setVerificationMode('recovery'); setCode(''); setErrorMessage('') }}>Código de recuperación</button></div>}
    <label><span>{verificationMode === 'totp' ? 'Código TOTP' : 'Código de recuperación'}</span><input autoFocus inputMode={verificationMode === 'totp' ? 'numeric' : 'text'} autoComplete={verificationMode === 'totp' ? 'one-time-code' : 'off'} pattern={verificationMode === 'totp' ? '[0-9]{6}' : undefined} maxLength={verificationMode === 'totp' ? 6 : 40} value={code} onChange={(event) => setCode(verificationMode === 'totp' ? event.target.value.replace(/\D/g, '').slice(0, 6) : event.target.value)} /></label>{errorMessage && <p className="profile-feedback-error" role="alert">{errorMessage}</p>}<button className="action-primary" type="submit" disabled={loading || busy || (verificationMode === 'totp' ? !factorId || code.length !== 6 : !code.trim())}>{loading ? 'Cargando…' : busy ? 'Verificando…' : 'Verificar y continuar'}</button></form></main>
}