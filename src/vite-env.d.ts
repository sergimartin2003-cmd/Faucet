/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
  readonly VITE_TURNSTILE_SITE_KEY?: string
  readonly VITE_CONTACT_EMAIL?: string
  readonly VITE_BITLABS_TOKEN?: string
  readonly VITE_AADS_UNIT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}