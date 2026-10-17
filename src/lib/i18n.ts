import { useSyncExternalStore } from 'react'
import { EN } from '../i18n'

// Spanish is the source language: every UI string is written in Spanish and
// wrapped in t(). English translations live in src/i18n, keyed by the Spanish
// text. Missing entries fall back to Spanish.
export type Lang = 'es' | 'en'

const STORAGE_KEY = 'faucet:lang'
const listeners = new Set<() => void>()

function detect(): Lang {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === 'es' || stored === 'en') return stored
  } catch { /* storage unavailable */ }
  return /^es\b/i.test(navigator.language) ? 'es' : 'en'
}

let current: Lang = typeof window === 'undefined' ? 'es' : detect()
if (typeof document !== 'undefined') document.documentElement.lang = current

export const getLang = () => current

export function setLang(lang: Lang) {
  if (lang === current) return
  current = lang
  try { window.localStorage.setItem(STORAGE_KEY, lang) } catch { /* storage unavailable */ }
  document.documentElement.lang = lang
  listeners.forEach((listener) => listener())
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export const useLang = () => useSyncExternalStore(subscribe, getLang, () => 'es' as Lang)

export function t(text: string, vars?: Record<string, string | number>) {
  const out = current === 'en' ? (EN[text] ?? text) : text
  return vars ? out.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match)) : out
}

// BCP 47 locale for Intl formatters.
export const locale = () => (current === 'en' ? 'en-US' : 'es-ES')
