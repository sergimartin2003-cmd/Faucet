import { useEffect, type CSSProperties, type ReactNode } from 'react'
import {
  Award, ArrowRight, CalendarCheck, Check, ClipboardList, FileDown, Flame, KeyRound, ListChecks, MailCheck,
  MonitorPlay, Smartphone, Sparkles, Ticket, Trophy, UserCheck, UserPlus, Users,
} from 'lucide-react'
import Link from '../lib/Link'
import Gauge from '../ui/Gauge'
import PublicLayout from './PublicLayout'
import { useAuthDialog } from './auth'

const STEPS = [
  { title: 'Crea tu cuenta', text: 'Regístrate con tu correo y verifícalo. Es el único requisito para empezar a reclamar.' },
  { title: 'Abre el grifo cada día', text: 'Reclama cada 24 horas y suma extras con encuestas, vídeos, trivia y el rasca diario.' },
  { title: 'Sube de nivel', text: 'Cada punto suma XP. Mantén tu racha, invita a otras personas y escala en la clasificación mensual.' },
]

const EARN = [
  { key: 'faucet', icon: CalendarCheck, title: 'Faucet diario', text: 'Una reclamación cada 24 horas. La recompensa crece con cada día seguido.', reward: '10 – 22 pts', tone: 'var(--accent)' },
  { key: 'surveys', icon: ClipboardList, title: 'Encuestas', text: 'Responde encuestas breves sobre ahorro, cripto y hábitos. Cada una se completa una vez.', reward: '15 – 30 pts', tone: 'var(--violet)' },
  { key: 'videos', icon: MonitorPlay, title: 'Ver vídeos', text: 'Mira vídeos educativos. El servidor comprueba que los has visto de verdad antes de pagar.', reward: '3 – 8 pts', tone: 'var(--amber)' },
  { key: 'trivia', icon: Sparkles, title: 'Trivia diaria', text: 'Tres preguntas nuevas cada día sobre cripto, seguridad y finanzas. Acierta y suma.', reward: '4 pts / acierto', tone: '#ff7ab6' },
  { key: 'scratch', icon: Ticket, title: 'Rasca y gana', text: 'Un cartón gratis cada día con premio aleatorio calculado en el servidor.', reward: '1 – 15 pts', tone: '#5cc8ff' },
  { key: 'referrals', icon: Users, title: 'Referidos', text: 'Comparte tu enlace y recibe puntos por cada persona que verifique su cuenta.', reward: '+15 pts', tone: 'var(--success)' },
]

const FEATURES = [
  { icon: ListChecks, title: 'Tareas únicas', text: 'Completa tu perfil y activa la verificación en dos pasos para sumar puntos extra una sola vez.' },
  { icon: Trophy, title: 'Clasificación mensual', text: 'Compara tu progreso con el resto de la comunidad. Se reinicia cada mes.' },
  { icon: Award, title: 'Niveles y logros', text: 'Un nivel cada 100 XP y logros que reconocen tu constancia.' },
  { icon: FileDown, title: 'Historial completo', text: 'Consulta cada movimiento de puntos y expórtalo a CSV cuando quieras.' },
]

