import { Suspense, lazy, useEffect } from 'react'
import { usePathname } from './lib/router'
import { siteName } from './lib/site'
import { t } from './lib/i18n'
import Link from './lib/Link'
import LandingPage from './landing/LandingPage'

const LegalPage = lazy(() => import('./landing/LegalPage'))
const SessionGate = lazy(() => import('./app/SessionGate'))
const Dashboard = lazy(() => import('./app/Dashboard'))

function NotFound() {
  useEffect(() => { document.title = `${t('Página no encontrada')} · ${siteName}` }, [])
  return <main className="not-found" style={{ minHeight: '100dvh' }}>
    <h1>{t('Página no encontrada')}</h1>
    <p>{t('La dirección que buscas no existe o se ha movido.')}</p>
    <Link to="/" className="btn btn-primary">{t('Volver al inicio')}</Link>
  </main>
}

export default function App() {
  const pathname = usePathname().replace(/\/+$/, '') || '/'
  return <Suspense fallback={<div className="route-loading" role="status" aria-label={t('Cargando')} />}>
    {pathname === '/' ? <LandingPage />
      : pathname === '/terminos' ? <LegalPage kind="terms" />
        : pathname === '/privacidad' ? <LegalPage kind="privacy" />
          : pathname === '/dashboard' || pathname.startsWith('/dashboard/') ? <SessionGate><Dashboard /></SessionGate>
            : <NotFound />}
  </Suspense>
}
