import { Card, CardHeader, PageHeader } from '../../ui'
import { contactEmail, siteName } from '../../lib/site'
import Link from '../../lib/Link'

const FAQ: { q: string; a: string }[] = [
  { q: '¿Qué son los puntos?', a: `Los puntos son recompensas promocionales internas de ${siteName}. No son dinero, no se pueden retirar ni canjear por dinero y no tienen valor fuera de la aplicación.` },
  { q: '¿Cuántos puntos recibo cada día?', a: 'La reclamación diaria da 10 puntos y suma 2 más por cada día consecutivo de racha, hasta un máximo de 22 puntos al día.' },
  { q: '¿Cómo funciona la racha?', a: 'Reclama al menos una vez cada 48 horas para mantenerla. Si pasa más tiempo, la racha vuelve a empezar. Tu mejor racha se conserva en tu historial.' },
  { q: '¿Cada cuánto puedo reclamar?', a: 'Una vez cada 24 horas desde tu última reclamación. El tiempo restante aparece en el panel de Faucet.' },
  { q: '¿Por qué no puedo reclamar?', a: 'Necesitas haber verificado tu correo electrónico. Si el correo no te llega, revisa la carpeta de spam o vuelve a solicitarlo desde el inicio de sesión.' },
  { q: '¿Qué es el nivel?', a: 'Cada punto acumulado equivale a 1 XP y subes de nivel cada 100 XP. El nivel es solo una referencia de tu progreso.' },
  { q: '¿Cómo funcionan los referidos?', a: 'Recibes 15 puntos por cada persona que se registre con tu enlace y complete su perfil, hasta 20 referidos. El código solo puede aplicarse durante los primeros 7 días de una cuenta nueva.' },
  { q: '¿Qué es la clasificación mensual?', a: 'Ordena a los usuarios por los puntos ganados durante el mes en curso (UTC). Puedes salir de ella o aparecer de forma anónima desde Ajustes.' },
  { q: '¿Es obligatoria la verificación en dos pasos?', a: 'No, pero la recomendamos y otorga una tarea con recompensa. Si la activas, se te pedirá un código al iniciar sesión. Guarda tus códigos de recuperación.' },
  { q: '¿Cómo elimino mi cuenta?', a: 'Desde Ajustes, en la sección Eliminar cuenta. Se borran de forma permanente todos tus datos y puntos.' },
]

export default function HelpPage() {
  return <>
    <PageHeader title="Ayuda" description="Preguntas frecuentes y cómo contactar con nosotros." />
    <Card>
      <CardHeader title="Preguntas frecuentes" />
      <div className="faq">{FAQ.map((item) => <details key={item.q}><summary>{item.q}</summary><p>{item.a}</p></details>)}</div>
    </Card>
    <Card>
      <CardHeader title="Contacto y documentos" />
      <p className="muted">{contactEmail ? <>¿Necesitas ayuda? Escríbenos a <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.</> : 'Para cualquier consulta sobre tu cuenta, contacta con el equipo responsable del servicio.'}</p>
      <div className="row" style={{ marginTop: 'var(--space-3)' }}><Link to="/terminos">Términos de uso</Link><Link to="/privacidad">Política de privacidad</Link></div>
    </Card>
  </>
}
