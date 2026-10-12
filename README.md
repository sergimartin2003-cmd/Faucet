# Faucet

Aplicación web de recompensas promocionales: reclamación diaria con rachas, tareas únicas, referidos, clasificación mensual, niveles y logros. Los puntos son internos: no tienen valor monetario y no se pueden retirar ni transferir.

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

Nunca pongas la `service_role` key en variables `VITE_*`.

## Supabase

1. Crea un proyecto y aplica en orden, desde el SQL Editor, todas las migraciones de `supabase/migrations/` (la última, `202610130007`, añade tareas, historial paginado y clasificación mensual).
2. En **Authentication → Providers** habilita Email y configura las URLs de sitio y redirección (local y producción).
3. Configura un SMTP propio en **Authentication → SMTP Settings**: el SMTP por defecto de Supabase solo entrega a miembros del equipo y tiene límites muy bajos.
4. Para los códigos de recuperación MFA, el proyecto debe tener habilitada esa función de Supabase Auth.

## Estructura

```
src/
  app/        sesión, shell del panel, navegación
  features/   páginas del panel (faucet, tareas, temporada, logros, referidos,
              historial, mercados, perfil, seguridad, ajustes, ayuda)
  landing/    portada, autenticación y páginas legales
  lib/        cliente Supabase, consultas, reglas del juego, tema, router
  styles/     tokens de diseño y estilos base
  ui/         componentes reutilizables
supabase/     migraciones y función de callback para offerwalls
```

## Reglas del juego

- Faucet: 10 puntos + 2 por día de racha (máximo 22), una vez cada 24 h; la racha se pierde tras 48 h. Requiere correo verificado.
- Tareas únicas: perfil (25), detalles del perfil (10), verificación en dos pasos (30).
- Referidos: 15 puntos por referido verificado, hasta 20; el código solo es válido los primeros 7 días de una cuenta.
- Nivel: 1 punto = 1 XP, 100 XP por nivel. La clasificación usa el mes natural UTC.

Toda la acreditación de puntos ocurre en funciones SQL del servidor; el navegador solo las invoca.

## Offerwalls

No hay ningún proveedor activo. `supabase/functions/offerwall-callback` es una base genérica (firma HMAC, antigüedad, idempotencia) que debe adaptarse al contrato del proveedor elegido antes de usarse.

## Mercados

La sección Mercados consulta la API pública de Binance de solo lectura con fines informativos.
