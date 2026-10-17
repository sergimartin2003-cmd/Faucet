import { useEffect, type CSSProperties, type ReactNode } from 'react'
import {
  Award, ArrowRight, Check, ClipboardList, Dices, FileDown, Gamepad2, KeyRound, MailCheck, ShieldCheck,
  Smartphone, Trophy, UserCheck, UserPlus, Users, Wallet,
} from 'lucide-react'
import Link from '../lib/Link'
import Gauge from '../ui/Gauge'
import PublicLayout from './PublicLayout'
import { useAuthDialog } from './auth'
import { t } from '../lib/i18n'
import { siteName } from '../lib/site'

const steps = () => [
  { title: t('Crea tu cuenta'), text: t('Regístrate con tu correo y verifícalo. Es gratis y no hace falta instalar nada.') },
  { title: t('Completa encuestas y ofertas'), text: t('Elige entre las encuestas y ofertas de nuestro socio BitLabs. Los puntos se acreditan cuando el proveedor confirma la tarea.') },
  { title: t('Retira en crypto'), text: t('Desde 5 $ (5.000 puntos) pides el retiro en USDT, Binance Pay, Litecoin, TRON o Dogecoin.') },
]

const earn = () => [
  { key: 'surveys', wide: true, icon: ClipboardList, title: t('Encuestas'), text: t('Da tu opinión en encuestas remuneradas de BitLabs. Lo que pagan depende de la encuesta y de tu perfil.'), reward: t('Pago por encuesta'), tone: 'var(--violet)' },
  { key: 'offers', wide: true, icon: Gamepad2, title: t('Ofertas y juegos'), text: t('Prueba apps, alcanza niveles en juegos o regístrate en servicios. Cada oferta indica su recompensa antes de empezar.'), reward: t('Pago por oferta'), tone: 'var(--amber)' },
  { key: 'withdraw', icon: Wallet, title: t('Retiros en crypto'), text: t('USDT (BEP20), Binance Pay, Litecoin, TRON y Dogecoin. Revisados a mano, normalmente en menos de 48 horas.'), reward: t('Desde 5 $'), tone: 'var(--accent)' },
  { key: 'referrals', icon: Users, title: t('Referidos'), text: t('Invita a tus amigos y recibe un bonus cuando completen su primera oferta.'), reward: t('+100 pts'), tone: 'var(--success)' },
  { key: 'casino', icon: Dices, title: t('Casino'), text: t('Doce juegos con resultados verificables (provably fair). Solo para mayores de 18 años.'), reward: t('12 juegos'), tone: '#ff7ab6' },
]

const features = () => [
  { icon: Trophy, title: t('Clasificación mensual'), text: t('Compara lo que has ganado con el resto de la comunidad. Se reinicia cada mes.') },
  { icon: Award, title: t('Niveles y logros'), text: t('Un nivel por cada 1.000 puntos ganados y logros que reconocen tu progreso.') },
  { icon: FileDown, title: t('Historial completo'), text: t('Consulta cada movimiento de puntos y expórtalo a CSV cuando quieras.') },
  { icon: ShieldCheck, title: t('Retiros con seguimiento'), text: t('Cada retiro muestra su estado y, cuando se paga, el enlace a la transacción.') },
]

const rules = (): { group: string; rows: [string, string][] }[] => [
  { group: t('Puntos'), rows: [
    [t('Valor'), t('1.000 puntos = 1 $')],
    [t('Cómo se ganan'), t('Encuestas y ofertas de BitLabs y referidos')],
    [t('Ofertas anuladas por el proveedor'), t('Sus puntos se descuentan del saldo')],
  ] },
  { group: t('Retiros'), rows: [
    [t('Mínimo'), t('5.000 puntos (5 $)')],
    [t('Monedas'), t('USDT (BEP20), Binance Pay, Litecoin, TRON, Dogecoin')],
    [t('Plazo habitual'), t('Menos de 48 horas, tras revisión manual')],
    [t('Retiros pendientes'), t('Uno a la vez')],
  ] },
  { group: t('Referidos'), rows: [
    [t('Bonus por referido'), t('+100 puntos cuando completa su primera oferta')],
    [t('Máximo'), t('20 referidos con bonus')],
  ] },
  { group: t('Niveles'), rows: [
    [t('Progreso'), t('Un nivel por cada 1.000 puntos ganados')],
  ] },
]

