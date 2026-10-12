-- ============================================================================
-- Earn activities: surveys, videos, daily trivia and scratch card.
--
-- All rewards are internal, non-monetary promotional points. Every RPC below is
-- SECURITY DEFINER, requires an authenticated user (errcode 28000,
-- 'Authentication required') and, for anything that awards points or records
-- state, a confirmed email (errcode 22023, 'Email confirmation required').
-- Execute is granted to `authenticated` only. The new tables have RLS enabled
-- and NO direct write policies; users may only SELECT their own activity rows
-- (survey_responses, video_views, trivia_answers, scratch_plays). Catalog
-- tables (surveys, survey_questions, earn_videos, trivia_questions) and the
-- *_starts tables are not directly readable: use the RPCs.
--
-- "UTC day" below means the calendar day in UTC.
--
-- RPC REFERENCE (argument names are the exact names to use with supabase.rpc)
-- ----------------------------------------------------------------------------
-- SURVEYS
--   list_surveys()
--     -> rows (slug text, title text, description text, reward integer,
--              est_minutes integer, question_count integer, completed boolean)
--        Only active surveys, ordered by reward then slug.
--   get_survey(p_slug text)
--     -> jsonb { slug, title, description, reward, completed,
--                questions: [ { id, prompt, kind ('single'|'scale'),
--                               options: [text, ...] } ] }
--        Questions are ordered. Also records the start time (first call only)
--        used by the anti-speed check. Errors: 'Unknown survey' (22023).
--   submit_survey(p_slug text, p_answers jsonb)
--     p_answers = JSON array of ZERO-BASED option indexes, one per question in
--     order, e.g. [0, 2, 1, 4, 3].
--     -> one row (awarded boolean, reward integer, balance integer)
--        If already completed: awarded=false, reward=original reward.
--        Errors: 'Unknown survey' (22023), 'Invalid answers' (22023),
--                'Survey not started' (P0001), 'Too fast' (P0001; needs at
--                least question_count * 3 seconds since get_survey).
--
-- VIDEOS (YouTube embeds; id = YouTube video id)
--   list_videos()
--     -> rows (id text, title text, channel text, duration_seconds integer,
--              reward integer, lang text, watched boolean,
--              watched_today integer, daily_limit integer)
--        watched_today / daily_limit are the same on every row (daily cap info).
--   get_video_status()
--     -> one row (watched_today integer, daily_limit integer, remaining integer)
--   start_video(p_video_id text)
--     -> timestamptz (started_at). Idempotent: keeps an existing start,
--        resets it only if older than 24 h and the video is not yet viewed.
--        Errors: 'Unknown video' (22023).
--   complete_video(p_video_id text)
--     -> one row (awarded boolean, reward integer, balance integer)
--        Already watched: awarded=false with the original reward.
--        Errors: 'Unknown video' (22023), 'Video not started' (P0001),
--                'Video not finished' (P0001; needs 80% of duration_seconds
--                since start_video), 'Daily video limit reached' (P0001;
--                max 5 videos per UTC day).
--   Reward: 3 pts (< 60 s), 5 pts (60-120 s), 8 pts (longer).
--
-- TRIVIA
--   get_daily_trivia()
--     -> up to 3 rows for the current UTC day (same 3 for everybody):
--        (id bigint, prompt text, options text[], answered boolean,
--         your_answer integer, correct boolean, explanation text,
--         correct_index integer)
--        your_answer / correct / explanation / correct_index are NULL until
--        the user has answered that question today.
--   answer_trivia(p_question_id bigint, p_answer_index integer)
--     p_answer_index is zero-based (0..3).
--     -> one row (correct boolean, correct_index integer, explanation text,
--                 reward integer, balance integer)
--        Correct = 4 pts, wrong = 0 pts (recorded, no ledger entry).
--        Errors: 'Invalid answer' (22023), 'Question not available today'
--                (22023), 'Already answered' (P0001).
--
-- SCRATCH CARD
--   get_scratch_status()
--     -> one row (available boolean, last_reward integer,
--                 next_available_at timestamptz)
--        next_available_at is the next UTC midnight when not available, NULL
--        when available. last_reward is NULL if never played.
--   play_scratch()
--     -> one row (reward integer, balance integer)
--        Once per UTC day. Weighted outcome: 1 pt 40%, 2 pt 30%, 3 pt 15%,
--        5 pt 10%, 8 pt 4%, 15 pt 1%. Error: 'Already played today' (P0001).
--
-- HISTORY
--   get_reward_history(...) (unchanged signature) now also returns source_type
--   'survey' (detail = survey slug), 'video' (detail = YouTube video id),
--   'trivia' (detail = answer date, YYYY-MM-DD) and 'scratch' (detail = play
--   date, YYYY-MM-DD).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Ledger: allow the new source types.
-- Each new completion table has its own bigint identity id used as
-- reward_ledger.source_id, so unique (source_type, source_id) keeps working.
-- ---------------------------------------------------------------------------
alter table public.reward_ledger
  drop constraint if exists reward_ledger_source_type_check;

