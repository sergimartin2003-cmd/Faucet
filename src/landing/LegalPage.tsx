import { useEffect, type ReactNode } from 'react'
import { contactEmail, siteName } from '../lib/site'
import PublicLayout from './PublicLayout'
import { useLang } from '../lib/i18n'

type Section = { title: string; body: ReactNode }

const UPDATED = { es: '17 de octubre de 2026', en: 'October 17, 2026' }

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
    title: 'Faucets de creadores',
    body: <>
      <p>Cualquier usuario mayor de edad con el correo verificado puede crear faucets en {siteName}. {siteName} proporciona el software y el alojamiento; la faucet pertenece a su creador.</p>
      <ul>
        <li>Cada faucet se paga desde la cuenta de FaucetPay de su creador, con su propia API key. {siteName} no recibe, custodia ni transmite esos fondos, y no responde de los pagos que FaucetPay no realice.</li>
        <li>El creador es responsable de mantener su faucet con saldo, de la configuración (moneda, recompensa, límites) y de cumplir las condiciones de FaucetPay y la normativa que le sea aplicable, incluida la fiscal.</li>
        <li>Como contraprestación por el servicio, una parte de las visitas de cada faucet muestra anuncios de {siteName} (el porcentaje se indica en el panel del creador). Si está activada, cada pago incluye además una comisión de la plataforma que se envía desde la faucet del creador a {siteName}; su porcentaje se muestra antes de crear o mantener la faucet.</li>
        <li>Está prohibido usar una faucet para juegos de azar, esquemas piramidales, estafas, contenido ilegal o para engañar a quien reclama. {siteName} puede pausar o suspender cualquier faucet que incumpla estas normas o que acumule pagos fallidos.</li>
        <li>Quien reclama necesita una cuenta de FaucetPay. Los reclamos están limitados por tiempo, por dirección y por IP, y protegidos con captcha.</li>
      </ul>
    </>,
  },
  {
    title: 'Faucets destacadas',
    body: <p>El creador puede destacar una faucet activa en el directorio pagando con sus puntos: 1.000 puntos (1 USD) por día, entre 1 y 30 días. Los puntos usados para destacar no son reembolsables y no se pueden retirar. Destacar no garantiza un número de visitas ni de reclamos.</p>,
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
        <li><strong>Faucets:</strong> si creas una faucet, su configuración y la API key de FaucetPay, que guardamos cifrada y nunca se muestra. Si reclamas en una faucet, la dirección, correo o usuario de FaucetPay que indiques, un identificador cifrado de tu IP (para aplicar los límites antiabuso) y el resultado de cada pago. El creador de la faucet ve la dirección de destino y el resultado de los pagos de su faucet.</li>
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
        <li><strong>FaucetPay:</strong> procesa los pagos de las faucets de creadores. Recibe la dirección, correo o usuario de destino, el importe y tu IP para sus controles antifraude, bajo su propia política de privacidad.</li>
        <li><strong>Binance y las redes blockchain:</strong> reciben el Pay ID o la dirección de destino y el importe para efectuar el pago. Las transacciones en una blockchain son públicas y permanentes.</li>
        <li><strong>A-ADS:</strong> red de publicidad, solo cuando está activada. Muestra anuncios dentro de un marco aislado y puede tratar datos técnicos de tu navegador (IP, agente de usuario) para servirlos y contarlos.</li>
      </ul>
    </>,
  },
  {
    title: 'Almacenamiento local y cookies',
    body: <>
      <p>La aplicación usa el almacenamiento local de tu navegador para guardar tu sesión, tus preferencias de tema e idioma y, si llegas con un enlace de invitación, el código de referido hasta que se aplique.</p>
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

const contactSectionEn: Section[] = contactEmail
  ? [{ title: 'Contact', body: <p>For any questions about this document you can write to us at <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.</p> }]
  : []

const TERMS_EN: Section[] = [
  {
    title: 'Acceptance and description of the service',
    body: <>
      <p>{siteName} is a rewards web app. It lets you earn points by completing surveys and offers from external partners and by inviting other people, withdraw those points in cryptocurrency, level up, check a monthly leaderboard and play in a casino with points.</p>
      <p>By creating an account or using the service you accept these terms. If you do not agree with them, do not use the app.</p>
    </>,
  },
  {
    title: 'Minimum age and accounts',
    body: <>
      <p>You must be <strong>18 years of age or older</strong> to create an account and use the service.</p>
      <p>You need an account with a valid email address, which you must verify. You agree to provide truthful information and to keep your credentials confidential.</p>
      <p>We recommend enabling two-step verification under Security. You are responsible for the activity carried out from your account.</p>
    </>,
  },
  {
    title: 'Points and their value',
    body: <>
      <p>Points are earned by completing surveys and offers from our partners (currently BitLabs) and through the referral program. <strong>1,000 points are worth 1 US dollar</strong> for withdrawal purposes.</p>
      <ul>
        <li>Points cannot be purchased.</li>
        <li>They cannot be transferred to other people.</li>
        <li>They can only be redeemed through the withdrawals described in these terms.</li>
      </ul>
      <p>The reward for each survey or offer is set by the partner and depends, among other factors, on your country and your profile. We do not guarantee any level of earnings.</p>
      <p>Points are credited when the partner confirms the task. If the partner later reverses a survey or offer (for example, because it was not completed correctly or because of fraud), the corresponding points are deducted from your balance.</p>
      <p>We may adjust, correct or remove points when necessary to fix errors or enforce these rules.</p>
    </>,
  },
  {
    title: 'Withdrawals',
    body: <>
      <ul>
        <li>The minimum withdrawal is 5,000 points ($5).</li>
        <li>Withdrawals are paid in USDT (BEP20 network), Binance Pay, Litecoin, TRON or Dogecoin, for the dollar equivalent at the exchange rate at the time of payment.</li>
        <li>You need a verified email and can only have one pending withdrawal at a time.</li>
        <li>Each request is reviewed manually and is usually paid within 48 hours. This time frame is approximate and may be extended if the review requires it.</li>
        <li>You are responsible for providing a correct address or Pay ID on the right network. Payments sent to wrong details cannot be recovered.</li>
        <li>If a withdrawal is rejected, the points return to your balance unless the rejection is due to fraud.</li>
      </ul>
      <p>You are responsible for reporting and paying taxes on what you withdraw when the laws of your country require it.</p>
    </>,
  },
  {
    title: 'Casino',
    body: <>
      <p>The casino lets you bet points, which have monetary value. Only people aged 18 or older may play.</p>
      <ul>
        <li>Every result is calculated by the server with a verifiable system (server seed, client seed and nonce) that you can check under Fair play.</li>
        <li>The maximum bet is 100,000 points and the maximum payout per play is 1,000,000 points.</li>
        <li>Casino plays do not count toward your level, achievements or the monthly leaderboard.</li>
        <li>Play responsibly and only with what you can afford to lose. If gambling stops being entertainment for you, stop playing and seek help.</li>
      </ul>
      <p>We may limit or close casino access for any account, especially when there are signs of fraud, abuse or problem gambling.</p>
    </>,
  },
  {
    title: 'Levels and leaderboard',
    body: <p>Every 1,000 points earned with surveys, offers and referrals raises your level by one. The monthly leaderboard is based on the points earned during the month (excluding the casino) and resets when the next month begins.</p>,
  },
  {
    title: 'Referral program',
    body: <>
      <p>You can invite other people with your personal link. You receive 100 points for each referral when they complete their first offer or survey, up to a maximum of 20 referrals.</p>
      <p>The referral code is only valid during the first 7 days of the new account and cannot be applied to your own account. No points will be granted for referrals from your own, duplicate or accounts created solely to obtain rewards.</p>
    </>,
  },
  {
    title: 'Creator faucets',
    body: <>
      <p>Any adult user with a verified email can create faucets on {siteName}. {siteName} provides the software and hosting; the faucet belongs to its creator.</p>
      <ul>
        <li>Each faucet is paid from its creator's FaucetPay account, using their own API key. {siteName} does not receive, hold or transmit those funds, and is not liable for payouts FaucetPay does not make.</li>
        <li>The creator is responsible for keeping the faucet funded, for its settings (currency, reward, limits) and for complying with FaucetPay's terms and any law that applies to them, including tax law.</li>
        <li>In return for the service, a share of each faucet's page views shows {siteName} ads (the percentage is shown in the creator panel). When enabled, each payout also includes a platform fee sent from the creator's faucet to {siteName}; its percentage is shown before creating or keeping the faucet.</li>
        <li>Faucets must not be used for gambling, pyramid schemes, scams, illegal content or to mislead claimers. {siteName} may pause or suspend any faucet that breaks these rules or accumulates failed payouts.</li>
        <li>Claimers need a FaucetPay account. Claims are limited by time, address and IP, and protected by a captcha.</li>
      </ul>
    </>,
  },
  {
    title: 'Featured faucets',
    body: <p>A creator can feature an active faucet in the directory by paying with their points: 1,000 points (1 USD) per day, from 1 to 30 days. Points spent on featuring are non-refundable and cannot be withdrawn. Featuring does not guarantee any number of visits or claims.</p>,
  },
  {
    title: 'Acceptable use and anti-fraud measures',
    body: <>
      <ul>
        <li>Only one account per person is allowed.</li>
        <li>Temporary or disposable email addresses are blocked.</li>
        <li>Using VPNs, proxies, bots or any automation, providing false information in surveys or offers, and manipulating referrals or leaderboards are prohibited.</li>
      </ul>
      <p>If we detect several accounts belonging to the same person or any other fraud, we may reject withdrawals, void the points obtained and close the accounts involved.</p>
    </>,
  },
  {
    title: 'Account deletion',
    body: <p>You can delete your account at any time from Settings. Deletion permanently erases your profile, your balance and your history, and cannot be undone. Withdraw your points before deleting it: points in a deleted account are lost.</p>,
  },
  {
    title: 'Availability and liability',
    body: <>
      <p>The service is provided as is, with no guarantee of continuous availability. We may modify, suspend or discontinue features at any time, including the availability of surveys and offers, which depends on our partners.</p>
      <p>To the extent permitted by law, we are not liable for damages arising from the use of, or inability to use, the service, nor for changes in cryptocurrency prices after payment.</p>
    </>,
  },
  {
    title: 'Changes to these terms',
    body: <p>We may update these terms to reflect changes in the service or in the law. We will show the date of the last update at the top of this document. Continuing to use the service after a change means you accept it.</p>,
  },
  ...contactSectionEn,
]

const PRIVACY_EN: Section[] = [
  {
    title: 'Scope of this policy',
    body: <p>This policy explains what personal data {siteName} processes, what it uses it for and what rights you have. It applies to the web app and to the accounts created in it.</p>,
  },
  {
    title: 'Data we process',
    body: <>
      <ul>
        <li><strong>Account data:</strong> your email address and your password (stored encrypted by the authentication system).</li>
        <li><strong>Optional profile data:</strong> display name, country, bio and avatar color.</li>
        <li><strong>Activity:</strong> points log (offers, surveys, referrals and reversals), level, achievements, reward history and casino plays.</li>
        <li><strong>Withdrawals:</strong> chosen currency, destination address or Binance Pay ID, amounts, status and reference of each payment.</li>
        <li><strong>Faucets:</strong> if you create a faucet, its settings and its FaucetPay API key, which we store encrypted and never display. If you claim from a faucet, the FaucetPay address, email or username you enter, an encrypted identifier of your IP (to enforce anti-abuse limits) and the result of each payout. The faucet's creator sees the destination and the result of the payouts from their faucet.</li>
        <li><strong>Security:</strong> authentication events, such as sign-ins and two-step verification, managed by Supabase Auth.</li>
      </ul>
      <p>We do not ask for bank details or cards. We may ask you to verify your identity or age if required by law or to prevent fraud.</p>
    </>,
  },
  {
    title: 'What we use your data for',
    body: <>
      <ul>
        <li>Creating and maintaining your account and providing the service (performance of the service).</li>
        <li>Calculating points, levels and leaderboards, and processing and paying your withdrawals.</li>
        <li>Protecting your account and preventing fraud, such as duplicate accounts, disposable emails or reversed tasks (legitimate interest in the security of the service).</li>
        <li>Complying with legal obligations, such as keeping payment records.</li>
        <li>Sending you the emails needed to verify your address or recover your password.</li>
      </ul>
      <p>We do not sell your data or use it for advertising.</p>
    </>,
  },
  {
    title: 'Providers involved',
    body: <>
      <p>To provide the service we rely on the following data processors:</p>
      <ul>
        <li><strong>Supabase:</strong> hosting of the database and the authentication system.</li>
        <li><strong>Vercel:</strong> hosting of the web app.</li>
        <li><strong>Cloudflare Turnstile:</strong> anti-bot verification, only when enabled. It may process technical browser data needed to tell people and bots apart.</li>
        <li><strong>BitLabs:</strong> paid offers and surveys rewarded with points, only when enabled. It receives your internal user identifier so it can credit your tasks; surveys may ask you for data that you choose to provide directly to BitLabs under its own privacy policy.</li>
        <li><strong>FaucetPay:</strong> processes the payouts of creator faucets. It receives the destination address, email or username, the amount and your IP for its anti-fraud checks, under its own privacy policy.</li>
        <li><strong>Binance and the blockchain networks:</strong> they receive the Pay ID or destination address and the amount to make the payment. Transactions on a blockchain are public and permanent.</li>
        <li><strong>A-ADS:</strong> advertising network, only when enabled. It shows ads inside an isolated frame and may process technical data from your browser (IP, user agent) to serve and count them.</li>
      </ul>
    </>,
  },
  {
    title: 'Local storage and cookies',
    body: <>
      <p>The app uses your browser's local storage to keep your session, your theme and language preferences and, if you arrive with an invitation link, the referral code until it is applied.</p>
      <p>We do not set our own advertising cookies. When ads or offers are active, A-ADS and BitLabs load inside isolated frames and may use their own storage according to their policies.</p>
    </>,
  },
  {
    title: 'Retention',
    body: <p>We keep your data while your account is active. If you delete your account from Settings, your profile, your balance and your history are permanently erased. Transactions already sent to a blockchain cannot be erased.</p>,
  },
  {
    title: 'Your rights',
    body: <>
      <p>You can exercise your rights of access, rectification, erasure, objection, restriction and portability of your data.</p>
      <ul>
        <li>You can view and edit your profile data in your dashboard.</li>
        <li>You can export your reward history as CSV.</li>
        <li>You can delete your account yourself from Settings, without intermediaries.</li>
      </ul>
      <p>If you believe your rights have not been respected, you can file a complaint with the data protection authority of your country.</p>
    </>,
  },
  {
    title: 'Security',
    body: <p>We apply reasonable technical and organizational measures, such as database-level access control, optional two-step verification and single-use recovery codes. No system is completely infallible, so we recommend using a unique password and enabling two-step verification.</p>,
  },
  {
    title: 'Changes to this policy',
    body: <p>We may update this policy when the service or the law changes. The date of the last update appears at the top of the document.</p>,
  },
  ...contactSectionEn,
]

const CONTENT = {
  es: {
    terms: { title: 'Términos de uso', docTitle: `Términos de uso · ${siteName}`, intro: 'Estas condiciones regulan el uso de la aplicación.', sections: TERMS },
    privacy: { title: 'Política de privacidad', docTitle: `Política de privacidad · ${siteName}`, intro: 'Qué datos tratamos, por qué y cómo puedes controlarlos.', sections: PRIVACY },
  },
  en: {
    terms: { title: 'Terms of use', docTitle: `Terms of use · ${siteName}`, intro: 'These terms govern the use of the app.', sections: TERMS_EN },
    privacy: { title: 'Privacy policy', docTitle: `Privacy policy · ${siteName}`, intro: 'What data we process, why, and how you can control it.', sections: PRIVACY_EN },
  },
}

export default function LegalPage({ kind }: { kind: 'terms' | 'privacy' }) {
  const lang = useLang()
  const page = CONTENT[lang][kind]

  useEffect(() => { document.title = page.docTitle }, [page.docTitle])

  return <PublicLayout>
    <article className="legal-page">
      <div className="legal-container">
        <header className="legal-head">
          <h1>{page.title}</h1>
          <p className="legal-intro">{page.intro}</p>
          <p className="legal-updated">{lang === 'en' ? 'Last updated' : 'Última actualización'}: {UPDATED[lang]}</p>
        </header>
        {page.sections.map((section, index) => <section key={section.title} className="legal-section" aria-labelledby={`legal-${kind}-${index}`}>
          <h2 id={`legal-${kind}-${index}`}>{index + 1}. {section.title}</h2>
          {section.body}
        </section>)}
      </div>
    </article>
  </PublicLayout>
}
