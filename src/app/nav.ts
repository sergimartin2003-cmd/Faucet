import { Award, BarChart3, CircleHelp, Gift, History, LayoutDashboard, ListChecks, Settings, ShieldCheck, Trophy, User, Users, type LucideIcon } from 'lucide-react'

export type NavItem = { slug: string; label: string; icon: LucideIcon; title: string }

export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  { label: 'Principal', items: [
    { slug: '', label: 'Resumen', icon: LayoutDashboard, title: 'Resumen' },
    { slug: 'faucet', label: 'Faucet diario', icon: Gift, title: 'Faucet diario' },
    { slug: 'tareas', label: 'Tareas', icon: ListChecks, title: 'Tareas' },
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
export const pathFor = (slug: string) => (slug ? `/dashboard/${slug}` : '/dashboard')
export const slugFromPath = (pathname: string) => pathname.replace(/^\/dashboard\/?/, '').replace(/\/$/, '')

export const LEGACY_SECTIONS: Record<string, string> = {
  Perfil: 'perfil', Seguridad: 'seguridad', Ajustes: 'ajustes', Historial: 'historial', Referidos: 'referidos',
  Faucets: 'faucet', Tareas: 'tareas', Temporada: 'temporada', Mercados: 'mercados', Resumen: '',
}
