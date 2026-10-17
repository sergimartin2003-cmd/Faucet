# Faucet

Aplicación web de recompensas: los usuarios ganan puntos con encuestas y ofertas de BitLabs (y un bonus por referidos) y los retiran en criptomonedas. 1.000 puntos = 1 USD; retiro mínimo 5.000 puntos. Incluye niveles, logros, clasificación mensual y un casino. Disponible en español e inglés.

Stack: Vite, React 19, TypeScript, TanStack Query y Supabase (Auth, Postgres con RLS y funciones `security definer`).

## Desarrollo

Requisitos: Node.js 20.19+ o 22.12+.

```bash
npm install
cp .env.example .env.local   # completa las variables
npm run dev
```

Comprobaciones: `npm run lint`, `npm test`, `npm run build`. Se ejecutan también en GitHub Actions.

## Variables de entorno

| Variable | Descripción |
|---|---|
| `VITE_SUPABASE_URL` | URL del proyecto Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Clave pública (o `VITE_SUPABASE_ANON_KEY` en proyectos antiguos) |
| `VITE_TURNSTILE_SITE_KEY` | Opcional. Clave de Cloudflare Turnstile; actívalo también en Supabase → Authentication → Attack Protection |
| `VITE_CONTACT_EMAIL` | Opcional. Correo de contacto mostrado en Ayuda y en las páginas legales |
| `VITE_BITLABS_TOKEN` | Opcional. App token de BitLabs: activa la sección Ofertas y encuestas |
| `VITE_AADS_UNIT_ID` | Opcional. ID numérico de un bloque de anuncios de A-ADS: muestra un banner en la portada y en el panel |

Los valores públicos de producción (token de BitLabs, bloque de A-ADS) están en `.env.production`; una variable de Vercel con el mismo nombre tiene prioridad. Nunca pongas la `service_role` key ni secretos en variables `VITE_*`.

## Supabase

1. Crea un proyecto y aplica en orden, desde el SQL Editor, todas las migraciones de `supabase/migrations/` (`202610130007` añade tareas, historial paginado y clasificación mensual; `202610140008` añade encuestas, vídeos, trivia diaria y rasca y gana, todo validado en el servidor).
2. En **Authentication → Providers** habilita Email y configura las URLs de sitio y redirección (local y producción).
3. Configura un SMTP propio en **Authentication → SMTP Settings**: el SMTP por defecto de Supabase solo entrega a miembros del equipo y tiene límites muy bajos.
4. Para los códigos de recuperación MFA, el proyecto debe tener habilitada esa función de Supabase Auth.
5. Despliega la función `supabase/functions/delete-account` (con verificación de JWT): es la que usa Ajustes → Eliminar cuenta para borrar al usuario con la API de administración.
6. Da permisos de administrador (panel de retiros) insertando el id del usuario en `public.app_admins`:
   `insert into public.app_admins (user_id) values ('<uuid>');`

## Estructura

```
src/
  app/        sesión, shell del panel, navegación
  features/   páginas del panel (ofertas, retirar, admin, casino, temporada,
              logros, referidos, historial, mercados, perfil, seguridad, ajustes, ayuda)
  i18n/       traducciones al inglés
  landing/    portada, autenticación y páginas legales
  lib/        cliente Supabase, consultas, reglas del juego, tema, router
  styles/     tokens de diseño y estilos base
  ui/         componentes reutilizables
supabase/     migraciones y función de callback para offerwalls
```

## Reglas del juego

- Los puntos solo se ganan con ofertas y encuestas de socios (BitLabs) y con el bonus de referidos: 100 puntos cuando el referido completa su primera oferta, hasta 20 referidos; el código solo vale los primeros 7 días de una cuenta.
- El faucet diario, las encuestas propias, los vídeos, la trivia, el rasca y las tareas se retiraron (`202610170014`): sus funciones ya no se pueden llamar y sus datos se conservan como historial.
- Nivel: 1.000 XP por nivel (1 punto ganado = 1 XP). La clasificación usa el mes natural UTC.

Toda la acreditación de puntos ocurre en funciones SQL del servidor; el navegador solo las invoca.

## Retiros

- `request_withdrawal(puntos, método, dirección)` descuenta los puntos y crea un retiro pendiente (uno a la vez, correo verificado, mínimo 5.000). Métodos: USDT (BEP20), Binance Pay, LTC, TRX y DOGE; las direcciones se validan en el cliente y en SQL.
- Los administradores (`app_admins`) ven la sección **Administración → Retiros**: copian el destino, pagan desde su exchange o wallet y lo marcan como pagado con el hash de la transacción, o lo rechazan (los puntos vuelven al usuario). El panel muestra señales de riesgo: cuenta reciente, ofertas anuladas, ganancias del casino.
- Si BitLabs anula una oferta (callback con valor negativo), `reverse_offerwall_completion` descuenta esos puntos sin dejar el saldo en negativo y lo registra en `offerwall_reversals`.

