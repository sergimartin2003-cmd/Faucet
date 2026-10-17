import { useEffect, type ReactNode } from 'react'
import { contactEmail, siteName } from '../lib/site'
import PublicLayout from './PublicLayout'

type Section = { title: string; body: ReactNode }

const UPDATED = '17 de octubre de 2026'

const contactSection: Section[] = contactEmail
  ? [{ title: 'Contacto', body: <p>Para cualquier consulta sobre este documento puedes escribirnos a <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.</p> }]
  : []

const TERMS: Section[] = [
  {
    title: 'Aceptación y descripción del servicio',
    body: <>
      <p>{siteName} es una aplicación web de recompensas. Permite ganar puntos completando encuestas y ofertas de socios externos e invitando a otras personas, retirar esos puntos en criptomonedas, subir de nivel, consultar una clasificación mensual y jugar en un casino con puntos.</p>
      <p>Al crear una cuenta o usar el servicio aceptas estos términos. Si no estás de acuerdo con ellos, no utilices la aplicación.</p>
    </>,
  },
  {
    title: 'Edad mínima y cuentas',
    body: <>
      <p>Debes ser <strong>mayor de 18 años</strong> para crear una cuenta y usar el servicio.</p>
      <p>Necesitas una cuenta con un correo electrónico válido que debes verificar. Te comprometes a facilitar información veraz y a mantener la confidencialidad de tus credenciales.</p>
      <p>Recomendamos activar la verificación en dos pasos desde Seguridad. Eres responsable de la actividad realizada desde tu cuenta.</p>
    </>,
  },
  {
    title: 'Puntos y su valor',
    body: <>
      <p>Los puntos se obtienen completando encuestas y ofertas de nuestros socios (actualmente BitLabs) y mediante el programa de referidos. <strong>1.000 puntos equivalen a 1 dólar estadounidense</strong> a efectos de retiro.</p>
      <ul>
        <li>Los puntos no se pueden comprar.</li>
        <li>No se pueden transferir a otras personas.</li>
        <li>Solo se pueden canjear mediante los retiros descritos en estos términos.</li>
      </ul>
      <p>Las recompensas de cada encuesta u oferta las fija el socio y dependen, entre otros factores, de tu país y tu perfil. No garantizamos ningún nivel de ingresos.</p>
      <p>Los puntos se acreditan cuando el socio confirma la tarea. Si el socio anula posteriormente una encuesta u oferta (por ejemplo, por no haberse completado correctamente o por fraude), los puntos correspondientes se descuentan de tu saldo.</p>
      <p>Podemos ajustar, corregir o eliminar puntos cuando sea necesario para corregir errores o aplicar estas normas.</p>
    </>,
  },
  {
    title: 'Retiros',
    body: <>
      <ul>
        <li>El retiro mínimo es de 5.000 puntos (5 $).</li>
        <li>Los retiros se pagan en USDT (red BEP20), Binance Pay, Litecoin, TRON o Dogecoin, por el equivalente en dólares al cambio del momento del pago.</li>
        <li>Necesitas un correo verificado y solo puedes tener un retiro pendiente a la vez.</li>
        <li>Cada solicitud se revisa manualmente y se paga normalmente en menos de 48 horas. Ese plazo es orientativo y puede ampliarse si la revisión lo requiere.</li>
        <li>Eres responsable de indicar una dirección o Pay ID correctos y de la red adecuada. Los envíos a datos erróneos no se pueden recuperar.</li>
        <li>Si un retiro se rechaza, los puntos vuelven a tu saldo salvo que el rechazo se deba a fraude.</li>
      </ul>
      <p>Eres responsable de declarar y tributar por lo que retires cuando la normativa de tu país lo exija.</p>
    </>,
  },
  {
    title: 'Casino',
    body: <>
      <p>El casino permite apostar puntos, que tienen valor económico. Solo pueden jugar personas mayores de 18 años.</p>
      <ul>
        <li>Cada resultado lo calcula el servidor con un sistema verificable (semilla del servidor, semilla del cliente y nonce) que puedes comprobar en Juego justo.</li>
        <li>La apuesta máxima es de 100.000 puntos y el pago máximo por jugada de 1.000.000 de puntos.</li>
        <li>Las jugadas del casino no cuentan para el nivel, los logros ni la clasificación mensual.</li>
        <li>Juega con responsabilidad y solo con lo que puedas permitirte perder. Si el juego deja de ser un entretenimiento para ti, deja de jugar y busca ayuda.</li>
      </ul>
      <p>Podemos limitar o cerrar el acceso al casino de cualquier cuenta, en especial ante indicios de fraude, abuso o juego problemático.</p>
    </>,
  },
  {
    title: 'Niveles y clasificación',
    body: <p>Cada 1.000 puntos ganados con encuestas, ofertas y referidos suben un nivel. La clasificación mensual se calcula a partir de los puntos ganados en el mes (sin contar el casino) y se reinicia al comenzar el siguiente.</p>,
  },
  {
    title: 'Programa de referidos',
    body: <>
      <p>Puedes invitar a otras personas con tu enlace personal. Recibes 100 puntos por cada referido cuando completa su primera oferta o encuesta, hasta un máximo de 20 referidos.</p>
      <p>El código de referido solo es válido durante los primeros 7 días de vida de la cuenta nueva y no se puede aplicar a la propia cuenta. No se concederán puntos por referidos de cuentas propias, duplicadas o creadas con el único fin de obtener recompensas.</p>
    </>,
  },
  {
    title: 'Uso aceptable y medidas antifraude',
    body: <>
      <ul>
        <li>Se permite una única cuenta por persona.</li>
        <li>Los correos electrónicos temporales o desechables están bloqueados.</li>
        <li>Queda prohibido usar VPN, proxies, bots o cualquier automatización, falsear datos en las encuestas u ofertas y manipular referidos o clasificaciones.</li>
      </ul>
      <p>Si detectamos varias cuentas de una misma persona o cualquier otro fraude, podemos rechazar los retiros, anular los puntos obtenidos y cerrar las cuentas implicadas.</p>
    </>,
  },
  {
    title: 'Eliminación de la cuenta',
    body: <p>Puedes eliminar tu cuenta en cualquier momento desde Ajustes. La eliminación borra de forma permanente tu perfil, tu saldo y tu historial, y no se puede deshacer. Retira tus puntos antes de eliminarla: los puntos de una cuenta eliminada se pierden.</p>,
  },
  {
    title: 'Disponibilidad y responsabilidad',
    body: <>
      <p>El servicio se ofrece tal cual, sin garantía de disponibilidad continua. Podemos modificar, suspender o interrumpir funciones en cualquier momento, incluida la disponibilidad de encuestas y ofertas, que depende de nuestros socios.</p>
      <p>Dentro de los límites permitidos por la ley, no respondemos de daños derivados del uso o de la imposibilidad de usar el servicio, ni de las variaciones de precio de las criptomonedas tras el pago.</p>
    </>,
  },
  {
    title: 'Cambios en estos términos',
    body: <p>Podemos actualizar estos términos para reflejar cambios en el servicio o en la normativa. Indicaremos la fecha de la última actualización al inicio de este documento. Seguir usando el servicio tras un cambio implica su aceptación.</p>,
  },
  ...contactSection,
]

