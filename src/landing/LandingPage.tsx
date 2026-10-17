import { useEffect, type CSSProperties, type ReactNode } from 'react'
import {
  Award, ArrowRight, Check, ClipboardList, Dices, FileDown, Gamepad2, KeyRound, MailCheck, ShieldCheck,
  Smartphone, Trophy, UserCheck, UserPlus, Users, Wallet,
} from 'lucide-react'
import Link from '../lib/Link'
import Gauge from '../ui/Gauge'
import PublicLayout from './PublicLayout'
import { useAuthDialog } from './auth'

const STEPS = [
  { title: 'Crea tu cuenta', text: 'Regístrate con tu correo y verifícalo. Es gratis y no hace falta instalar nada.' },
  { title: 'Completa encuestas y ofertas', text: 'Elige entre las encuestas y ofertas de nuestro socio BitLabs. Los puntos se acreditan cuando el proveedor confirma la tarea.' },
  { title: 'Retira en crypto', text: 'Desde 5 $ (5.000 puntos) pides el retiro en USDT, Binance Pay, Litecoin, TRON o Dogecoin.' },
]

const EARN = [
  { key: 'surveys', wide: true, icon: ClipboardList, title: 'Encuestas', text: 'Da tu opinión en encuestas remuneradas de BitLabs. Lo que pagan depende de la encuesta y de tu perfil.', reward: 'Pago por encuesta', tone: 'var(--violet)' },
  { key: 'offers', wide: true, icon: Gamepad2, title: 'Ofertas y juegos', text: 'Prueba apps, alcanza niveles en juegos o regístrate en servicios. Cada oferta indica su recompensa antes de empezar.', reward: 'Pago por oferta', tone: 'var(--amber)' },
  { key: 'withdraw', icon: Wallet, title: 'Retiros en crypto', text: 'USDT (BEP20), Binance Pay, Litecoin, TRON y Dogecoin. Revisados a mano, normalmente en menos de 48 horas.', reward: 'Desde 5 $', tone: 'var(--accent)' },
  { key: 'referrals', icon: Users, title: 'Referidos', text: 'Invita a tus amigos y recibe un bonus cuando completen su primera oferta.', reward: '+100 pts', tone: 'var(--success)' },
  { key: 'casino', icon: Dices, title: 'Casino', text: 'Doce juegos con resultados verificables (provably fair). Solo para mayores de 18 años.', reward: '12 juegos', tone: '#ff7ab6' },
]

const FEATURES = [
  { icon: Trophy, title: 'Clasificación mensual', text: 'Compara lo que has ganado con el resto de la comunidad. Se reinicia cada mes.' },
  { icon: Award, title: 'Niveles y logros', text: 'Un nivel por cada 1.000 puntos ganados y logros que reconocen tu progreso.' },
  { icon: FileDown, title: 'Historial completo', text: 'Consulta cada movimiento de puntos y expórtalo a CSV cuando quieras.' },
  { icon: ShieldCheck, title: 'Retiros con seguimiento', text: 'Cada retiro muestra su estado y, cuando se paga, el enlace a la transacción.' },
]

const RULES: { group: string; rows: [string, string][] }[] = [
  { group: 'Puntos', rows: [
    ['Valor', '1.000 puntos = 1 $'],
    ['Cómo se ganan', 'Encuestas y ofertas de BitLabs y referidos'],
    ['Ofertas anuladas por el proveedor', 'Sus puntos se descuentan del saldo'],
  ] },
  { group: 'Retiros', rows: [
    ['Mínimo', '5.000 puntos (5 $)'],
    ['Monedas', 'USDT (BEP20), Binance Pay, Litecoin, TRON, Dogecoin'],
    ['Plazo habitual', 'Menos de 48 horas, tras revisión manual'],
    ['Retiros pendientes', 'Uno a la vez'],
  ] },
  { group: 'Referidos', rows: [
    ['Bonus por referido', '+100 puntos cuando completa su primera oferta'],
    ['Máximo', '20 referidos con bonus'],
  ] },
  { group: 'Niveles', rows: [
    ['Progreso', 'Un nivel por cada 1.000 puntos ganados'],
  ] },
]

const SECURITY = [
  { icon: Smartphone, title: 'Verificación en dos pasos', text: 'Protege tu cuenta y tus retiros con una app autenticadora (TOTP).' },
  { icon: KeyRound, title: 'Códigos de recuperación', text: 'Códigos de un solo uso para recuperar el acceso si pierdes tu dispositivo.' },
  { icon: MailCheck, title: 'Correo verificado', text: 'Toda cuenta debe confirmar su correo antes de completar ofertas o retirar.' },
  { icon: UserCheck, title: 'Revisión antifraude', text: 'Revisamos cada retiro. Las cuentas duplicadas, VPN o bots no cobran.' },
]

