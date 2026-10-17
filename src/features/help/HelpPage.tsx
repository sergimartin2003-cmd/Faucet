import { Card, CardHeader, PageHeader } from '../../ui'
import { contactEmail, siteName } from '../../lib/site'
import Link from '../../lib/Link'
import { t } from '../../lib/i18n'

// Built on render so it follows the current language.
const faq = (): { q: string; a: string }[] => [
  { q: t('¿Cuánto valen los puntos?'), a: t('En {site}, 1.000 puntos equivalen a 1 $. Puedes retirarlos en criptomonedas desde la sección Retirar a partir de 5.000 puntos (5 $).', { site: siteName }) },
  { q: t('¿Cómo gano puntos?'), a: t('Completando las encuestas y ofertas de nuestro socio BitLabs en Ofertas y encuestas, e invitando a amigos. Cada encuesta u oferta indica su recompensa antes de empezar; lo que hay disponible depende de tu país y tu perfil.') },
  { q: t('¿Cuándo recibo los puntos de una oferta?'), a: t('Cuando BitLabs confirma que la has completado, normalmente en unos minutos. Algunas ofertas tardan más en confirmarse y BitLabs puede rechazar tareas incompletas.') },
  { q: t('¿Por qué me han descontado puntos?'), a: t('Si BitLabs anula una encuesta u oferta después de pagarla (por ejemplo, porque no se completó correctamente), sus puntos se descuentan de tu saldo.') },
  { q: t('¿Cómo retiro?'), a: t('En Retirar eliges la moneda (USDT BEP20, Binance Pay, Litecoin, TRON o Dogecoin), indicas tu dirección o Pay ID y la cantidad. Revisamos cada solicitud a mano y la pagamos normalmente en menos de 48 horas. Solo puedes tener un retiro pendiente a la vez.') },
  { q: t('¿Qué pasa si me equivoco de dirección?'), a: t('Los envíos en blockchain no se pueden deshacer. Comprueba que la dirección es de la red indicada antes de solicitar el retiro. Con Binance Pay basta tu Pay ID y no hay comisiones.') },
  { q: t('¿Por qué me han rechazado un retiro?'), a: t('Normalmente por datos de destino incorrectos o por incumplir las normas (varias cuentas, VPN, bots o fraude en las ofertas). Si se rechaza por un error, los puntos vuelven a tu saldo.') },
  { q: t('¿Qué es el nivel?'), a: t('Subes un nivel por cada 1.000 puntos ganados con ofertas, encuestas y referidos. El casino no cuenta.') },
  { q: t('¿Cómo funcionan los referidos?'), a: t('Recibes 100 puntos cuando una persona que se registró con tu enlace completa su primera oferta o encuesta, hasta 20 referidos. El código solo puede aplicarse durante los primeros 7 días de una cuenta nueva.') },
  { q: t('¿Qué es la clasificación mensual?'), a: t('Ordena a los usuarios por los puntos ganados durante el mes en curso (UTC). Puedes salir de ella o aparecer de forma anónima desde Ajustes.') },
  { q: t('¿Es obligatoria la verificación en dos pasos?'), a: t('No, pero la recomendamos para proteger tu saldo. Si la activas, se te pedirá un código al iniciar sesión. Guarda tus códigos de recuperación.') },
  { q: t('¿Cómo funciona el casino?'), a: t('Hay doce juegos (dados, crash, minas, plinko, blackjack, ruleta, tragaperras, limbo, hi-lo, keno, rueda y cara o cruz) que se juegan con tus puntos, que tienen valor real. Solo para mayores de 18 años: juega con responsabilidad. Las jugadas no cuentan para el nivel ni para la clasificación.') },
  { q: t('¿Cómo sé que el casino no hace trampa?'), a: t('Cada resultado sale de tu semilla de cliente, una semilla secreta del servidor (de la que ves el hash antes de jugar) y un contador. Al cambiar las semillas en Juego justo se revela la anterior y puedes recalcular cualquier jugada en tu navegador.') },
  { q: t('¿Cómo elimino mi cuenta?'), a: t('Desde Ajustes, en la sección Eliminar cuenta. Se borran de forma permanente todos tus datos y tu saldo, así que retira antes tus puntos.') },
]

export default function HelpPage() {
  return <>
    <PageHeader title={t('Ayuda')} description={t('Preguntas frecuentes y cómo contactar con nosotros.')} />
    <Card>
      <CardHeader title={t('Preguntas frecuentes')} />
      <div className="faq">{faq().map((item) => <details key={item.q}><summary>{item.q}</summary><p>{item.a}</p></details>)}</div>
    </Card>
    <Card>
      <CardHeader title={t('Contacto y documentos')} />
      <p className="muted">{contactEmail ? <>{t('¿Necesitas ayuda? Escríbenos a')} <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.</> : t('Para cualquier consulta sobre tu cuenta, contacta con el equipo responsable del servicio.')}</p>
      <div className="row" style={{ marginTop: 'var(--space-3)' }}><Link to="/terminos">{t('Términos de uso')}</Link><Link to="/privacidad">{t('Política de privacidad')}</Link></div>
    </Card>
  </>
}
