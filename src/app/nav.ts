import { Award, BadgeCheck, BarChart3, CircleHelp, ClipboardList, Dices, Gift, History, LayoutDashboard, ListChecks, MonitorPlay, Receipt, Wallet, Settings, ShieldCheck, Sparkles, Ticket, Trophy, User, Users, type LucideIcon } from 'lucide-react'
import { GAME_LABELS, GAME_SLUGS, type CasinoGame } from '../lib/casino'
import { bitlabsToken } from '../lib/site'

export type NavItem = { slug: string; label: string; icon: LucideIcon; title: string }

export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  { label: 'Principal', items: [
    { slug: '', label: 'Resumen', icon: LayoutDashboard, title: 'Resumen' },
    { slug: 'faucet', label: 'Faucet diario', icon: Gift, title: 'Faucet diario' },
  ] },
  { label: 'Ganar', items: [
    { slug: 'encuestas', label: 'Encuestas', icon: ClipboardList, title: 'Encuestas' },
    { slug: 'videos', label: 'Vídeos', icon: MonitorPlay, title: 'Ver vídeos' },
    { slug: 'trivia', label: 'Trivia diaria', icon: Sparkles, title: 'Trivia diaria' },
    { slug: 'rasca', label: 'Rasca y gana', icon: Ticket, title: 'Rasca y gana' },
    { slug: 'tareas', label: 'Tareas', icon: ListChecks, title: 'Tareas' },
    ...(bitlabsToken ? [{ slug: 'ofertas', label: 'Ofertas y encuestas', icon: Wallet, title: 'Ofertas y encuestas' }] : []),
  ] },
  { label: 'Casino', items: [
    { slug: 'casino', label: 'Juegos', icon: Dices, title: 'Casino' },
    { slug: 'casino/apuestas', label: 'Mis apuestas', icon: Receipt, title: 'Mis apuestas' },
    { slug: 'casino/juego-justo', label: 'Juego justo', icon: BadgeCheck, title: 'Juego justo' },
  ] },
  { label: 'Progreso', items: [
    { slug: 'temporada', label: 'Temporada', icon: Trophy, title: 'Temporada' },
    { slug: 'logros', label: 'Logros', icon: Award, title: 'Logros' },
    { slug: 'referidos', label: 'Referidos', icon: Users, title: 'Referidos' },
    { slug: 'historial', label: 'Historial', icon: History, title: 'Historial de puntos' },
  ] },
  { label: 'Explorar', items: [
    { slug: 'mercados', label: 'Mercados', icon: BarChart3, title: 'Mercados' },
  ] },
  { label: 'Cuenta', items: [
    { slug: 'perfil', label: 'Perfil', icon: User, title: 'Perfil' },
    { slug: 'seguridad', label: 'Seguridad', icon: ShieldCheck, title: 'Seguridad' },
    { slug: 'ajustes', label: 'Ajustes', icon: Settings, title: 'Ajustes' },
    { slug: 'ayuda', label: 'Ayuda', icon: CircleHelp, title: 'Ayuda' },
  ] },
]

export const NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items)

// Game pages live under /dashboard/casino/<game> and are reached from the lobby.
export const CASINO_GAME_ITEMS: NavItem[] = (Object.keys(GAME_SLUGS) as CasinoGame[]).map((game) => ({
  slug: `casino/${GAME_SLUGS[game]}`, label: GAME_LABELS[game], icon: Dices, title: `${GAME_LABELS[game]} · Casino`,
}))

// Sidebar entry that should look active for a given page.
export const navSlugFor = (slug: string) => (CASINO_GAME_ITEMS.some((item) => item.slug === slug) ? 'casino' : slug)
export const pathFor = (slug: string) => (slug ? `/dashboard/${slug}` : '/dashboard')
export const slugFromPath = (pathname: string) => pathname.replace(/^\/dashboard\/?/, '').replace(/\/$/, '')

export const LEGACY_SECTIONS: Record<string, string> = {
  Perfil: 'perfil', Seguridad: 'seguridad', Ajustes: 'ajustes', Historial: 'historial', Referidos: 'referidos',
  Faucets: 'faucet', Encuestas: 'encuestas', Tareas: 'tareas', Temporada: 'temporada', Mercados: 'mercados', Resumen: '',
}
