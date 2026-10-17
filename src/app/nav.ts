import { ArrowUpFromLine, Award, Droplets, BadgeCheck, BarChart3, CircleHelp, ClipboardList, Dices, History, LayoutDashboard, Landmark, Receipt, Settings, ShieldCheck, Trophy, User, Users, type LucideIcon } from 'lucide-react'
import { GAME_SLUGS, gameLabel, type CasinoGame } from '../lib/casino'
import { t } from '../lib/i18n'
import { bitlabsToken } from '../lib/site'

export type NavItem = { slug: string; label: string; icon: LucideIcon; title: string }

// Functions, not constants: labels are translated when the shell renders.
export const navGroups = (): { label: string; items: NavItem[]; adminOnly?: boolean }[] => [
  { label: t('Principal'), items: [
    { slug: '', label: t('Resumen'), icon: LayoutDashboard, title: t('Resumen') },
    { slug: 'retirar', label: t('Retirar'), icon: ArrowUpFromLine, title: t('Retirar') },
  ] },
  { label: t('Ganar'), items: [
    ...(bitlabsToken ? [{ slug: 'ofertas', label: t('Ofertas y encuestas'), icon: ClipboardList, title: t('Ofertas y encuestas') }] : []),
    { slug: 'referidos', label: t('Referidos'), icon: Users, title: t('Referidos') },
  ] },
  { label: t('Crear'), items: [
    { slug: 'faucets', label: t('Mis faucets'), icon: Droplets, title: t('Mis faucets') },
  ] },
  { label: t('Casino'), items: [
    { slug: 'casino', label: t('Juegos'), icon: Dices, title: t('Casino') },
    { slug: 'casino/apuestas', label: t('Mis apuestas'), icon: Receipt, title: t('Mis apuestas') },
    { slug: 'casino/juego-justo', label: t('Juego justo'), icon: BadgeCheck, title: t('Juego justo') },
  ] },
  { label: t('Progreso'), items: [
    { slug: 'temporada', label: t('Temporada'), icon: Trophy, title: t('Temporada') },
    { slug: 'logros', label: t('Logros'), icon: Award, title: t('Logros') },
    { slug: 'historial', label: t('Historial'), icon: History, title: t('Historial de puntos') },
  ] },
  { label: t('Explorar'), items: [
    { slug: 'mercados', label: t('Mercados'), icon: BarChart3, title: t('Mercados') },
  ] },
  { label: t('Cuenta'), items: [
    { slug: 'perfil', label: t('Perfil'), icon: User, title: t('Perfil') },
    { slug: 'seguridad', label: t('Seguridad'), icon: ShieldCheck, title: t('Seguridad') },
    { slug: 'ajustes', label: t('Ajustes'), icon: Settings, title: t('Ajustes') },
    { slug: 'ayuda', label: t('Ayuda'), icon: CircleHelp, title: t('Ayuda') },
  ] },
  { label: t('Administración'), adminOnly: true, items: [
    { slug: 'admin', label: t('Retiros'), icon: Landmark, title: t('Administración') },
  ] },
]

export const navItems = () => navGroups().flatMap((group) => group.items)

// Game pages live under /dashboard/casino/<game> and are reached from the lobby.
const CASINO_GAMES = Object.keys(GAME_SLUGS) as CasinoGame[]
export const casinoGameItems = (): NavItem[] => CASINO_GAMES.map((game) => ({
  slug: `casino/${GAME_SLUGS[game]}`, label: gameLabel(game), icon: Dices, title: `${gameLabel(game)} · ${t('Casino')}`,
}))

// Sidebar entry that should look active for a given page.
export const navSlugFor = (slug: string) => (CASINO_GAMES.some((game) => slug === `casino/${GAME_SLUGS[game]}`) ? 'casino' : slug)
export const pathFor = (slug: string) => (slug ? `/dashboard/${slug}` : '/dashboard')
export const slugFromPath = (pathname: string) => pathname.replace(/^\/dashboard\/?/, '').replace(/\/$/, '')

export const LEGACY_SECTIONS: Record<string, string> = {
  Perfil: 'perfil', Seguridad: 'seguridad', Ajustes: 'ajustes', Historial: 'historial', Referidos: 'referidos',
  Faucets: 'ofertas', Encuestas: 'ofertas', Tareas: 'ofertas', Temporada: 'temporada', Mercados: 'mercados', Resumen: '',
}