## Faucets de creadores

Cualquier usuario puede crear su propia faucet (`/dashboard/faucets`) y publicarla en `/f/<nombre>`; el directorio público está en `/faucets`.

- **Sin custodia:** cada faucet se paga con la API key de FaucetPay de su creador, desde su propio saldo en FaucetPay. La key se valida contra FaucetPay (`faucet-key`) y se guarda en Supabase Vault; solo las funciones del servidor la leen.
- **Reclamos:** `faucet-claim` verifica Cloudflare Turnstile (secreto `TURNSTILE_SECRET_KEY`), aplica los límites (intervalo y máximo diario por dirección y por IP cifrada) en `faucet_reserve_claim`, envía el pago con `POST https://faucetpay.io/api/v1/send` y registra el resultado. Si FaucetPay responde sin fondos o key inválida, la faucet se pausa sola.
- **Ingresos de la plataforma** (`platform_settings`, editable en Administración → Ingresos y ajustes):
  - Reparto de anuncios: el `ad_share_pct` % de los banners de cada faucet muestra el bloque de A-ADS de la plataforma (30 % por defecto).
  - Comisión por pago (`fee_bps`, 5 % por defecto, **desactivada** hasta activarla): se envía desde la faucet del creador a la cuenta de FaucetPay indicada. Actívala solo cuando FaucetPay confirme que lo permite.
  - Faucets destacadas: el creador paga 1.000 puntos por día (`feature_faucet`) para salir primero en el directorio.
- **Panel de desarrollador:** Administración muestra cada transacción (faucet, creador, destino, IP cifrada, importe, estado, `payout_id` y `payout_user_hash` de FaucetPay, comisión y errores) con exportación a CSV, la lista de faucets (pausar o suspender), los destacados vendidos y el resumen de ingresos.
- Monedas: BTC, ETH, DOGE, LTC, BCH, DASH, DGB, TRX, USDT, ZEC, BNB, SOL, XRP y TON; los importes son enteros en satoshis (1e-8), como espera FaucetPay.

## Idiomas

Español (idioma fuente) e inglés. Los textos se escriben en español dentro de `t()` (`src/lib/i18n.ts`) y la traducción inglesa está en `src/i18n/`, con la frase española como clave. El test `src/i18n/i18n.test.ts` falla si falta alguna traducción. El idioma se elige con el botón ES/EN o en Ajustes y se guarda en el navegador.

## Casino

Doce juegos (dados, limbo, crash, cara o cruz, ruleta, tragaperras, plinko, keno, rueda, minas, hi-lo y blackjack) que se juegan con los puntos. Las jugadas no cuentan para el nivel, los logros ni la clasificación (no tocan `reward_ledger`). Como los puntos se pueden retirar, operar el casino requiere la licencia de juego correspondiente y cumplir sus obligaciones (verificación de identidad y edad, límites, autoexclusión).

- Todo se resuelve en funciones SQL `security definer` (`202610170010`–`202610170013`); las partidas de varias jugadas guardan las cartas y las minas en `casino_sessions`, que el cliente no puede leer.
- *Provably fair*: `HMAC_SHA256(semilla_servidor, "semilla_cliente:nonce:cursor")`. El jugador ve el hash de la semilla antes de jugar y la puede revelar desde Juego justo para verificar cualquier jugada en el navegador (`src/lib/casino.ts`).
- RTP entre el 96 % (tragaperras) y el 99 %. Apuesta máxima 100.000 puntos y pago máximo por jugada 1.000.000.

## Ofertas y publicidad

- **BitLabs** (ofertas y encuestas): `supabase/functions/bitlabs-callback` recibe las recompensas, verifica la firma HMAC-SHA1 con el secreto `BITLABS_APP_SECRET` y acredita los puntos una sola vez por transacción (`credit_offerwall_completion`). Los valores negativos (conciliaciones) descuentan los puntos. URL de callback en BitLabs:
  `https://<ref>.supabase.co/functions/v1/bitlabs-callback?uid=[%USER:UID%]&tx=[%TX%]&val=[%VALUE:CURRENCY%]&type=[%TYPE%]`.
- **A-ADS**: banner adaptativo (`src/components/AdSlot.tsx`) cuando `VITE_AADS_UNIT_ID` está definido.
- `supabase/functions/offerwall-callback` sigue siendo una base genérica para otros proveedores.

## Mercados

La sección Mercados consulta la API pública de Binance de solo lectura con fines informativos.
