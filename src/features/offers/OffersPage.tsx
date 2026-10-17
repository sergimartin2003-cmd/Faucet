import { ExternalLink } from 'lucide-react'
import { Alert, Card, EmptyState, PageHeader } from '../../ui'
import { useSessionUser } from '../../app/sessionContext'
import { bitlabsToken } from '../../lib/site'

export default function OffersPage() {
  const user = useSessionUser()
  const src = user && bitlabsToken ? `https://web.bitlabs.ai/?uid=${encodeURIComponent(user.id)}&token=${encodeURIComponent(bitlabsToken)}` : null

  return <>
    <PageHeader title="Ofertas y encuestas" description="Encuestas remuneradas y ofertas de nuestro socio BitLabs. Los puntos se acreditan automáticamente cuando el proveedor confirma la tarea." />
    {user && !user.emailConfirmed && <Alert tone="warning">Confirma tu correo electrónico para empezar a completar ofertas.</Alert>}
    {!src ? <Card><EmptyState icon={<ExternalLink size={20} />} title="Ofertas no disponibles" description="Las ofertas todavía no están activadas en esta web." /></Card>
      : <Card pad={false}>
        <iframe
          src={src}
          title="Ofertas y encuestas de BitLabs"
          style={{ display: 'block', width: '100%', height: 'min(80vh, 900px)', border: 0, borderRadius: 'inherit' }}
          allow="clipboard-write"
        />
      </Card>}
    <p className="muted" style={{ fontSize: 'var(--text-xs)' }}>
      Las ofertas las gestiona BitLabs. La acreditación puede tardar unos minutos y el proveedor puede rechazar tareas incompletas o fraudulentas. Los puntos no tienen valor monetario.
    </p>
  </>
}
