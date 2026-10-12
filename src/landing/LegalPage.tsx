import { useEffect, type ReactNode } from 'react'
import { contactEmail, siteName } from '../lib/site'
import PublicLayout from './PublicLayout'

type Section = { title: string; body: ReactNode }

const UPDATED = '12 de octubre de 2026'

const contactSection: Section[] = contactEmail
  ? [{ title: 'Contacto', body: <p>Para cualquier consulta sobre este documento puedes escribirnos a <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.</p> }]
  : []

const TERMS: Section[] = [
  {
    title: 'Aceptación y descripción del servicio',
    body: <>
      <p>{siteName} es una aplicación web de recompensas basada en puntos. Permite reclamar puntos cada día, completar tareas, invitar a otras personas, subir de nivel y consultar una clasificación mensual.</p>
      <p>Al crear una cuenta o usar el servicio aceptas estos términos. Si no estás de acuerdo con ellos, no utilices la aplicación.</p>
    </>,
  },
  {
    title: 'Cuentas',
    body: <>
      <p>Para usar el servicio necesitas una cuenta con un correo electrónico válido que debes verificar. Te comprometes a facilitar información veraz y a mantener la confidencialidad de tus credenciales.</p>
      <p>Recomendamos activar la verificación en dos pasos desde Ajustes. Eres responsable de la actividad realizada desde tu cuenta.</p>
    </>,
  },
  {
    title: 'Los puntos son promocionales',
    body: <>
      <p>Los puntos son un elemento promocional interno de la aplicación. <strong>No tienen valor monetario</strong> y no constituyen dinero, moneda electrónica ni activo financiero de ningún tipo.</p>
      <ul>
        <li>No se pueden retirar.</li>
        <li>No se pueden transferir a otras personas.</li>
        <li>No se pueden vender ni intercambiar fuera de la aplicación.</li>
      </ul>
      <p>Podemos ajustar, corregir o eliminar puntos cuando sea necesario para corregir errores o aplicar estas normas.</p>
    </>,
  },
  {
    title: 'Reclamo diario y rachas',
    body: <>
      <ul>
        <li>Cada cuenta puede reclamar una vez cada 24 horas.</li>
        <li>La recompensa base es de 10 puntos y aumenta 2 puntos por cada día consecutivo, con un máximo de 22 puntos por reclamo.</li>
        <li>La racha se interrumpe si pasan más de 48 horas sin reclamar; en ese caso vuelve a empezar.</li>
      </ul>
      <p>Las cantidades pueden modificarse en el futuro; los cambios se aplicarán hacia adelante.</p>
    </>,
  },
  {
    title: 'Tareas, niveles y clasificación',
    body: <>
      <p>Algunas tareas se pueden completar una sola vez y otorgan puntos: completar el perfil (+25), añadir los detalles del perfil (+10) y activar la verificación en dos pasos (+30).</p>
      <p>Cada punto equivale a 1 XP y cada nivel requiere 100 XP. La clasificación mensual se calcula a partir de los puntos obtenidos en el mes y se reinicia al comenzar el siguiente.</p>
    </>,
  },
  {
    title: 'Programa de referidos',
    body: <>
      <p>Puedes invitar a otras personas con tu enlace personal. Recibes 15 puntos por cada referido verificado, hasta un máximo de 20 referidos.</p>
      <p>El código de referido solo es válido durante los primeros 7 días de vida de la cuenta nueva. No se concederán puntos por referidos de cuentas propias, duplicadas o creadas con el único fin de obtener recompensas.</p>
    </>,
  },
  {
    title: 'Uso aceptable y medidas antiabuso',
    body: <>
      <ul>
        <li>Se permite una única cuenta por persona.</li>
        <li>Los correos electrónicos temporales o desechables están bloqueados.</li>
        <li>Queda prohibido automatizar reclamos, eludir los límites del servicio o manipular referidos y clasificaciones.</li>
      </ul>
      <p>Detectar varias cuentas de una misma persona u otro uso abusivo puede suponer la suspensión de las cuentas implicadas y la retirada de los puntos obtenidos.</p>
    </>,
  },
  {
    title: 'Eliminación de la cuenta',
    body: <p>Puedes eliminar tu cuenta en cualquier momento desde Ajustes. La eliminación borra de forma permanente tu perfil, tus puntos y tu historial, y no se puede deshacer.</p>,
  },
  {
    title: 'Disponibilidad y responsabilidad',
    body: <>
      <p>El servicio se ofrece tal cual, sin garantía de disponibilidad continua. Podemos modificar, suspender o interrumpir funciones en cualquier momento.</p>
      <p>Dentro de los límites permitidos por la ley, no respondemos de daños derivados del uso o de la imposibilidad de usar el servicio. Como los puntos carecen de valor monetario, su pérdida o ajuste no genera derecho a compensación económica.</p>
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
        <li><strong>Actividad:</strong> registro de puntos (reclamos, tareas, referidos), nivel, logros e historial de recompensas.</li>
        <li><strong>Seguridad:</strong> eventos de autenticación, como inicios de sesión y verificación en dos pasos, gestionados por Supabase Auth.</li>
      </ul>
      <p>No solicitamos datos de pago ni documentos de identidad.</p>
    </>,
  },
  {
    title: 'Para qué usamos tus datos',
    body: <>
      <ul>
        <li>Crear y mantener tu cuenta y prestarte el servicio (ejecución del servicio).</li>
        <li>Calcular puntos, niveles, rachas y clasificaciones.</li>
        <li>Proteger la cuenta y prevenir abusos, como cuentas duplicadas o correos desechables (interés legítimo en la seguridad del servicio).</li>
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
      </ul>
    </>,
  },
  {
    title: 'Almacenamiento local y cookies',
    body: <>
      <p>La aplicación usa el almacenamiento local de tu navegador para guardar tu sesión, tu preferencia de tema y, si llegas con un enlace de invitación, el código de referido hasta que se aplique.</p>
      <p>No usamos cookies publicitarias ni herramientas de seguimiento de terceros.</p>
    </>,
  },
  {
    title: 'Conservación',
    body: <p>Conservamos tus datos mientras tu cuenta esté activa. Si eliminas tu cuenta desde Ajustes, tu perfil, tus puntos y tu historial se borran de forma permanente.</p>,
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
