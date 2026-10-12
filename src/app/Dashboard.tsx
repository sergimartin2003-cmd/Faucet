import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Gift, LogOut, Eye, EyeOff, Menu, Settings, User as UserIcon, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { navigate, usePathname } from '../lib/router'
import Link from '../lib/Link'
import { useAccountPrefs } from '../lib/accountPrefs'
import { useFaucetReminder } from '../lib/faucetReminder'
import { formatPoints } from '../lib/game'
import { Avatar, Skeleton } from '../ui'
import ToastProvider from '../ui/ToastProvider'
import { useFaucetStatus } from '../features/faucet/useFaucetStatus'
import { NAV_GROUPS, NAV_ITEMS, LEGACY_SECTIONS, pathFor, slugFromPath } from './nav'
import { PrivacyContext, useSessionUser, usePrivacy } from './sessionContext'
import './app.css'

const pages: Record<string, ReturnType<typeof lazy>> = {
  '': lazy(() => import('../features/overview/OverviewPage')),
  faucet: lazy(() => import('../features/faucet/FaucetPage')),
  tareas: lazy(() => import('../features/tasks/TasksPage')),
  temporada: lazy(() => import('../features/season/SeasonPage')),
  logros: lazy(() => import('../features/achievements/AchievementsPage')),
  referidos: lazy(() => import('../features/referrals/ReferralsPage')),
  historial: lazy(() => import('../features/history/HistoryPage')),
  mercados: lazy(() => import('../features/markets/MarketsPage')),
  perfil: lazy(() => import('../features/profile/ProfilePage')),
  seguridad: lazy(() => import('../features/security/SecurityPage')),
  ajustes: lazy(() => import('../features/settings/SettingsPage')),
  ayuda: lazy(() => import('../features/help/HelpPage')),
}

export default function Dashboard() {
  const { prefs } = useAccountPrefs()
  const [hiddenOverride, setHiddenOverride] = useState<boolean | null>(null)
  const hidden = hiddenOverride ?? prefs.hideBalance
  const privacy = useMemo(() => ({ hidden, toggle: () => setHiddenOverride(!hidden) }), [hidden])

  return <ToastProvider>
    <PrivacyContext.Provider value={privacy}>
      <Shell />
    </PrivacyContext.Provider>
  </ToastProvider>
}

function Shell() {
  const pathname = usePathname()
  const slug = slugFromPath(pathname)
  const { prefs } = useAccountPrefs()
  const [menuOpen, setMenuOpen] = useState(false)
  const activeItem = NAV_ITEMS.find((item) => item.slug === slug)
  const Page = pages[slug]

  useFaucetReminder(prefs.notifyFaucetReady)

  useEffect(() => {
    const section = new URLSearchParams(window.location.search).get('section')
    if (slug === '' && section && section in LEGACY_SECTIONS) navigate(pathFor(LEGACY_SECTIONS[section]), { replace: true })
  }, [slug])

  useEffect(() => {
    document.title = `${activeItem?.title ?? 'No encontrado'} · Faucet`
  }, [activeItem])

  useEffect(() => {
    const close = () => setMenuOpen(false)
    window.addEventListener('popstate', close)
    return () => window.removeEventListener('popstate', close)
  }, [])

  const signOut = async () => {
    await supabase?.auth.signOut({ scope: 'local' })
    navigate('/', { replace: true })
  }

  return <div className={`shell${menuOpen ? ' sidebar-open' : ''}`}>
    <aside className="sidebar" aria-label="Navegación principal">
      <div className="row-between" style={{ flexWrap: 'nowrap' }}>
        <Link to="/" className="brand"><img className="brand-mark" src="/favicon.svg" alt="" />Faucet</Link>
        <button className="icon-button menu-button" aria-label="Cerrar menú" onClick={() => setMenuOpen(false)}><X size={18} /></button>
      </div>
      <nav className="nav">
        {NAV_GROUPS.map((group) => <div className="nav-group" key={group.label}>
          <span className="nav-label">{group.label}</span>
          {group.items.map((item) => <Link key={item.slug} to={pathFor(item.slug)} className="nav-link" aria-current={item.slug === slug ? 'page' : undefined} onClick={() => setMenuOpen(false)}><item.icon size={16} />{item.label}</Link>)}
        </div>)}
      </nav>
      <div className="sidebar-foot">
        <button className="nav-link" style={{ border: 0, background: 'none', width: '100%' }} onClick={() => void signOut()}><LogOut size={16} />Cerrar sesión</button>
      </div>
    </aside>
    <div className="sidebar-backdrop" onClick={() => setMenuOpen(false)} />
    <div className="main">
      <Topbar title={activeItem?.title ?? 'No encontrado'} onMenu={() => setMenuOpen(true)} onSignOut={() => void signOut()} />
      <main className="content" id="contenido">
        <Suspense fallback={<PageSkeleton />}>
          {Page ? <Page /> : <NotFound />}
        </Suspense>
      </main>
    </div>
  </div>
}