const security = () => [
  { icon: Smartphone, title: t('Verificación en dos pasos'), text: t('Protege tu cuenta y tus retiros con una app autenticadora (TOTP).') },
  { icon: KeyRound, title: t('Códigos de recuperación'), text: t('Códigos de un solo uso para recuperar el acceso si pierdes tu dispositivo.') },
  { icon: MailCheck, title: t('Correo verificado'), text: t('Toda cuenta debe confirmar su correo antes de completar ofertas o retirar.') },
  { icon: UserCheck, title: t('Revisión antifraude'), text: t('Revisamos cada retiro. Las cuentas duplicadas, VPN o bots no cobran.') },
]

const faq = () => [
  { q: t('¿Cuánto valen los puntos?'), a: t('1.000 puntos equivalen a 1 $. Puedes retirarlos en criptomonedas a partir de 5.000 puntos (5 $).') },
  { q: t('¿Cuánto puedo ganar?'), a: t('Depende de las encuestas y ofertas disponibles para tu país y tu perfil. Cada una indica su recompensa antes de empezar; no prometemos ingresos fijos.') },
  { q: t('¿Cómo retiro mi dinero?'), a: t('Desde la sección Retirar de tu panel: eliges la moneda (USDT BEP20, Binance Pay, Litecoin, TRON o Dogecoin), indicas tu dirección o Pay ID y la cantidad. Revisamos la solicitud y la pagamos normalmente en menos de 48 horas.') },
  { q: t('¿Por qué me han quitado puntos?'), a: t('Si el proveedor anula una oferta o encuesta (por ejemplo, porque no se completó correctamente), sus puntos se descuentan de tu saldo.') },
  { q: t('¿Por qué debo verificar mi correo?'), a: t('La verificación confirma que la cuenta pertenece a una persona real. Es obligatoria para completar ofertas y para retirar.') },
  { q: t('¿Puedo tener varias cuentas?'), a: t('No. Se permite una cuenta por persona. Las cuentas duplicadas, el uso de VPN o proxies y cualquier fraude suponen el rechazo de los retiros y el cierre de la cuenta.') },
  { q: t('¿Hay edad mínima?'), a: t('Sí. Tienes que ser mayor de 18 años para usar la web y el casino.') },
  { q: t('¿Cómo elimino mi cuenta?'), a: t('Desde Ajustes, dentro de tu panel. La eliminación es inmediata y borra de forma permanente tu perfil, tu saldo y tu historial, así que retira antes tus puntos.') },
]

const marquee = () => [t('Encuestas'), t('Ofertas'), t('Juegos'), 'USDT', 'Binance Pay', 'Litecoin', 'TRON', 'Dogecoin', t('Referidos'), 'Casino']

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
        <span className="claim-gauge-amount" style={{ fontSize: 64 }}>+850<small>{t('puntos')}</small></span>
      </Gauge>
    </div>
    <span className="hero-chip hero-chip-a"><ClipboardList size={15} />{t('+850 encuesta')}</span>
    <span className="hero-chip hero-chip-b"><span className="coin"><span>$</span></span>{t('Retiro 5 $ USDT')}</span>
    <span className="hero-chip hero-chip-c"><Award size={15} />{t('Nivel 3')}</span>
    <span className="hero-chip hero-chip-d"><Gamepad2 size={15} />{t('Oferta +1.200')}</span>
  </div>
}

