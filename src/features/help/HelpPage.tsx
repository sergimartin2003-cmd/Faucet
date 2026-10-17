import { Card, CardHeader, PageHeader } from '../../ui'
import { contactEmail, siteName } from '../../lib/site'
import Link from '../../lib/Link'

const FAQ: { q: string; a: string }[] = [
  { q: '¿Cuánto valen los puntos?', a: `En ${siteName}, 1.000 puntos equivalen a 1 $. Puedes retirarlos en criptomonedas desde la sección Retirar a partir de 5.000 puntos (5 $).` },
  { q: '¿Cómo gano puntos?', a: 'Completando las encuestas y ofertas de nuestro socio BitLabs en Ofertas y encuestas, e invitando a amigos. Cada encuesta u oferta indica su recompensa antes de empezar; lo que hay disponible depende de tu país y tu perfil.' },
  { q: '¿Cuándo recibo los puntos de una oferta?', a: 'Cuando BitLabs confirma que la has completado, normalmente en unos minutos. Algunas ofertas tardan más en confirmarse y BitLabs puede rechazar tareas incompletas.' },
  { q: '¿Por qué me han descontado puntos?', a: 'Si BitLabs anula una encuesta u oferta después de pagarla (por ejemplo, porque no se completó correctamente), sus puntos se descuentan de tu saldo.' },
  { q: '¿Cómo retiro?', a: 'En Retirar eliges la moneda (USDT BEP20, Binance Pay, Litecoin, TRON o Dogecoin), indicas tu dirección o Pay ID y la cantidad. Revisamos cada solicitud a mano y la pagamos normalmente en menos de 48 horas. Solo puedes tener un retiro pendiente a la vez.' },
  { q: '¿Qué pasa si me equivoco de dirección?', a: 'Los envíos en blockchain no se pueden deshacer. Comprueba que la dirección es de la red indicada antes de solicitar el retiro. Con Binance Pay basta tu Pay ID y no hay comisiones.' },
  { q: '¿Por qué me han rechazado un retiro?', a: 'Normalmente por datos de destino incorrectos o por incumplir las normas (varias cuentas, VPN, bots o fraude en las ofertas). Si se rechaza por un error, los puntos vuelven a tu saldo.' },
  { q: '¿Qué es el nivel?', a: 'Subes un nivel por cada 1.000 puntos ganados con ofertas, encuestas y referidos. El casino no cuenta.' },
  { q: '¿Cómo funcionan los referidos?', a: 'Recibes 100 puntos cuando una persona que se registró con tu enlace completa su primera oferta o encuesta, hasta 20 referidos. El código solo puede aplicarse durante los primeros 7 días de una cuenta nueva.' },
  { q: '¿Qué es la clasificación mensual?', a: 'Ordena a los usuarios por los puntos ganados durante el mes en curso (UTC). Puedes salir de ella o aparecer de forma anónima desde Ajustes.' },
  { q: '¿Es obligatoria la verificación en dos pasos?', a: 'No, pero la recomendamos para proteger tu saldo. Si la activas, se te pedirá un código al iniciar sesión. Guarda tus códigos de recuperación.' },
  { q: '¿Cómo funciona el casino?', a: 'Hay doce juegos (dados, crash, minas, plinko, blackjack, ruleta, tragaperras, limbo, hi-lo, keno, rueda y cara o cruz) que se juegan con tus puntos, que tienen valor real. Solo para mayores de 18 años: juega con responsabilidad. Las jugadas no cuentan para el nivel ni para la clasificación.' },
  { q: '¿Cómo sé que el casino no hace trampa?', a: 'Cada resultado sale de tu semilla de cliente, una semilla secreta del servidor (de la que ves el hash antes de jugar) y un contador. Al cambiar las semillas en Juego justo se revela la anterior y puedes recalcular cualquier jugada en tu navegador.' },
  { q: '¿Cómo elimino mi cuenta?', a: 'Desde Ajustes, en la sección Eliminar cuenta. Se borran de forma permanente todos tus datos y tu saldo, así que retira antes tus puntos.' },
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