function PageSkeleton() {
  return <div className="stack" aria-busy="true">
    <Skeleton width={220} height={30} />
    <div className="grid-stats">{[0, 1, 2, 3].map((key) => <Skeleton key={key} height={96} style={{ borderRadius: 12 }} />)}</div>
    <Skeleton height={220} style={{ borderRadius: 12 }} />
  </div>
}

function NotFound() {
  return <div className="not-found">
    <h1>Página no encontrada</h1>
    <p className="muted">La sección que buscas no existe o se ha movido.</p>
    <Link to="/dashboard" className="btn btn-primary">Volver al resumen</Link>
  </div>
}

function Topbar({ title, onMenu, onSignOut }: { title: string; onMenu: () => void; onSignOut: () => void }) {
  const user = useSessionUser()
  const { prefs } = useAccountPrefs()
  const { hidden, toggle } = usePrivacy()
  const faucet = useFaucetStatus()
  const [open, setOpen] = useState(false)
  const name = prefs.displayName || user?.email.split('@')[0] || 'Cuenta'

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !(event.target as Element).closest('.user-menu')) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close) }
  }, [open])

  return <header className="topbar">
    <button className="icon-button menu-button" aria-label="Abrir menú" onClick={onMenu}><Menu size={18} /></button>
    <div className="topbar-title">{title}</div>
    {faucet.available && <Link to="/dashboard/faucet" className="badge badge-success"><span className="ready-dot" />Faucet listo</Link>}
    <div className="balance-chip" title="Saldo de puntos">
      <span>Puntos</span>
      {faucet.isLoading ? <Skeleton width={36} height={14} /> : hidden ? '•••' : faucet.points === null ? '—' : formatPoints(faucet.points)}
      <button className="icon-button" style={{ width: 22, height: 22 }} aria-label={hidden ? 'Mostrar saldo' : 'Ocultar saldo'} onClick={toggle}>{hidden ? <EyeOff size={14} /> : <Eye size={14} />}</button>
    </div>
    <div className="user-menu">
      <button className="user-trigger" aria-haspopup="menu" aria-expanded={open} aria-label="Menú de cuenta" onClick={() => setOpen(!open)}><Avatar name={name} color={prefs.avatarColor} /></button>
      {open && <div className="menu" role="menu">
        <div className="menu-head"><strong>{name}</strong><span>{user?.email ?? 'Modo desarrollo'}</span></div>
        <Link to="/dashboard/perfil" className="menu-item" role="menuitem" onClick={() => setOpen(false)}><UserIcon size={16} />Perfil</Link>
        <Link to="/dashboard/ajustes" className="menu-item" role="menuitem" onClick={() => setOpen(false)}><Settings size={16} />Ajustes</Link>
        <Link to="/dashboard/faucet" className="menu-item" role="menuitem" onClick={() => setOpen(false)}><Gift size={16} />Faucet diario</Link>
        <button className="menu-item" role="menuitem" onClick={onSignOut}><LogOut size={16} />Cerrar sesión</button>
      </div>}
    </div>
  </header>
}
