import { useEffect, type ReactNode } from 'react'
import {
  Award, ArrowRight, CalendarCheck, Check, FileDown, Gift, KeyRound, ListChecks, MailCheck,
  Smartphone, Trophy, UserCheck, UserPlus, Users,
} from 'lucide-react'
import Link from '../lib/Link'
import PublicLayout from './PublicLayout'
import { useAuthDialog } from './auth'

const STEPS = [
  { title: 'Crea tu cuenta', text: 'Regístrate con tu correo y verifícalo. Es el único requisito para empezar a reclamar.' },
  { title: 'Reclama y completa tareas', text: 'Reclama puntos cada 24 horas y completa las tareas únicas de tu perfil y de seguridad.' },
  { title: 'Sube de nivel', text: 'Cada punto suma XP. Mantén tu racha, invita a otras personas y sigue tu posición en la clasificación mensual.' },
]

const FEATURES = [
  { icon: CalendarCheck, title: 'Reclamo diario', text: 'Una reclamación cada 24 horas. La cantidad aumenta con cada día consecutivo.' },
  { icon: ListChecks, title: 'Tareas únicas', text: 'Completa tu perfil y activa la verificación en dos pasos para sumar puntos extra una sola vez.' },
  { icon: Users, title: 'Referidos', text: 'Comparte tu enlace y recibe puntos por cada persona que verifique su cuenta.' },
  { icon: Trophy, title: 'Clasificación mensual', text: 'Compara tu progreso con el resto de la comunidad. La clasificación se reinicia cada mes.' },
  { icon: Award, title: 'Niveles y logros', text: 'Un nivel cada 100 XP y logros que reconocen tu constancia.' },
  { icon: FileDown, title: 'Historial completo', text: 'Consulta cada movimiento de puntos y expórtalo a CSV cuando quieras.' },
]

const RULES: { group: string; rows: [string, string][] }[] = [
  { group: 'Reclamo diario', rows: [
    ['Puntos base', '10 puntos'],
    ['Bonus por racha', '+2 puntos por día consecutivo'],
    ['Máximo por reclamo', '22 puntos'],
    ['Frecuencia', '1 reclamo cada 24 horas'],
    ['La racha se interrumpe', 'Tras 48 horas sin reclamar'],
  ] },
  { group: 'Tareas únicas', rows: [
    ['Completar el perfil', '+25 puntos'],
    ['Añadir los detalles del perfil', '+10 puntos'],
    ['Activar la verificación en dos pasos', '+30 puntos'],
  ] },
  { group: 'Referidos', rows: [
    ['Por cada referido verificado', '+15 puntos'],
    ['Límite de referidos', '20 personas'],
    ['Validez del código', 'Primeros 7 días de la cuenta nueva'],
  ] },
  { group: 'Niveles', rows: [
    ['Equivalencia', '1 punto = 1 XP'],
    ['Progreso de nivel', '100 XP por nivel'],
  ] },
]

const SECURITY = [
  { icon: Smartphone, title: 'Verificación en dos pasos', text: 'Protege tu cuenta con una app autenticadora (TOTP).' },
  { icon: KeyRound, title: 'Códigos de recuperación', text: 'Códigos de un solo uso para recuperar el acceso si pierdes tu dispositivo.' },
  { icon: MailCheck, title: 'Correo verificado', text: 'Toda cuenta debe confirmar su dirección de correo antes de empezar a reclamar.' },
  { icon: UserCheck, title: 'Una cuenta por persona', text: 'Bloqueamos correos desechables y sancionamos el uso de varias cuentas.' },
]