alter table public.reward_ledger
  add constraint reward_ledger_source_type_check
  check (source_type in (
    'daily_faucet', 'earn_task', 'offerwall', 'referral',
    'survey', 'video', 'trivia', 'scratch'
  ));

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.surveys (
  slug text primary key check (slug ~ '^[a-z0-9][a-z0-9-]{0,59}$'),
  title text not null check (char_length(title) between 1 and 120),
  description text not null default '' check (char_length(description) <= 400),
  reward integer not null check (reward > 0),
  est_minutes integer not null default 1 check (est_minutes > 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.survey_questions (
  id bigint generated always as identity primary key,
  survey_slug text not null references public.surveys (slug) on delete cascade,
  position integer not null check (position >= 0),
  prompt text not null check (char_length(prompt) between 1 and 300),
  kind text not null check (kind in ('single', 'scale')),
  options text[] not null check (cardinality(options) between 2 and 10),
  unique (survey_slug, position)
);

create table if not exists public.survey_starts (
  user_id uuid not null references auth.users (id) on delete cascade,
  survey_slug text not null references public.surveys (slug) on delete cascade,
  started_at timestamptz not null default now(),
  primary key (user_id, survey_slug)
);

create table if not exists public.survey_responses (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  survey_slug text not null references public.surveys (slug) on delete cascade,
  answers jsonb not null,
  reward integer not null check (reward > 0),
  created_at timestamptz not null default now(),
  unique (user_id, survey_slug)
);

create table if not exists public.earn_videos (
  id text primary key check (id ~ '^[A-Za-z0-9_-]{6,20}$'),
  title text not null check (char_length(title) between 1 and 200),
  channel text not null default 'YouTube',
  duration_seconds integer not null check (duration_seconds > 0),
  reward integer not null check (reward > 0),
  lang text not null default 'es' check (lang ~ '^[a-z]{2}$'),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.video_starts (
  user_id uuid not null references auth.users (id) on delete cascade,
  video_id text not null references public.earn_videos (id) on delete cascade,
  started_at timestamptz not null default now(),
  primary key (user_id, video_id)
);

create table if not exists public.video_views (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  video_id text not null references public.earn_videos (id) on delete cascade,
  reward integer not null check (reward > 0),
  created_at timestamptz not null default now(),
  unique (user_id, video_id)
);

create index if not exists video_views_user_created_at_idx
  on public.video_views (user_id, created_at desc);

create table if not exists public.trivia_questions (
  id bigint generated always as identity primary key,
  prompt text not null unique check (char_length(prompt) between 1 and 300),
  options text[] not null check (cardinality(options) = 4),
  correct_index smallint not null check (correct_index between 0 and 3),
  explanation text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.trivia_answers (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  question_id bigint not null references public.trivia_questions (id) on delete cascade,
  answer_index smallint not null check (answer_index between 0 and 3),
  correct boolean not null,
  reward integer not null check (reward >= 0),
  answer_date date not null default ((now() at time zone 'utc')::date),
  created_at timestamptz not null default now(),
  unique (user_id, answer_date, question_id)
);

create table if not exists public.scratch_plays (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  play_date date not null,
  reward integer not null check (reward > 0),
  created_at timestamptz not null default now(),
  unique (user_id, play_date)
);

-- ---------------------------------------------------------------------------
-- RLS: enabled everywhere, no direct write policies.
-- ---------------------------------------------------------------------------
alter table public.surveys enable row level security;
alter table public.survey_questions enable row level security;
alter table public.survey_starts enable row level security;
alter table public.survey_responses enable row level security;
alter table public.earn_videos enable row level security;
alter table public.video_starts enable row level security;
alter table public.video_views enable row level security;
alter table public.trivia_questions enable row level security;
alter table public.trivia_answers enable row level security;
alter table public.scratch_plays enable row level security;

revoke all on
  public.surveys, public.survey_questions, public.survey_starts, public.survey_responses,
  public.earn_videos, public.video_starts, public.video_views,
  public.trivia_questions, public.trivia_answers, public.scratch_plays
from public, anon, authenticated;

grant select on
  public.survey_responses, public.video_views, public.trivia_answers, public.scratch_plays
to authenticated;

drop policy if exists "Users can read their own survey responses" on public.survey_responses;
create policy "Users can read their own survey responses"
  on public.survey_responses for select
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can read their own video views" on public.video_views;
create policy "Users can read their own video views"
  on public.video_views for select
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can read their own trivia answers" on public.trivia_answers;
create policy "Users can read their own trivia answers"
  on public.trivia_answers for select
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can read their own scratch plays" on public.scratch_plays;
create policy "Users can read their own scratch plays"
  on public.scratch_plays for select
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Seed: surveys (opinion polls, any valid answer is accepted)
-- ---------------------------------------------------------------------------
insert into public.surveys (slug, title, description, reward, est_minutes) values
  ('habitos-ahorro-inversion', 'Hábitos de ahorro e inversión',
   'Cuéntanos cómo gestionas tu dinero día a día.', 20, 2),
  ('cripto-y-seguridad', 'Cripto y seguridad',
   'Qué opinas de las criptomonedas y cómo proteges tus cuentas.', 25, 2),
  ('apps-financieras', 'Tu experiencia con apps financieras',
   'Ayúdanos a entender qué valoras en una app financiera.', 15, 2),
  ('intereses-aprendizaje', 'Intereses de aprendizaje',
   'Dinos qué temas te gustaría aprender.', 30, 3)
on conflict (slug) do nothing;

insert into public.survey_questions (survey_slug, position, prompt, kind, options) values
  ('habitos-ahorro-inversion', 0, '¿Con qué frecuencia ahorras una parte de tus ingresos?', 'single',
   array['Todos los meses', 'Casi todos los meses', 'De vez en cuando', 'Casi nunca']),
  ('habitos-ahorro-inversion', 1, '¿Qué porcentaje de tus ingresos sueles ahorrar?', 'single',
   array['Menos del 5%', 'Entre el 5% y el 10%', 'Entre el 10% y el 20%', 'Más del 20%']),
  ('habitos-ahorro-inversion', 2, '¿Tienes un fondo de emergencia?', 'single',
   array['Sí, cubre 6 meses o más', 'Sí, cubre de 3 a 6 meses', 'Sí, pero cubre menos de 3 meses', 'No']),
  ('habitos-ahorro-inversion', 3, '¿Cuál es tu principal objetivo al invertir?', 'single',
   array['Crear un patrimonio a largo plazo', 'Preparar la jubilación', 'Conseguir ingresos extra', 'Todavía no invierto']),
  ('habitos-ahorro-inversion', 4, '¿Cómo describirías tu tolerancia al riesgo?', 'single',
   array['Muy baja', 'Baja', 'Media', 'Alta']),
  ('habitos-ahorro-inversion', 5, 'Del 1 al 5, ¿cuánta confianza tienes en tus conocimientos financieros?', 'scale',
   array['1 - Muy poca', '2', '3', '4', '5 - Mucha']),

  ('cripto-y-seguridad', 0, '¿Has usado alguna vez criptomonedas?', 'single',
   array['Sí, las uso con frecuencia', 'Sí, alguna vez', 'No, pero me interesa', 'No y no me interesa']),
  ('cripto-y-seguridad', 1, '¿Dónde guardas tus contraseñas importantes?', 'single',
   array['En un gestor de contraseñas', 'En mi memoria', 'En papel o en una nota del móvil', 'Reutilizo las mismas contraseñas']),
  ('cripto-y-seguridad', 2, '¿Tienes activada la verificación en dos pasos (2FA) en tus cuentas principales?', 'single',
   array['En todas', 'En algunas', 'No, pero quiero activarla', 'No sabía que existía']),
  ('cripto-y-seguridad', 3, '¿Has recibido alguna vez un mensaje sospechoso (phishing)?', 'single',
   array['Sí, varias veces', 'Sí, una vez', 'No que yo sepa', 'No estoy seguro']),
  ('cripto-y-seguridad', 4, '¿Qué te preocupa más del mundo cripto?', 'single',
   array['Las estafas', 'La volatilidad', 'La complejidad técnica', 'La regulación']),
  ('cripto-y-seguridad', 5, 'Del 1 al 5, ¿cuánto confías en las criptomonedas como tecnología?', 'scale',
   array['1 - Nada', '2', '3', '4', '5 - Totalmente']),

  ('apps-financieras', 0, '¿Cuántas apps financieras usas habitualmente?', 'single',
   array['Ninguna', 'Una', 'Dos o tres', 'Más de tres']),
  ('apps-financieras', 1, '¿Qué es lo que más valoras en una app financiera?', 'single',
   array['Facilidad de uso', 'Seguridad', 'Bajo coste', 'Funciones avanzadas']),
  ('apps-financieras', 2, '¿Con qué frecuencia abres tus apps financieras?', 'single',
   array['Varias veces al día', 'Una vez al día', 'Varias veces por semana', 'Raramente']),
  ('apps-financieras', 3, '¿Te animan las rachas y las recompensas a volver a una app?', 'single',
   array['Mucho', 'Algo', 'Poco', 'Nada']),
  ('apps-financieras', 4, 'Del 1 al 5, ¿qué importancia tiene para ti el diseño de una app?', 'scale',
   array['1 - Ninguna', '2', '3', '4', '5 - Mucha']),

  ('intereses-aprendizaje', 0, '¿Qué tema te gustaría aprender primero?', 'single',
   array['Fundamentos de blockchain', 'Finanzas personales', 'Seguridad digital', 'Inversión para principiantes']),
  ('intereses-aprendizaje', 1, '¿Qué formato prefieres para aprender?', 'single',
   array['Vídeos cortos', 'Artículos', 'Cuestionarios y juegos', 'Cursos con ejercicios']),
  ('intereses-aprendizaje', 2, '¿Cuánto tiempo dedicarías a aprender cada día?', 'single',
   array['Menos de 5 minutos', 'De 5 a 15 minutos', 'De 15 a 30 minutos', 'Más de 30 minutos']),
  ('intereses-aprendizaje', 3, '¿En qué idioma prefieres los contenidos?', 'single',
   array['Español', 'Inglés', 'Ambos me valen', 'Otro']),
  ('intereses-aprendizaje', 4, '¿Qué te motiva más a seguir aprendiendo?', 'single',
   array['Ver mi progreso', 'Ganar puntos y logros', 'Compararme con otros', 'Aplicarlo a mi vida real']),
  ('intereses-aprendizaje', 5, 'Del 1 al 5, ¿cuánto te interesa la educación financiera?', 'scale',
   array['1 - Nada', '2', '3', '4', '5 - Muchísimo'])
on conflict (survey_slug, position) do nothing;

-- ---------------------------------------------------------------------------
-- Seed: videos (reward by duration: <60 s = 3, 60-120 s = 5, longer = 8)
-- ---------------------------------------------------------------------------
insert into public.earn_videos (id, title, channel, duration_seconds, reward, lang)
select v.id,
       'Vídeo recomendado',
       'YouTube',
       v.duration_seconds,
       case
         when v.duration_seconds < 60 then 3
         when v.duration_seconds <= 120 then 5
         else 8
       end,
       v.lang
from (values
  ('9_k-tKxZK2A', 60, 'es'),
  ('WmGETGhEqio', 108, 'es'),
  ('LS3Zr7pUZtE', 25, 'es'),
  ('Lu6R-YXp8MQ', 225, 'es'),
  ('vSXAT8AFSRc', 54, 'es'),
  ('xyWtggGC8Ho', 27, 'es'),
  ('3CwnW2QLzxY', 33, 'es'),
  ('Owfr8mKl2Ss', 34, 'es'),
  ('1YyAzVmP9xQ', 333, 'en'),
  ('SSo_EIwHSd4', 360, 'en')
) as v (id, duration_seconds, lang)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Seed: trivia (30 questions)
-- ---------------------------------------------------------------------------
insert into public.trivia_questions (prompt, options, correct_index, explanation) values
  ('¿Qué es una blockchain?',
   array['Una cuenta bancaria tradicional', 'Un registro distribuido de transacciones enlazadas en bloques', 'Un tipo de tarjeta de crédito', 'Un programa antivirus'],
   1, 'Una blockchain es un registro compartido y difícil de alterar, formado por bloques de transacciones enlazados entre sí.'),
  ('¿Quién creó Bitcoin?',
   array['Vitalik Buterin', 'Elon Musk', 'Charlie Lee', 'Satoshi Nakamoto, un seudónimo cuya identidad se desconoce'],
   3, 'Bitcoin fue publicado en 2008 por una persona o grupo bajo el seudónimo Satoshi Nakamoto.'),
  ('¿Cuál es el suministro máximo de bitcoins que existirá?',
   array['21 millones', '100 millones', '1.000 millones', 'No tiene límite'],
   0, 'El protocolo de Bitcoin limita el suministro total a 21 millones de unidades.'),
  ('¿Qué es una wallet (billetera) de criptomonedas?',
   array['Un dispositivo que guarda dinero físico', 'Una cuenta que garantiza rentabilidad', 'Una herramienta que gestiona tus claves y te permite firmar transacciones', 'Un tipo de minero'],
   2, 'Una wallet gestiona las claves que controlan tus fondos y firma las transacciones; los fondos viven en la blockchain.'),
  ('¿Qué es la clave privada de una wallet?',
   array['Tu nombre de usuario público', 'La dirección donde te envían fondos', 'Un código para recuperar tu email', 'Un secreto que da control sobre tus fondos y nunca debe compartirse'],
   3, 'Quien conoce tu clave privada puede mover tus fondos. No la compartas con nadie.'),
  ('¿Qué es una frase semilla (seed phrase)?',
   array['Una contraseña que cambia cada día', 'Un conjunto de palabras que permite recuperar tu wallet', 'Un mensaje promocional', 'Un tipo de comisión'],
   1, 'La frase semilla permite restaurar tu wallet. Guárdala sin conexión y no la compartas nunca.'),
  ('¿Qué es una stablecoin?',
   array['Una criptomoneda cuyo valor busca mantenerse estable, por ejemplo ligado al dólar', 'Una moneda cuyo precio solo sube', 'Un token que solo existe en videojuegos', 'Una acción de bolsa'],
   0, 'Las stablecoins intentan mantener un valor estable respecto a un activo de referencia, como una moneda fiduciaria.'),
  ('¿Qué significa HODL en la jerga cripto?',
   array['Vender rápido ante cualquier caída', 'Un protocolo de seguridad', 'Un tipo de minería', 'Mantener un activo a largo plazo sin vender'],
   3, 'HODL nació de una errata de la palabra hold (mantener) y se usa para hablar de mantener a largo plazo.'),
  ('¿Qué es la minería en una red proof of work como Bitcoin?',
   array['Extraer metales para fabricar monedas', 'Un proceso que gasta potencia de cálculo para validar bloques y asegurar la red', 'Comprar bitcoin con descuento', 'Un sorteo de puntos'],
   1, 'Los mineros compiten resolviendo un problema computacional para añadir bloques y asegurar la red.'),
  ('¿Qué es Ethereum?',
   array['Un banco central digital', 'Una copia exacta de Bitcoin', 'Una plataforma de contratos inteligentes cuya moneda nativa es el ether (ETH)', 'Una app de mensajería'],
   2, 'Ethereum permite ejecutar contratos inteligentes y aplicaciones descentralizadas; su moneda nativa es el ether.'),
  ('¿Qué es una comisión de red (gas fee)?',
   array['Un impuesto que cobra esta app', 'Un pago por el procesamiento de tu transacción en la red', 'Un interés bancario', 'Una multa por retirar fondos'],
   1, 'Las comisiones de red remuneran a quienes validan y procesan las transacciones.'),
  ('¿Qué es un exchange centralizado?',
   array['Una wallet sin custodia', 'Un protocolo sin propietarios', 'Un tipo de NFT', 'Una plataforma operada por una empresa para comprar y vender cripto, que suele custodiar los fondos'],
   3, 'En un exchange centralizado la empresa custodia tus fondos; en una wallet sin custodia las claves las controlas tú.'),
  ('Alguien te pide tu frase semilla por mensaje privado diciendo que es soporte oficial. ¿Qué haces?',
   array['Se la envío, parece oficial', 'No la comparto nunca: es una estafa', 'Le envío solo la mitad', 'Se la envío cifrada por correo'],
   1, 'Ningún soporte legítimo te pedirá jamás tu frase semilla o tu clave privada.'),
  ('¿Qué es el phishing?',
   array['Una técnica de trading', 'Un tipo de wallet', 'Un método para engañar con webs o mensajes falsos y robar datos o credenciales', 'Una forma de minería'],
   2, 'El phishing suplanta a servicios legítimos para que entregues contraseñas, claves o datos personales.'),
  ('¿Qué aporta la autenticación en dos pasos (2FA)?',
   array['Una capa extra de seguridad además de la contraseña', 'Duplica tus puntos', 'Elimina la necesidad de contraseña', 'Acelera las transacciones'],
   0, 'Con 2FA un atacante necesita algo más que tu contraseña para entrar en tu cuenta.'),
  ('¿Cuál es una buena práctica con las contraseñas?',
   array['Usar la misma en todos los sitios', 'Usar tu fecha de nacimiento', 'Enviártela por correo a ti mismo', 'Usar una contraseña larga y única por servicio, apoyándote en un gestor'],
   3, 'Las contraseñas largas y únicas evitan que la filtración de un sitio comprometa el resto de tus cuentas.'),
  ('Una promesa de duplicar tu dinero en 24 horas con rentabilidad garantizada suele ser...',
   array['Una oportunidad segura', 'Una señal clara de estafa', 'Un producto regulado', 'Una oferta del banco central'],
   1, 'Las rentabilidades altas y garantizadas son una de las señales más habituales de fraude.'),
  ('¿Qué es una cold wallet (wallet fría)?',
   array['Una wallet que guarda las claves sin conexión a internet', 'Una wallet alojada en un servidor compartido', 'Una wallet sin comisiones', 'Una wallet solo para stablecoins'],
   0, 'Al mantener las claves offline, una wallet fría reduce mucho el riesgo de ataques remotos.'),
  ('Recibes un email del banco con un enlace urgente. ¿Qué conviene hacer?',
   array['Hacer clic rápidamente', 'Reenviarlo a tus amigos', 'Verificar el remitente y entrar escribiendo tú mismo la web oficial', 'Descargar el adjunto para revisarlo'],
   2, 'Accede siempre a tus servicios escribiendo la dirección oficial en lugar de pulsar enlaces recibidos.'),
  ('¿Qué es un ataque de SIM swapping?',
   array['Cambiar la SIM por una más rápida', 'Un error de la aplicación móvil', 'Un tipo de minería', 'Lograr que traspasen tu número a otra SIM para interceptar códigos SMS'],
   3, 'Por eso es preferible usar una app autenticadora o una llave de seguridad en lugar de códigos por SMS.'),
  ('¿Qué es un fondo de emergencia?',
   array['Una inversión de alto riesgo', 'Dinero ahorrado para imprevistos, habitualmente de 3 a 6 meses de gastos', 'Un préstamo preaprobado', 'Un seguro de coche'],
   1, 'Un fondo de emergencia evita endeudarte o vender inversiones ante un imprevisto.'),
  ('¿Qué significa diversificar una inversión?',
   array['Poner todo en un solo activo', 'Vender todo cuando baja el precio', 'Repartir el dinero entre distintos activos para reducir el riesgo', 'Invertir solo en criptomonedas'],
   2, 'Diversificar reduce el impacto que puede tener un único activo sobre el conjunto de tu cartera.'),
  ('¿Qué es el interés compuesto?',
   array['Interés calculado solo sobre el capital inicial', 'Una comisión bancaria', 'Un impuesto sobre el ahorro', 'Interés que también se genera sobre los intereses ya acumulados'],
   3, 'Con interés compuesto los intereses se reinvierten y generan a su vez nuevos intereses con el paso del tiempo.'),
  ('En la regla 50/30/20, ¿cómo se reparten los ingresos?',
   array['50% ahorro, 30% necesidades, 20% deseos', '50% deseos, 30% ahorro, 20% necesidades', '50% necesidades, 30% deseos, 20% ahorro', '50% deudas, 30% ahorro, 20% inversión'],
   2, 'La regla 50/30/20 propone destinar 50% a necesidades, 30% a deseos y 20% a ahorro o deudas.'),
  ('¿Qué es la inflación?',
   array['Una subida generalizada de precios que reduce el poder adquisitivo', 'Una bajada generalizada de precios', 'Un aumento del salario', 'Un tipo de cambio'],
   0, 'Con inflación, con el mismo dinero puedes comprar menos bienes y servicios que antes.'),
  ('¿Qué mide la volatilidad de un activo?',
   array['Su comisión de custodia', 'Cuánto varía su precio a lo largo del tiempo', 'La rentabilidad que garantiza', 'El número de personas que lo poseen'],
   1, 'Un activo muy volátil sube y baja de precio con mayor intensidad, lo que implica más riesgo.'),
  ('Los puntos de esta app son...',
   array['Dinero real que se puede retirar', 'Una criptomoneda que cotiza en bolsa', 'Acciones de la empresa', 'Puntos internos promocionales sin valor monetario'],
   3, 'Los puntos son internos y promocionales: no son dinero, no se pueden retirar ni tienen valor monetario.'),
  ('¿Cada cuánto puedes reclamar el faucet diario?',
   array['Cada hora', 'Cada 24 horas', 'Una sola vez en la vida', 'Cada semana'],
   1, 'El faucet diario se puede reclamar una vez cada 24 horas.'),
  ('¿Qué le pasa a tu racha del faucet si pasas más de 48 horas sin reclamar?',
   array['Se duplica', 'Se mantiene igual', 'Se reinicia', 'Se transfiere a otro usuario'],
   2, 'Si dejas pasar más de 48 horas, la racha vuelve a empezar desde 1.'),
  ('¿Cuántas veces al día puedes jugar a la tarjeta de rascar?',
   array['Una vez por día (UTC)', 'Ilimitadas', 'Tres', 'Solo los fines de semana'],
   0, 'Hay una tarjeta de rascar disponible por día UTC.')
on conflict (prompt) do nothing;

-- ---------------------------------------------------------------------------
-- Internal helper: the (up to) 3 trivia questions of a given UTC day.
-- Not callable by clients.
-- ---------------------------------------------------------------------------
create or replace function public.trivia_daily_pick(p_date date)
returns table (question_id bigint, pick_order integer)
language sql
stable
security definer
set search_path = ''
as $$
  select picked.id, (row_number() over (order by picked.h, picked.id))::integer
  from (
    select q.id, md5(q.id::text || p_date::text) as h
    from public.trivia_questions as q
    where q.active
    order by md5(q.id::text || p_date::text), q.id
    limit 3
  ) as picked;
$$;

revoke all on function public.trivia_daily_pick(date) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- SURVEYS
-- ---------------------------------------------------------------------------
create or replace function public.list_surveys()
returns table (
  slug text,
  title text,
  description text,
  reward integer,
  est_minutes integer,
  question_count integer,
  completed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  return query
    select
      s.slug,
      s.title,
      s.description,
      s.reward,
      s.est_minutes,
      (select count(*)::integer from public.survey_questions as q where q.survey_slug = s.slug),
      exists (
        select 1
        from public.survey_responses as r
        where r.user_id = v_user_id and r.survey_slug = s.slug
      )
    from public.surveys as s
    where s.active
    order by s.reward, s.slug;
end;
$$;

create or replace function public.get_survey(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  v_user_id uuid := (select auth.uid());
  v_title text;
  v_description text;
  v_reward integer;
  v_found boolean;
  v_completed boolean;
  v_questions jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  v_found := exists (
    select 1 from public.surveys as s where s.slug = p_slug and s.active
  );
  if not v_found then
    raise exception 'Unknown survey' using errcode = '22023';
  end if;

  v_title := (select s.title from public.surveys as s where s.slug = p_slug);
  v_description := (select s.description from public.surveys as s where s.slug = p_slug);
  v_reward := (select s.reward from public.surveys as s where s.slug = p_slug);
  v_completed := exists (
    select 1
    from public.survey_responses as r
    where r.user_id = v_user_id and r.survey_slug = p_slug
  );

  v_questions := (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', q.id,
          'prompt', q.prompt,
          'kind', q.kind,
          'options', to_jsonb(q.options)
        )
        order by q.position
      ),
      '[]'::jsonb
    )
    from public.survey_questions as q
    where q.survey_slug = p_slug
  );

  if not v_completed then
    insert into public.survey_starts (user_id, survey_slug, started_at)
    values (v_user_id, p_slug, now())
    on conflict (user_id, survey_slug) do nothing;
  end if;

  return jsonb_build_object(
    'slug', p_slug,
    'title', v_title,
    'description', v_description,
    'reward', v_reward,
    'completed', v_completed,
    'questions', v_questions
  );
end;
$$;

create or replace function public.submit_survey(p_slug text, p_answers jsonb)
returns table (
  awarded boolean,
  reward integer,
  balance integer
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  v_user_id uuid := (select auth.uid());
  v_email_confirmed boolean;
  v_survey_found boolean;
  v_survey_reward integer;
  v_question_count integer;
  v_options_count integer;
  v_account_balance integer;
  v_existing_reward integer;
  v_started_at timestamptz;
  v_response_id bigint;
  v_element jsonb;
  v_number numeric;
  v_index integer := 0;
  v_now timestamptz := now();
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  v_email_confirmed := (select u.email_confirmed_at is not null from auth.users as u where u.id = v_user_id);
  if not coalesce(v_email_confirmed, false) then
    raise exception 'Email confirmation required' using errcode = '22023';
  end if;

  v_survey_found := exists (
    select 1 from public.surveys as s where s.slug = p_slug and s.active
  );
  if not v_survey_found then
    raise exception 'Unknown survey' using errcode = '22023';
  end if;
  v_survey_reward := (select s.reward from public.surveys as s where s.slug = p_slug);

  insert into public.daily_faucet_accounts (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  v_account_balance := (
    select account.points
    from public.daily_faucet_accounts as account
    where account.user_id = v_user_id
    for update
  );

  v_existing_reward := (
    select r.reward
    from public.survey_responses as r
    where r.user_id = v_user_id and r.survey_slug = p_slug
  );
  if v_existing_reward is not null then
    return query select false, v_existing_reward, v_account_balance;
    return;
  end if;

  v_question_count := (select count(*)::integer from public.survey_questions as q where q.survey_slug = p_slug);

  if p_answers is null
    or jsonb_typeof(p_answers) is distinct from 'array'
    or jsonb_array_length(p_answers) <> v_question_count then
    raise exception 'Invalid answers' using errcode = '22023';
  end if;

  for v_options_count in
    select cardinality(q.options)
    from public.survey_questions as q
    where q.survey_slug = p_slug
    order by q.position
  loop
    v_element := p_answers -> v_index;
    if jsonb_typeof(v_element) is distinct from 'number' then
      raise exception 'Invalid answers' using errcode = '22023';
    end if;
    v_number := (v_element #>> '{}')::numeric;
    if v_number <> trunc(v_number) or v_number < 0 or v_number >= v_options_count then
      raise exception 'Invalid answers' using errcode = '22023';
    end if;
    v_index := v_index + 1;
  end loop;

  v_started_at := (
    select st.started_at
    from public.survey_starts as st
    where st.user_id = v_user_id and st.survey_slug = p_slug
  );
  if v_started_at is null then
    raise exception 'Survey not started' using errcode = 'P0001';
  end if;

  if extract(epoch from (v_now - v_started_at)) < v_question_count * 3 then
    raise exception 'Too fast' using errcode = 'P0001';
  end if;

  if v_account_balance > 2147483647 - v_survey_reward then
    raise exception 'Points balance limit exceeded' using errcode = '22003';
  end if;

  insert into public.survey_responses (user_id, survey_slug, answers, reward, created_at)
  values (v_user_id, p_slug, p_answers, v_survey_reward, v_now)
  returning survey_responses.id into v_response_id;

  update public.daily_faucet_accounts as account
  set points = account.points + v_survey_reward,
      updated_at = v_now
  where account.user_id = v_user_id
  returning account.points into v_account_balance;

  insert into public.reward_ledger (user_id, source_type, source_id, points, balance_after, created_at)
  values (v_user_id, 'survey', v_response_id, v_survey_reward, v_account_balance, v_now);

  return query select true, v_survey_reward, v_account_balance;
end;
$$;

-- ---------------------------------------------------------------------------
-- VIDEOS
-- ---------------------------------------------------------------------------
create or replace function public.list_videos()
returns table (
  id text,
  title text,
  channel text,
  duration_seconds integer,
  reward integer,
  lang text,
  watched boolean,
  watched_today integer,
  daily_limit integer
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  v_user_id uuid := (select auth.uid());
  v_day_start timestamptz := date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  v_watched_today integer;
  v_daily_limit constant integer := 5;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  v_watched_today := (
    select count(*)::integer
    from public.video_views as w
    where w.user_id = v_user_id and w.created_at >= v_day_start
  );

  return query
    select
      v.id,
      v.title,
      v.channel,
      v.duration_seconds,
      v.reward,
      v.lang,
      exists (
        select 1
        from public.video_views as w
        where w.user_id = v_user_id and w.video_id = v.id
      ),
      v_watched_today,
      v_daily_limit
    from public.earn_videos as v
    where v.active
    order by v.duration_seconds, v.id;
end;
$$;

create or replace function public.get_video_status()
returns table (
  watched_today integer,
  daily_limit integer,
  remaining integer
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  v_user_id uuid := (select auth.uid());
  v_day_start timestamptz := date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  v_watched_today integer;
  v_daily_limit constant integer := 5;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  v_watched_today := (
    select count(*)::integer
    from public.video_views as w
    where w.user_id = v_user_id and w.created_at >= v_day_start
  );

  return query
    select v_watched_today, v_daily_limit, greatest(v_daily_limit - v_watched_today, 0);
end;
$$;

create or replace function public.start_video(p_video_id text)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  v_user_id uuid := (select auth.uid());
  v_email_confirmed boolean;
  v_video_found boolean;
  v_viewed boolean;
  v_now timestamptz := now();
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  v_email_confirmed := (select u.email_confirmed_at is not null from auth.users as u where u.id = v_user_id);
  if not coalesce(v_email_confirmed, false) then
    raise exception 'Email confirmation required' using errcode = '22023';
  end if;

  v_video_found := exists (
    select 1 from public.earn_videos as v where v.id = p_video_id and v.active
  );
  if not v_video_found then
    raise exception 'Unknown video' using errcode = '22023';
  end if;

  v_viewed := exists (
    select 1
    from public.video_views as w
    where w.user_id = v_user_id and w.video_id = p_video_id
  );

  insert into public.video_starts as vs (user_id, video_id, started_at)
  values (v_user_id, p_video_id, v_now)
  on conflict (user_id, video_id) do update
    set started_at = v_now
    where not v_viewed
      and vs.started_at < v_now - interval '24 hours';

  return (
    select vs.started_at
    from public.video_starts as vs
    where vs.user_id = v_user_id and vs.video_id = p_video_id
  );
end;
$$;

create or replace function public.complete_video(p_video_id text)
returns table (
  awarded boolean,
  reward integer,
  balance integer
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  v_user_id uuid := (select auth.uid());
  v_email_confirmed boolean;
  v_video_found boolean;
  v_duration integer;
  v_video_reward integer;
  v_account_balance integer;
  v_existing_reward integer;
  v_started_at timestamptz;
  v_watched_today integer;
  v_view_id bigint;
  v_day_start timestamptz := date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  v_daily_limit constant integer := 5;
  v_now timestamptz := now();
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  v_email_confirmed := (select u.email_confirmed_at is not null from auth.users as u where u.id = v_user_id);
  if not coalesce(v_email_confirmed, false) then
    raise exception 'Email confirmation required' using errcode = '22023';
  end if;

  v_video_found := exists (
    select 1 from public.earn_videos as v where v.id = p_video_id and v.active
  );
  if not v_video_found then
    raise exception 'Unknown video' using errcode = '22023';
  end if;
  v_duration := (select v.duration_seconds from public.earn_videos as v where v.id = p_video_id);
  v_video_reward := (select v.reward from public.earn_videos as v where v.id = p_video_id);

  insert into public.daily_faucet_accounts (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  v_account_balance := (
    select account.points
    from public.daily_faucet_accounts as account
    where account.user_id = v_user_id
    for update
  );

  v_existing_reward := (
    select w.reward
    from public.video_views as w
    where w.user_id = v_user_id and w.video_id = p_video_id
  );
  if v_existing_reward is not null then
    return query select false, v_existing_reward, v_account_balance;
    return;
  end if;

  v_started_at := (
    select vs.started_at
    from public.video_starts as vs
    where vs.user_id = v_user_id and vs.video_id = p_video_id
  );
  if v_started_at is null then
    raise exception 'Video not started' using errcode = 'P0001';
  end if;

  if extract(epoch from (v_now - v_started_at)) < v_duration * 0.8 then
    raise exception 'Video not finished' using errcode = 'P0001';
  end if;

  v_watched_today := (
    select count(*)::integer
    from public.video_views as w
    where w.user_id = v_user_id and w.created_at >= v_day_start
  );
  if v_watched_today >= v_daily_limit then
    raise exception 'Daily video limit reached' using errcode = 'P0001';
  end if;

  if v_account_balance > 2147483647 - v_video_reward then
    raise exception 'Points balance limit exceeded' using errcode = '22003';
  end if;

  insert into public.video_views (user_id, video_id, reward, created_at)
  values (v_user_id, p_video_id, v_video_reward, v_now)
  returning video_views.id into v_view_id;

  update public.daily_faucet_accounts as account
  set points = account.points + v_video_reward,
      updated_at = v_now
  where account.user_id = v_user_id
  returning account.points into v_account_balance;

  insert into public.reward_ledger (user_id, source_type, source_id, points, balance_after, created_at)
  values (v_user_id, 'video', v_view_id, v_video_reward, v_account_balance, v_now);

  return query select true, v_video_reward, v_account_balance;
end;
$$;

-- ---------------------------------------------------------------------------
-- TRIVIA
-- ---------------------------------------------------------------------------
create or replace function public.get_daily_trivia()
returns table (
  id bigint,
  prompt text,
  options text[],
  answered boolean,
  your_answer integer,
  correct boolean,
  explanation text,
  correct_index integer
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  v_user_id uuid := (select auth.uid());
  v_today date := (now() at time zone 'utc')::date;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  return query
    select
      q.id,
      q.prompt,
      q.options,
      (a.id is not null),
      a.answer_index::integer,
      a.correct,
      case when a.id is not null then q.explanation else null end,
      case when a.id is not null then q.correct_index::integer else null end
    from public.trivia_daily_pick(v_today) as pick
    join public.trivia_questions as q on q.id = pick.question_id
    left join public.trivia_answers as a
      on a.question_id = q.id
      and a.user_id = v_user_id
      and a.answer_date = v_today
    order by pick.pick_order;
end;
$$;

create or replace function public.answer_trivia(p_question_id bigint, p_answer_index integer)
returns table (
  correct boolean,
  correct_index integer,
  explanation text,
  reward integer,
  balance integer
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  v_user_id uuid := (select auth.uid());
  v_email_confirmed boolean;
  v_today date := (now() at time zone 'utc')::date;
  v_is_today boolean;
  v_correct_index integer;
  v_explanation text;
  v_correct boolean;
  v_reward integer;
  v_account_balance integer;
  v_answer_id bigint;
  v_now timestamptz := now();
  v_reward_correct constant integer := 4;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  v_email_confirmed := (select u.email_confirmed_at is not null from auth.users as u where u.id = v_user_id);
  if not coalesce(v_email_confirmed, false) then
    raise exception 'Email confirmation required' using errcode = '22023';
  end if;

  if p_question_id is null or p_answer_index is null or p_answer_index not between 0 and 3 then
    raise exception 'Invalid answer' using errcode = '22023';
  end if;

  v_is_today := exists (
    select 1
    from public.trivia_daily_pick(v_today) as pick
    where pick.question_id = p_question_id
  );
  if not v_is_today then
    raise exception 'Question not available today' using errcode = '22023';
  end if;

  insert into public.daily_faucet_accounts (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  v_account_balance := (
    select account.points
    from public.daily_faucet_accounts as account
    where account.user_id = v_user_id
    for update
  );

  if exists (
    select 1
    from public.trivia_answers as a
    where a.user_id = v_user_id
      and a.answer_date = v_today
      and a.question_id = p_question_id
  ) then
    raise exception 'Already answered' using errcode = 'P0001';
  end if;

  v_correct_index := (select q.correct_index::integer from public.trivia_questions as q where q.id = p_question_id);
  v_explanation := (select q.explanation from public.trivia_questions as q where q.id = p_question_id);
  v_correct := (p_answer_index = v_correct_index);
  v_reward := case when v_correct then v_reward_correct else 0 end;

  if v_reward > 0 and v_account_balance > 2147483647 - v_reward then
    raise exception 'Points balance limit exceeded' using errcode = '22003';
  end if;

  insert into public.trivia_answers (user_id, question_id, answer_index, correct, reward, answer_date, created_at)
  values (v_user_id, p_question_id, p_answer_index, v_correct, v_reward, v_today, v_now)
  returning trivia_answers.id into v_answer_id;

  if v_reward > 0 then
    update public.daily_faucet_accounts as account
    set points = account.points + v_reward,
        updated_at = v_now
    where account.user_id = v_user_id
    returning account.points into v_account_balance;

    insert into public.reward_ledger (user_id, source_type, source_id, points, balance_after, created_at)
    values (v_user_id, 'trivia', v_answer_id, v_reward, v_account_balance, v_now);
  end if;

  return query select v_correct, v_correct_index, v_explanation, v_reward, v_account_balance;
end;
$$;

-- ---------------------------------------------------------------------------
-- SCRATCH CARD
-- ---------------------------------------------------------------------------
create or replace function public.get_scratch_status()
returns table (
  available boolean,
  last_reward integer,
  next_available_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  v_user_id uuid := (select auth.uid());
  v_today date := (now() at time zone 'utc')::date;
  v_played boolean;
  v_last_reward integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  v_played := exists (
    select 1
    from public.scratch_plays as p
    where p.user_id = v_user_id and p.play_date = v_today
  );
  v_last_reward := (
    select p.reward
    from public.scratch_plays as p
    where p.user_id = v_user_id
    order by p.play_date desc
    limit 1
  );

  return query
    select
      not v_played,
      v_last_reward,
      case when v_played then ((v_today + 1)::timestamp at time zone 'utc') else null end;
end;
$$;

create or replace function public.play_scratch()
returns table (
  reward integer,
  balance integer
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  v_user_id uuid := (select auth.uid());
  v_email_confirmed boolean;
  v_today date := (now() at time zone 'utc')::date;
  v_account_balance integer;
  v_roll double precision := random() * 100;
  v_reward integer;
  v_play_id bigint;
  v_now timestamptz := now();
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  v_email_confirmed := (select u.email_confirmed_at is not null from auth.users as u where u.id = v_user_id);
  if not coalesce(v_email_confirmed, false) then
    raise exception 'Email confirmation required' using errcode = '22023';
  end if;

  insert into public.daily_faucet_accounts (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  v_account_balance := (
    select account.points
    from public.daily_faucet_accounts as account
    where account.user_id = v_user_id
    for update
  );

  if exists (
    select 1
    from public.scratch_plays as p
    where p.user_id = v_user_id and p.play_date = v_today
  ) then
    raise exception 'Already played today' using errcode = 'P0001';
  end if;

  v_reward := case
    when v_roll < 40 then 1
    when v_roll < 70 then 2
    when v_roll < 85 then 3
    when v_roll < 95 then 5
    when v_roll < 99 then 8
    else 15
  end;

  if v_account_balance > 2147483647 - v_reward then
    raise exception 'Points balance limit exceeded' using errcode = '22003';
  end if;

  insert into public.scratch_plays (user_id, play_date, reward, created_at)
  values (v_user_id, v_today, v_reward, v_now)
  returning scratch_plays.id into v_play_id;

  update public.daily_faucet_accounts as account
  set points = account.points + v_reward,
      updated_at = v_now
  where account.user_id = v_user_id
  returning account.points into v_account_balance;

  insert into public.reward_ledger (user_id, source_type, source_id, points, balance_after, created_at)
  values (v_user_id, 'scratch', v_play_id, v_reward, v_account_balance, v_now);

  return query select v_reward, v_account_balance;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reward history: same signature as migration 0007, now with details for the
-- new source types.
-- ---------------------------------------------------------------------------
create or replace function public.get_reward_history(
  p_limit integer default 50,
  p_offset integer default 0,
  p_source text default null
)
returns table (
  id bigint,
  source_type text,
  detail text,
  points integer,
  balance_after integer,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  v_user_id uuid := (select auth.uid());
  v_limit integer := greatest(1, least(coalesce(p_limit, 50), 200));
  v_offset integer := greatest(0, coalesce(p_offset, 0));
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  return query
    select
      l.id,
      l.source_type,
      case l.source_type
        when 'earn_task' then c.task_key
        when 'survey' then sr.survey_slug
        when 'video' then vv.video_id
        when 'trivia' then ta.answer_date::text
        when 'scratch' then sp.play_date::text
        else null
      end,
      l.points,
      l.balance_after,
      l.created_at
    from public.reward_ledger as l
    left join public.earn_task_completions as c
      on l.source_type = 'earn_task'
      and c.id = l.source_id
      and c.user_id = l.user_id
    left join public.survey_responses as sr
      on l.source_type = 'survey'
      and sr.id = l.source_id
      and sr.user_id = l.user_id
    left join public.video_views as vv
      on l.source_type = 'video'
      and vv.id = l.source_id
      and vv.user_id = l.user_id
    left join public.trivia_answers as ta
      on l.source_type = 'trivia'
      and ta.id = l.source_id
      and ta.user_id = l.user_id
    left join public.scratch_plays as sp
      on l.source_type = 'scratch'
      and sp.id = l.source_id
      and sp.user_id = l.user_id
    where l.user_id = v_user_id
      and (p_source is null or l.source_type = p_source)
    order by l.created_at desc, l.id desc
    limit v_limit
    offset v_offset;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants: authenticated only.
-- ---------------------------------------------------------------------------
revoke all on function public.list_surveys() from public, anon;
revoke all on function public.get_survey(text) from public, anon;
revoke all on function public.submit_survey(text, jsonb) from public, anon;
revoke all on function public.list_videos() from public, anon;
revoke all on function public.get_video_status() from public, anon;
revoke all on function public.start_video(text) from public, anon;
revoke all on function public.complete_video(text) from public, anon;
revoke all on function public.get_daily_trivia() from public, anon;
revoke all on function public.answer_trivia(bigint, integer) from public, anon;
revoke all on function public.get_scratch_status() from public, anon;
revoke all on function public.play_scratch() from public, anon;
revoke all on function public.get_reward_history(integer, integer, text) from public, anon;

grant execute on function public.list_surveys() to authenticated;
grant execute on function public.get_survey(text) to authenticated;
grant execute on function public.submit_survey(text, jsonb) to authenticated;
grant execute on function public.list_videos() to authenticated;
grant execute on function public.get_video_status() to authenticated;
grant execute on function public.start_video(text) to authenticated;
grant execute on function public.complete_video(text) to authenticated;
grant execute on function public.get_daily_trivia() to authenticated;
grant execute on function public.answer_trivia(bigint, integer) to authenticated;
grant execute on function public.get_scratch_status() to authenticated;
grant execute on function public.play_scratch() to authenticated;
grant execute on function public.get_reward_history(integer, integer, text) to authenticated;