function LandingContent() {
  const { openAuth, signedInEmail } = useAuthDialog()

  useEffect(() => { document.title = t('{site} · Encuestas y ofertas pagadas en crypto', { site: siteName }) }, [])

  const cta = (size: 'btn-lg' | 'btn-md' = 'btn-lg') => signedInEmail
    ? <Link className={`btn btn-primary ${size}`} to="/dashboard">{t('Ir al panel')} <ArrowRight size={16} /></Link>
    : <>
      <button type="button" className={`btn btn-primary ${size}`} onClick={() => openAuth('signup')}><UserPlus size={16} />{t('Crear cuenta gratis')}</button>
      <button type="button" className={`btn btn-secondary ${size}`} onClick={() => openAuth('login')}>{t('Iniciar sesión')}</button>
    </>

  return <>
    <section className="landing-hero" aria-labelledby="hero-title">
      <div className="landing-container landing-hero-grid">
        <div className="landing-hero-copy">
          <p className="eyebrow">{t('Encuestas y ofertas · retiros en crypto')}</p>
          <h1 id="hero-title">{t('Gana con encuestas y ofertas,')} <span className="glow-text">{t('cóbralo en crypto.')}</span></h1>
          <p className="landing-hero-sub">{t('Completa encuestas y ofertas de nuestro socio BitLabs, acumula puntos y retíralos en USDT, Binance Pay, Litecoin, TRON o Dogecoin desde 5 $.')}</p>
          <div className="landing-hero-actions">{cta()}</div>
          <ul className="hero-facts">
            <li><strong className="mono-num">{t('1.000')}</strong><span>{t('puntos = 1 $')}</span></li>
            <li><strong className="mono-num">{t('5 $')}</strong><span>{t('retiro mínimo')}</span></li>
            <li><strong className="mono-num">5</strong><span>{t('criptomonedas')}</span></li>
          </ul>
        </div>
        <HeroVisual />
      </div>
    </section>

    <div className="marquee" aria-hidden="true">
      <div className="marquee-track">
        {[0, 1].map((copy) => <div className="marquee-group" key={copy}>
          {marquee().map((label) => <span key={label}><i />{label}</span>)}
        </div>)}
      </div>
    </div>

    <section className="landing-section" id="ganar" aria-labelledby="ganar-title">
      <div className="landing-container">
        <SectionHead id="ganar-title" eyebrow={t('Formas de ganar')} title={t('Tareas pagadas, saldo real')} lead={t('Cada encuesta y oferta la paga un anunciante a través de BitLabs; tú recibes tu parte en puntos.')} />
        <ul className="bento">
          {earn().map(({ key, wide, icon: Icon, title, text, reward, tone }) => <li key={key} className={`bento-card${wide ? ' bento-surveys' : ''}`} style={{ '--tile': tone } as CSSProperties}>
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
        <SectionHead id="como-title" eyebrow={t('Cómo funciona')} title={t('Tres pasos hasta tu primer retiro')} lead={t('Sin instalaciones ni inversión: solo tu tiempo.')} />
        <ol className="landing-steps">
          {steps().map((step, index) => <li key={step.title} className="landing-step">
            <span className="landing-step-number mono-num">0{index + 1}</span>
            <h3>{step.title}</h3>
            <p>{step.text}</p>
          </li>)}
        </ol>
      </div>
    </section>

    <section className="landing-section" id="funciones" aria-labelledby="funciones-title">
      <div className="landing-container">
        <SectionHead id="funciones-title" eyebrow={t('Y además')} title={t('Todo lo que incluye tu cuenta')} lead={t('Herramientas para seguir tu progreso y mantener tu cuenta protegida.')} />
        <ul className="landing-features">
          {features().map(({ icon: Icon, title, text }) => <li key={title} className="landing-feature">
            <span className="landing-icon"><Icon size={18} /></span>
            <h3>{title}</h3>
            <p>{text}</p>
          </li>)}
        </ul>
      </div>
    </section>

    <section className="landing-section" id="reglas" aria-labelledby="reglas-title">
      <div className="landing-container">
        <SectionHead id="reglas-title" eyebrow={t('Reglas claras')} title={t('Las cifras, sin letra pequeña')} lead={t('Estas son las reglas vigentes de puntos, retiros y referidos.')} />
        <div className="landing-rules card">
          <div className="table-wrap">
            <table className="table landing-table">
              <caption className="sr-only">{t('Reglas de recompensas')}</caption>
              {rules().map((group) => <tbody key={group.group}>
                <tr><th scope="colgroup" colSpan={2} className="landing-table-group">{group.group}</th></tr>
                {group.rows.map(([label, value]) => <tr key={label}>
                  <th scope="row" className="landing-table-label">{label}</th>
                  <td className="landing-table-value">{value}</td>
                </tr>)}
              </tbody>)}
            </table>
          </div>
        </div>
        <p className="landing-rules-note"><Check size={15} />{t('Los puntos no se pueden comprar ni transferir a otras personas. Eres responsable de declarar lo que retires si tu país lo exige.')}</p>
      </div>
    </section>

    <section className="landing-section" id="seguridad" aria-labelledby="seguridad-title">
      <div className="landing-container landing-security">
        <SectionHead id="seguridad-title" eyebrow={t('Seguridad')} title={t('Tu cuenta, protegida')} lead={t('Protegemos tu acceso y revisamos cada retiro para que solo cobre quien lo ha ganado.')} />
        <ul className="landing-security-list">
          {security().map(({ icon: Icon, title, text }) => <li key={title}>
            <span className="landing-icon"><Icon size={18} /></span>
            <div><h3>{title}</h3><p>{text}</p></div>
          </li>)}
        </ul>
      </div>
    </section>

    <section className="landing-section" id="faq" aria-labelledby="faq-title">
      <div className="landing-container landing-faq-wrap">
        <SectionHead id="faq-title" eyebrow={t('Preguntas frecuentes')} title={t('Resolvemos tus dudas')} />
        <div className="landing-faq">
          {faq().map((item) => <details key={item.q} className="landing-faq-item">
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
            <h2 id="cta-title">{t('Empieza a ganar hoy')}</h2>
            <p>{t('Crear una cuenta es gratis. Solo necesitas un correo verificado y ser mayor de 18 años.')}</p>
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