const FAQ = [
  { q: '¿Los puntos tienen valor?', a: 'No. Los puntos son promocionales y no tienen valor monetario. Sirven para subir de nivel, conseguir logros y aparecer en la clasificación mensual.' },
  { q: '¿Puedo retirar mis puntos?', a: 'No. Los puntos no se pueden retirar, transferir ni vender, ni se canjean por dinero.' },
  { q: '¿Cómo funciona la racha?', a: 'Cada día consecutivo que reclamas, la recompensa aumenta 2 puntos sobre los 10 base, hasta un máximo de 22 por reclamo. Si pasan más de 48 horas sin reclamar, la racha vuelve a empezar.' },
  { q: '¿Por qué debo verificar mi correo?', a: 'La verificación confirma que la cuenta pertenece a una persona real y nos permite proteger el acceso y enviarte el enlace de recuperación de contraseña si lo necesitas.' },
  { q: '¿Puedo tener varias cuentas?', a: 'No. Se permite una cuenta por persona. Detectar varias cuentas supone la suspensión y la retirada de los puntos obtenidos.' },
  { q: '¿Cómo elimino mi cuenta?', a: 'Desde Ajustes, dentro de tu panel. La eliminación es inmediata y borra de forma permanente tu perfil, tus puntos y tu historial.' },
]

const RACHA = [10, 12, 14, 16, 18, 20, 22]

function SectionHead({ id, eyebrow, title, lead }: { id: string; eyebrow: string; title: string; lead?: ReactNode }) {
  return <div className="landing-section-head">
    <p className="landing-eyebrow">{eyebrow}</p>
    <h2 id={id}>{title}</h2>
    {lead && <p className="landing-lead">{lead}</p>}
  </div>
}

function ProductPreview() {
  return <figure className="landing-preview">
    <div className="landing-preview-card card" aria-hidden="true">
      <div className="landing-preview-head">
        <span className="landing-preview-title"><Gift size={16} />Reclamo diario</span>
        <span className="badge">Vista previa</span>
      </div>
      <div className="landing-preview-claim">
        <span className="landing-preview-value tnum">+10<small>puntos</small></span>
        <span className="landing-preview-sub">Disponible cada 24 horas</span>
      </div>
      <div className="btn btn-primary btn-block landing-preview-btn">Reclamar puntos</div>

      <hr className="divider" />

      <div className="landing-preview-block">
        <div className="landing-preview-row"><span>Puntos por día de racha</span><span className="faint">Máx. 22</span></div>
        <div className="landing-streak">
          {RACHA.map((points, index) => <div key={points} className="landing-streak-col">
            <span className="landing-streak-bar" style={{ height: `${(points / 22) * 100}%` }} />
            <span className="landing-streak-day tnum">{index + 1}</span>
          </div>)}
        </div>
        <p className="landing-preview-caption">Día consecutivo</p>
      </div>

      <hr className="divider" />

      <div className="landing-preview-block">
        <div className="landing-preview-row"><span>Progreso de nivel</span><span className="faint">100 XP por nivel</span></div>
        <div className="progress"><span style={{ width: '40%' }} /></div>
      </div>
    </div>
    <figcaption className="sr-only">Ilustración del panel de Faucet con el reclamo diario, la racha y el progreso de nivel.</figcaption>
  </figure>
}

