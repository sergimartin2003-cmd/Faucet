import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { ArrowUpFromLine, LogOut, Eye, EyeOff, Menu, Settings, User as UserIcon, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { navigate, usePathname } from '../lib/router'
import Link from '../lib/Link'
import { siteName } from '../lib/site'
import { useAccountPrefs } from '../lib/accountPrefs'
import { formatPoints } from '../lib/game'
import { useIsAdmin } from '../lib/queries'
import { Avatar, Skeleton } from '../ui'
import ToastProvider from '../ui/ToastProvider'
import AdSlot from '../components/AdSlot'
import LangSwitch from '../components/LangSwitch'
import { t } from '../lib/i18n'
import { useFaucetStatus } from '../features/faucet/useFaucetStatus'
import { LEGACY_SECTIONS, casinoGameItems, navGroups, navItems, navSlugFor, pathFor, slugFromPath } from './nav'
import { PrivacyContext, useSessionUser, usePrivacy } from './sessionContext'
import './app.css'

const pages: Record<string, ReturnType<typeof lazy>> = {
  '': lazy(() => import('../features/overview/OverviewPage')),
  retirar: lazy(() => import('../features/withdraw/WithdrawPage')),
  admin: lazy(() => import('../features/admin/AdminPage')),
  temporada: lazy(() => import('../features/season/SeasonPage')),
  logros: lazy(() => import('../features/achievements/AchievementsPage')),
  referidos: lazy(() => import('../features/referrals/ReferralsPage')),
  historial: lazy(() => import('../features/history/HistoryPage')),
  mercados: lazy(() => import('../features/markets/MarketsPage')),
  perfil: lazy(() => import('../features/profile/ProfilePage')),
  seguridad: lazy(() => import('../features/security/SecurityPage')),
  ajustes: lazy(() => import('../features/settings/SettingsPage')),
  ayuda: lazy(() => import('../features/help/HelpPage')),
  ofertas: lazy(() => import('../features/offers/OffersPage')),
  casino: lazy(() => import('../features/casino/CasinoLobby')),
  'casino/apuestas': lazy(() => import('../features/casino/CasinoHistoryPage')),
  'casino/juego-justo': lazy(() => import('../features/casino/FairnessPage')),
  'casino/dados': lazy(() => import('../features/casino/DicePage')),
  'casino/limbo': lazy(() => import('../features/casino/LimboPage')),
  'casino/crash': lazy(() => import('../features/casino/CrashPage')),
  'casino/cara-o-cruz': lazy(() => import('../features/casino/CoinflipPage')),
  'casino/ruleta': lazy(() => import('../features/casino/RoulettePage')),
  'casino/tragaperras': lazy(() => import('../features/casino/SlotsPage')),
  'casino/plinko': lazy(() => import('../features/casino/PlinkoPage')),
  'casino/keno': lazy(() => import('../features/casino/KenoPage')),
  'casino/rueda': lazy(() => import('../features/casino/WheelPage')),
  'casino/minas': lazy(() => import('../features/casino/MinesPage')),
  'casino/hi-lo': lazy(() => import('../features/casino/HiloPage')),
  'casino/blackjack': lazy(() => import('../features/casino/BlackjackPage')),
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
  const isAdmin = useIsAdmin().data === true
  const [menuOpen, setMenuOpen] = useState(false)
  const activeItem = navItems().find((item) => item.slug === slug) ?? casinoGameItems().find((item) => item.slug === slug)
  const navSlug = navSlugFor(slug)
  const Page = pages[slug]

  useEffect(() => {
    const section = new URLSearchParams(window.location.search).get('section')
    if (slug === '' && section && section in LEGACY_SECTIONS) navigate(pathFor(LEGACY_SECTIONS[section]), { replace: true })
  }, [slug])

  const title = activeItem?.title ?? t('No encontrado')
  useEffect(() => {
    document.title = `${title} · ${siteName}`
  }, [title])

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
    <aside className="sidebar" aria-label={t('Navegación principal')}>
      <div className="row-between" style={{ flexWrap: 'nowrap' }}>
        <Link to="/" className="brand"><img className="brand-mark" src="/favicon.svg" alt="" />{siteName}</Link>
        <button className="icon-button menu-button" aria-label={t('Cerrar menú')} onClick={() => setMenuOpen(false)}><X size={18} /></button>
      </div>
      <nav className="nav">
        {navGroups().filter((group) => !group.adminOnly || isAdmin).map((group) => <div className="nav-group" key={group.label}>
          <span className="nav-label">{group.label}</span>
          {group.items.map((item) => <Link key={item.slug} to={pathFor(item.slug)} className="nav-link" aria-current={item.slug === navSlug ? 'page' : undefined} onClick={() => setMenuOpen(false)}><item.icon size={16} />{item.label}</Link>)}
        </div>)}
      </nav>
      <div className="sidebar-foot">
        <button className="nav-link" style={{ border: 0, background: 'none', width: '100%' }} onClick={() => void signOut()}><LogOut size={16} />{t('Cerrar sesión')}</button>
      </div>
    </aside>
    <div className="sidebar-backdrop" onClick={() => setMenuOpen(false)} />
    <div className="main">
      <Topbar title={title} onMenu={() => setMenuOpen(true)} onSignOut={() => void signOut()} />
      <main className="content" id="contenido">
        <Suspense fallback={<PageSkeleton />}>
          {Page ? <Page /> : <NotFound />}
        </Suspense>
        <AdSlot className="ad-slot-dashboard" />
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
    <h1>{t('Página no encontrada')}</h1>
    <p className="muted">{t('La sección que buscas no existe o se ha movido.')}</p>
    <Link to="/dashboard" className="btn btn-primary">{t('Volver al resumen')}</Link>
  </div>
}

function Topbar({ title, onMenu, onSignOut }: { title: string; onMenu: () => void; onSignOut: () => void }) {
  const user = useSessionUser()
  const { prefs } = useAccountPrefs()
  const { hidden, toggle } = usePrivacy()
  const faucet = useFaucetStatus()
  const [open, setOpen] = useState(false)
  const name = prefs.displayName || user?.email.split('@')[0] || t('Cuenta')

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
    <button className="icon-button menu-button" aria-label={t('Abrir menú')} onClick={onMenu}><Menu size={18} /></button>
    <div className="topbar-title">{title}</div>
    <LangSwitch />
    <div className="balance-chip" title={t('Saldo de puntos')}>
      <span>{t('Puntos')}</span>
      {faucet.isLoading ? <Skeleton width={36} height={14} /> : hidden ? '•••' : faucet.points === null ? '—' : formatPoints(faucet.points)}
      <button className="icon-button" style={{ width: 22, height: 22 }} aria-label={hidden ? t('Mostrar saldo') : t('Ocultar saldo')} onClick={toggle}>{hidden ? <EyeOff size={14} /> : <Eye size={14} />}</button>
    </div>
    <div className="user-menu">
      <button className="user-trigger" aria-haspopup="menu" aria-expanded={open} aria-label={t('Menú de cuenta')} onClick={() => setOpen(!open)}><Avatar name={name} color={prefs.avatarColor} /></button>
      {open && <div className="menu" role="menu">
        <div className="menu-head"><strong>{name}</strong><span>{user?.email ?? t('Modo desarrollo')}</span></div>
        <Link to="/dashboard/perfil" className="menu-item" role="menuitem" onClick={() => setOpen(false)}><UserIcon size={16} />{t('Perfil')}</Link>
        <Link to="/dashboard/ajustes" className="menu-item" role="menuitem" onClick={() => setOpen(false)}><Settings size={16} />{t('Ajustes')}</Link>
        <Link to="/dashboard/retirar" className="menu-item" role="menuitem" onClick={() => setOpen(false)}><ArrowUpFromLine size={16} />{t('Retirar')}</Link>
        <button className="menu-item" role="menuitem" onClick={onSignOut}><LogOut size={16} />{t('Cerrar sesión')}</button>
      </div>}
    </div>
  </header>
}