const RULES: { group: string; rows: [string, string][] }[] = [
  { group: 'Faucet diario', rows: [
    ['Puntos base', '10 puntos'],
    ['Bonus por racha', '+2 puntos por día consecutivo'],
    ['Máximo por reclamo', '22 puntos'],
    ['La racha se interrumpe', 'Tras 48 horas sin reclamar'],
  ] },
  { group: 'Ganar más', rows: [
    ['Encuestas', '15 a 30 puntos, una vez cada una'],
    ['Vídeos', '3 a 8 puntos · máximo 5 al día'],
    ['Trivia', '4 puntos por acierto · 3 preguntas al día'],
    ['Rasca y gana', '1 a 15 puntos · 1 cartón al día'],
  ] },
  { group: 'Tareas y referidos', rows: [
    ['Completar el perfil', '+25 puntos'],
    ['Activar la verificación en dos pasos', '+30 puntos'],
    ['Por cada referido verificado', '+15 puntos (hasta 20 personas)'],
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
  { icon: UserCheck, title: 'Todo se valida en el servidor', text: 'Vídeos, trivia y premios se comprueban en la base de datos, no en tu navegador.' },
]

const FAQ = [
  { q: '¿Los puntos tienen valor?', a: 'No. Los puntos son promocionales y no tienen valor monetario. Sirven para subir de nivel, conseguir logros y aparecer en la clasificación mensual.' },
  { q: '¿Puedo retirar mis puntos?', a: 'No. Los puntos no se pueden retirar, transferir ni vender, ni se canjean por dinero.' },
  { q: '¿Cómo se comprueba que veo los vídeos?', a: 'Al iniciar un vídeo el servidor guarda la hora de inicio. Solo cuando ha pasado casi toda su duración puedes reclamar los puntos; adelantar el vídeo no sirve.' },
  { q: '¿Cómo funciona la racha?', a: 'Cada día consecutivo que reclamas, la recompensa aumenta 2 puntos sobre los 10 base, hasta un máximo de 22 por reclamo. Si pasan más de 48 horas sin reclamar, la racha vuelve a empezar.' },
  { q: '¿Por qué debo verificar mi correo?', a: 'La verificación confirma que la cuenta pertenece a una persona real y nos permite proteger el acceso y enviarte el enlace de recuperación de contraseña si lo necesitas.' },
  { q: '¿Puedo tener varias cuentas?', a: 'No. Se permite una cuenta por persona. Detectar varias cuentas supone la suspensión y la retirada de los puntos obtenidos.' },
  { q: '¿Cómo elimino mi cuenta?', a: 'Desde Ajustes, dentro de tu panel. La eliminación es inmediata y borra de forma permanente tu perfil, tus puntos y tu historial.' },
]

const MARQUEE = ['Faucet diario', 'Encuestas', 'Vídeos', 'Trivia diaria', 'Rasca y gana', 'Referidos', 'Temporadas', 'Logros', 'Rachas']

function SectionHead({ id, eyebrow, title, lead }: { id: string; eyebrow: string; title: string; lead?: ReactNode }) {
  return <div className="landing-section-head">
    <p className="eyebrow">{eyebrow}</p>
    <h2 id={id}>{title}</h2>
    {lead && <p className="landing-lead">{lead}</p>}
  </div>
}

function HeroVisual() {
  return <div className="hero-visual" aria-hidden="true">
    <div className="hero-orb">
      <Gauge fill={0.72} size={330} ready>
        <span className="claim-gauge-amount" style={{ fontSize: 64 }}>+18<small>puntos</small></span>
      </Gauge>
    </div>
    <span className="hero-chip hero-chip-a"><Flame size={15} />Racha de 5 días</span>
    <span className="hero-chip hero-chip-b"><span className="coin"><span>P</span></span>+8 vídeo</span>
    <span className="hero-chip hero-chip-c"><Sparkles size={15} />Trivia 3/3</span>
    <span className="hero-chip hero-chip-d"><Ticket size={15} />Rasca +5</span>
  </div>
}

function LandingContent() {
  const { openAuth, signedInEmail } = useAuthDialog()

  useEffect(() => { document.title = 'Faucet · Gota a gota, cada día suma' }, [])

  const cta = (size: 'btn-lg' | 'btn-md' = 'btn-lg') => signedInEmail
    ? <Link className={`btn btn-primary ${size}`} to="/dashboard">Ir al panel <ArrowRight size={16} /></Link>
    : <>
      <button type="button" className={`btn btn-primary ${size}`} onClick={() => openAuth('signup')}><UserPlus size={16} />Crear cuenta gratis</button>
      <button type="button" className={`btn btn-secondary ${size}`} onClick={() => openAuth('login')}>Iniciar sesión</button>
    </>

  return <>
    <section className="landing-hero" aria-labelledby="hero-title">
      <div className="landing-container landing-hero-grid">
        <div className="landing-hero-copy">
          <p className="eyebrow">Puntos promocionales · sin dinero de por medio</p>
          <h1 id="hero-title">Gota a gota, <span className="glow-text">cada día suma.</span></h1>
          <p className="landing-hero-sub">Abre el grifo cada 24 horas y llena tu depósito de puntos con encuestas, vídeos, trivia y un rasca diario. Sube de nivel, mantén tu racha y escala en la clasificación del mes.</p>
          <div className="landing-hero-actions">{cta()}</div>
          <ul className="hero-facts">
            <li><strong className="mono-num">10–22</strong><span>puntos cada 24 h</span></li>
            <li><strong className="mono-num">5</strong><span>formas de ganar extra</span></li>
            <li><strong className="mono-num">100%</strong><span>validado en servidor</span></li>
          </ul>
        </div>
        <HeroVisual />
      </div>
    </section>

    <div className="marquee" aria-hidden="true">
      <div className="marquee-track">
        {[0, 1].map((copy) => <div className="marquee-group" key={copy}>
          {MARQUEE.map((label) => <span key={label}><i />{label}</span>)}
        </div>)}
      </div>
    </div>

    <section className="landing-section" id="ganar" aria-labelledby="ganar-title">
      <div className="landing-container">
        <SectionHead id="ganar-title" eyebrow="Formas de ganar" title="Seis grifos, un mismo depósito" lead="Todo suma al mismo saldo, al mismo nivel y a la misma clasificación." />
        <ul className="bento">
          {EARN.map(({ key, icon: Icon, title, text, reward, tone }) => <li key={key} className={`bento-card bento-${key}`} style={{ '--tile': tone } as CSSProperties}>
            <span className="bento-icon"><Icon size={20} /></span>
            <h3>{title}</h3>
            <p>{text}</p>
            <span className="bento-reward mono-num">{reward}</span>
          </li>)}
        </ul>
      </div>
    </section>

    <section className="landing-section" id="como-funciona" aria-labelledby="como-title">
      <div className="landing-container">
        <SectionHead id="como-title" eyebrow="Cómo funciona" title="Tres pasos para empezar" lead="Sin instalaciones ni configuraciones complejas." />
        <ol className="landing-steps">
          {STEPS.map((step, index) => <li key={step.title} className="landing-step">
            <span className="landing-step-number mono-num">0{index + 1}</span>
            <h3>{step.title}</h3>
            <p>{step.text}</p>
          </li>)}
        </ol>
      </div>
    </section>

    <section className="landing-section" id="funciones" aria-labelledby="funciones-title">
      <div className="landing-container">
        <SectionHead id="funciones-title" eyebrow="Y además" title="Todo lo que incluye tu cuenta" lead="Herramientas para seguir tu progreso y mantener tu cuenta protegida." />
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
        <SectionHead id="reglas-title" eyebrow="Reglas claras" title="Las cifras, sin letra pequeña" lead="Estas son las reglas vigentes de recompensas, rachas y límites diarios." />
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
            <h2 id="cta-title">Abre el grifo hoy</h2>
            <p>Crear una cuenta es gratis y solo requiere un correo verificado.</p>
          </div>
          <div className="landing-cta-actions">{cta()}</div>
        </div>
      </div>
    </section>
  </>
}

export default function LandingPage() {
  return <PublicLayout><LandingContent /></PublicLayout>
}