const FAQ = [
  { q: '¿Cuánto valen los puntos?', a: '1.000 puntos equivalen a 1 $. Puedes retirarlos en criptomonedas a partir de 5.000 puntos (5 $).' },
  { q: '¿Cuánto puedo ganar?', a: 'Depende de las encuestas y ofertas disponibles para tu país y tu perfil. Cada una indica su recompensa antes de empezar; no prometemos ingresos fijos.' },
  { q: '¿Cómo retiro mi dinero?', a: 'Desde la sección Retirar de tu panel: eliges la moneda (USDT BEP20, Binance Pay, Litecoin, TRON o Dogecoin), indicas tu dirección o Pay ID y la cantidad. Revisamos la solicitud y la pagamos normalmente en menos de 48 horas.' },
  { q: '¿Por qué me han quitado puntos?', a: 'Si el proveedor anula una oferta o encuesta (por ejemplo, porque no se completó correctamente), sus puntos se descuentan de tu saldo.' },
  { q: '¿Por qué debo verificar mi correo?', a: 'La verificación confirma que la cuenta pertenece a una persona real. Es obligatoria para completar ofertas y para retirar.' },
  { q: '¿Puedo tener varias cuentas?', a: 'No. Se permite una cuenta por persona. Las cuentas duplicadas, el uso de VPN o proxies y cualquier fraude suponen el rechazo de los retiros y el cierre de la cuenta.' },
  { q: '¿Hay edad mínima?', a: 'Sí. Tienes que ser mayor de 18 años para usar la web y el casino.' },
  { q: '¿Cómo elimino mi cuenta?', a: 'Desde Ajustes, dentro de tu panel. La eliminación es inmediata y borra de forma permanente tu perfil, tu saldo y tu historial, así que retira antes tus puntos.' },
]

const MARQUEE = ['Encuestas', 'Ofertas', 'Juegos', 'USDT', 'Binance Pay', 'Litecoin', 'TRON', 'Dogecoin', 'Referidos', 'Casino']

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
        <span className="claim-gauge-amount" style={{ fontSize: 64 }}>+850<small>puntos</small></span>
      </Gauge>
    </div>
    <span className="hero-chip hero-chip-a"><ClipboardList size={15} />+850 encuesta</span>
    <span className="hero-chip hero-chip-b"><span className="coin"><span>$</span></span>Retiro 5 $ USDT</span>
    <span className="hero-chip hero-chip-c"><Award size={15} />Nivel 3</span>
    <span className="hero-chip hero-chip-d"><Gamepad2 size={15} />Oferta +1.200</span>
  </div>
}

function LandingContent() {
  const { openAuth, signedInEmail } = useAuthDialog()

  useEffect(() => { document.title = 'Faucet · Encuestas y ofertas pagadas en crypto' }, [])

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
          <p className="eyebrow">Encuestas y ofertas · retiros en crypto</p>
          <h1 id="hero-title">Gana con encuestas y ofertas, <span className="glow-text">cóbralo en crypto.</span></h1>
          <p className="landing-hero-sub">Completa encuestas y ofertas de nuestro socio BitLabs, acumula puntos y retíralos en USDT, Binance Pay, Litecoin, TRON o Dogecoin desde 5 $.</p>
          <div className="landing-hero-actions">{cta()}</div>
          <ul className="hero-facts">
            <li><strong className="mono-num">1.000</strong><span>puntos = 1 $</span></li>
            <li><strong className="mono-num">5 $</strong><span>retiro mínimo</span></li>
            <li><strong className="mono-num">5</strong><span>criptomonedas</span></li>
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
        <SectionHead id="ganar-title" eyebrow="Formas de ganar" title="Tareas pagadas, saldo real" lead="Cada encuesta y oferta la paga un anunciante a través de BitLabs; tú recibes tu parte en puntos." />
        <ul className="bento">
          {EARN.map(({ key, wide, icon: Icon, title, text, reward, tone }) => <li key={key} className={`bento-card${wide ? ' bento-surveys' : ''}`} style={{ '--tile': tone } as CSSProperties}>
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
        <SectionHead id="como-title" eyebrow="Cómo funciona" title="Tres pasos hasta tu primer retiro" lead="Sin instalaciones ni inversión: solo tu tiempo." />
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
        <SectionHead id="reglas-title" eyebrow="Reglas claras" title="Las cifras, sin letra pequeña" lead="Estas son las reglas vigentes de puntos, retiros y referidos." />
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
        <p className="landing-rules-note"><Check size={15} />Los puntos no se pueden comprar ni transferir a otras personas. Eres responsable de declarar lo que retires si tu país lo exige.</p>
      </div>
    </section>

    <section className="landing-section" id="seguridad" aria-labelledby="seguridad-title">
      <div className="landing-container landing-security">
        <SectionHead id="seguridad-title" eyebrow="Seguridad" title="Tu cuenta, protegida" lead="Protegemos tu acceso y revisamos cada retiro para que solo cobre quien lo ha ganado." />
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
            <h2 id="cta-title">Empieza a ganar hoy</h2>
            <p>Crear una cuenta es gratis. Solo necesitas un correo verificado y ser mayor de 18 años.</p>
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