const PRIVACY: Section[] = [
  {
    title: 'Alcance de esta política',
    body: <p>Esta política explica qué datos personales trata {siteName}, para qué los usa y qué derechos tienes. Se aplica a la aplicación web y a las cuentas creadas en ella.</p>,
  },
  {
    title: 'Datos que tratamos',
    body: <>
      <ul>
        <li><strong>Datos de la cuenta:</strong> tu correo electrónico y tu contraseña (almacenada de forma cifrada por el sistema de autenticación).</li>
        <li><strong>Datos de perfil opcionales:</strong> nombre visible, país, biografía y color de avatar.</li>
        <li><strong>Actividad:</strong> registro de puntos (ofertas, encuestas, referidos y anulaciones), nivel, logros, historial de recompensas y jugadas del casino.</li>
        <li><strong>Retiros:</strong> moneda elegida, dirección de destino o Pay ID de Binance, importes, estado y referencia de cada pago.</li>
        <li><strong>Seguridad:</strong> eventos de autenticación, como inicios de sesión y verificación en dos pasos, gestionados por Supabase Auth.</li>
      </ul>
      <p>No solicitamos datos bancarios ni tarjetas. Podemos pedirte que verifiques tu identidad o tu edad si lo exige la normativa o para prevenir fraudes.</p>
    </>,
  },
  {
    title: 'Para qué usamos tus datos',
    body: <>
      <ul>
        <li>Crear y mantener tu cuenta y prestarte el servicio (ejecución del servicio).</li>
        <li>Calcular puntos, niveles y clasificaciones, y tramitar y pagar tus retiros.</li>
        <li>Proteger la cuenta y prevenir fraudes, como cuentas duplicadas, correos desechables o tareas anuladas (interés legítimo en la seguridad del servicio).</li>
        <li>Cumplir obligaciones legales, como conservar registros de los pagos.</li>
        <li>Enviarte los correos necesarios para verificar tu dirección o recuperar tu contraseña.</li>
      </ul>
      <p>No vendemos tus datos ni los usamos para publicidad.</p>
    </>,
  },
  {
    title: 'Proveedores que intervienen',
    body: <>
      <p>Para prestar el servicio recurrimos a los siguientes encargados del tratamiento:</p>
      <ul>
        <li><strong>Supabase:</strong> alojamiento de la base de datos y del sistema de autenticación.</li>
        <li><strong>Vercel:</strong> alojamiento de la aplicación web.</li>
        <li><strong>Cloudflare Turnstile:</strong> verificación anti-bots, solo cuando está activada. Puede tratar datos técnicos del navegador necesarios para distinguir personas de bots.</li>
        <li><strong>BitLabs:</strong> ofertas y encuestas remuneradas con puntos, solo cuando están activadas. Recibe tu identificador interno de usuario para poder acreditarte las tareas; las encuestas pueden pedirte datos que tú decides facilitar directamente a BitLabs bajo su propia política de privacidad.</li>
        <li><strong>Binance y las redes blockchain:</strong> reciben el Pay ID o la dirección de destino y el importe para efectuar el pago. Las transacciones en una blockchain son públicas y permanentes.</li>
        <li><strong>A-ADS:</strong> red de publicidad, solo cuando está activada. Muestra anuncios dentro de un marco aislado y puede tratar datos técnicos de tu navegador (IP, agente de usuario) para servirlos y contarlos.</li>
      </ul>
    </>,
  },
  {
    title: 'Almacenamiento local y cookies',
    body: <>
      <p>La aplicación usa el almacenamiento local de tu navegador para guardar tu sesión, tu preferencia de tema y, si llegas con un enlace de invitación, el código de referido hasta que se aplique.</p>
      <p>No instalamos cookies publicitarias propias. Cuando la publicidad o las ofertas están activas, A-ADS y BitLabs se cargan dentro de marcos aislados y pueden usar su propio almacenamiento según sus políticas.</p>
    </>,
  },
  {
    title: 'Conservación',
    body: <p>Conservamos tus datos mientras tu cuenta esté activa. Si eliminas tu cuenta desde Ajustes, tu perfil, tu saldo y tu historial se borran de forma permanente. Las transacciones ya enviadas a una blockchain no se pueden borrar.</p>,
  },
  {
    title: 'Tus derechos',
    body: <>
      <p>Puedes ejercer tus derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad de tus datos.</p>
      <ul>
        <li>Puedes consultar y editar tus datos de perfil en tu panel.</li>
        <li>Puedes exportar tu historial de recompensas en CSV.</li>
        <li>Puedes eliminar tu cuenta tú mismo desde Ajustes, sin intermediarios.</li>
      </ul>
      <p>Si consideras que tus derechos no han sido atendidos, puedes presentar una reclamación ante la autoridad de protección de datos de tu país.</p>
    </>,
  },
  {
    title: 'Seguridad',
    body: <p>Aplicamos medidas técnicas y organizativas razonables, como el control de acceso a nivel de base de datos, la verificación en dos pasos opcional y códigos de recuperación de un solo uso. Ningún sistema es completamente infalible, por lo que te recomendamos usar una contraseña única y activar la verificación en dos pasos.</p>,
  },
  {
    title: 'Cambios en esta política',
    body: <p>Podemos actualizar esta política cuando cambie el servicio o la normativa. La fecha de la última actualización figura al inicio del documento.</p>,
  },
  ...contactSection,
]

const CONTENT = {
  terms: { title: 'Términos de uso', docTitle: 'Términos de uso · Faucet', intro: 'Estas condiciones regulan el uso de la aplicación.', sections: TERMS },
  privacy: { title: 'Política de privacidad', docTitle: 'Política de privacidad · Faucet', intro: 'Qué datos tratamos, por qué y cómo puedes controlarlos.', sections: PRIVACY },
}

export default function LegalPage({ kind }: { kind: 'terms' | 'privacy' }) {
  const page = CONTENT[kind]

  useEffect(() => { document.title = page.docTitle }, [page.docTitle])

  return <PublicLayout>
    <article className="legal-page">
      <div className="legal-container">
        <header className="legal-head">
          <h1>{page.title}</h1>
          <p className="legal-intro">{page.intro}</p>
          <p className="legal-updated">Última actualización: {UPDATED}</p>
        </header>
        {page.sections.map((section, index) => <section key={section.title} className="legal-section" aria-labelledby={`legal-${kind}-${index}`}>
          <h2 id={`legal-${kind}-${index}`}>{index + 1}. {section.title}</h2>
          {section.body}
        </section>)}
      </div>
    </article>
  </PublicLayout>
}