function LandingContent() {
  const { openAuth, signedInEmail } = useAuthDialog()

  useEffect(() => { document.title = 'Faucet · Recompensas diarias' }, [])

  return <>
    <section className="landing-hero" aria-labelledby="hero-title">
      <div className="landing-container landing-hero-grid">
        <div className="landing-hero-copy">
          <p className="landing-eyebrow">Recompensas diarias en puntos</p>
          <h1 id="hero-title">Reclama cada día, sube de nivel y mantén tu racha.</h1>
          <p className="landing-hero-sub">Faucet es una app de puntos promocionales. Reclama cada 24 horas, completa tareas, invita a otras personas y sigue tu progreso en un panel claro.</p>
          <div className="landing-hero-actions">
            {signedInEmail
              ? <Link className="btn btn-primary btn-lg" to="/dashboard">Ir al panel <ArrowRight size={16} /></Link>
              : <>
                <button type="button" className="btn btn-primary btn-lg" onClick={() => openAuth('signup')}>Crear cuenta gratis</button>
                <button type="button" className="btn btn-secondary btn-lg" onClick={() => openAuth('login')}>Iniciar sesión</button>
              </>}
          </div>
          <p className="landing-hero-note">Los puntos son promocionales, no tienen valor monetario y no pueden retirarse.</p>
        </div>
        <ProductPreview />
      </div>
    </section>

    <section className="landing-section" id="como-funciona" aria-labelledby="como-title">
      <div className="landing-container">
        <SectionHead id="como-title" eyebrow="Cómo funciona" title="Tres pasos para empezar" lead="Sin instalaciones ni configuraciones complejas." />
        <ol className="landing-steps">
          {STEPS.map((step, index) => <li key={step.title} className="landing-step">
            <span className="landing-step-number tnum">{index + 1}</span>
            <h3>{step.title}</h3>
            <p>{step.text}</p>
          </li>)}
        </ol>
      </div>
    </section>

    <section className="landing-section" id="funciones" aria-labelledby="funciones-title">
      <div className="landing-container">
        <SectionHead id="funciones-title" eyebrow="Funciones" title="Todo lo que incluye tu cuenta" lead="Herramientas sencillas para reclamar, seguir tu progreso y mantener tu cuenta protegida." />
        <ul className="landing-features">
          {FEATURES.map(({ icon: Icon, title, text }) => <li key={title} className="landing-feature">
            <span className="landing-icon"><Icon size={18} /></span>
            <h3>{title}</h3>
            <p>{text}</p>
          </li>)}
        </ul>
      </div>
    </section>

    <section className="landing-section" id="reglas" aria-labelledby="reglas-title">
      <div className="landing-container">
        <SectionHead id="reglas-title" eyebrow="Reglas claras" title="Las cifras, sin letra pequeña" lead="Estas son las reglas vigentes de recompensas, rachas y referidos." />
        <div className="landing-rules card">
          <div className="table-wrap">
            <table className="table landing-table">
              <caption className="sr-only">Reglas de recompensas</caption>
              {RULES.map((group) => <tbody key={group.group}>
                <tr><th scope="colgroup" colSpan={2} className="landing-table-group">{group.group}</th></tr>
                {group.rows.map(([label, value]) => <tr key={label}>
                  <th scope="row" className="landing-table-label">{label}</th>
                  <td className="landing-table-value">{value}</td>
                </tr>)}
              </tbody>)}
            </table>
          </div>
        </div>
        <p className="landing-rules-note"><Check size={15} />Los puntos son promocionales, no tienen valor monetario y no se pueden retirar, transferir ni vender.</p>
      </div>
    </section>

    <section className="landing-section" id="seguridad" aria-labelledby="seguridad-title">
      <div className="landing-container landing-security">
        <SectionHead id="seguridad-title" eyebrow="Seguridad" title="Tu cuenta, protegida" lead="Aplicamos medidas de seguridad para proteger tu acceso y mantener la comunidad justa." />
        <ul className="landing-security-list">
          {SECURITY.map(({ icon: Icon, title, text }) => <li key={title}>
            <span className="landing-icon"><Icon size={18} /></span>
            <div><h3>{title}</h3><p>{text}</p></div>
          </li>)}
        </ul>
      </div>
    </section>

    <section className="landing-section" id="faq" aria-labelledby="faq-title">
      <div className="landing-container landing-faq-wrap">
        <SectionHead id="faq-title" eyebrow="Preguntas frecuentes" title="Resolvemos tus dudas" />
        <div className="landing-faq">
          {FAQ.map((item) => <details key={item.q} className="landing-faq-item">
            <summary>{item.q}</summary>
            <p>{item.a}</p>
          </details>)}
        </div>
      </div>
    </section>

    <section className="landing-cta" aria-labelledby="cta-title">
      <div className="landing-container">
        <div className="landing-cta-box">
          <div>
            <h2 id="cta-title">Empieza a reclamar hoy</h2>
            <p>Crear una cuenta es gratis y solo requiere un correo verificado.</p>
          </div>
          <div className="landing-cta-actions">
            {signedInEmail
              ? <Link className="btn btn-primary btn-lg" to="/dashboard">Ir al panel <ArrowRight size={16} /></Link>
              : <>
                <button type="button" className="btn btn-primary btn-lg" onClick={() => openAuth('signup')}><UserPlus size={16} />Crear cuenta gratis</button>
                <button type="button" className="btn btn-secondary btn-lg" onClick={() => openAuth('login')}>Iniciar sesión</button>
              </>}
          </div>
        </div>
      </div>
    </section>
  </>
}

export default function LandingPage() {
  return <PublicLayout><LandingContent /></PublicLayout>
}
