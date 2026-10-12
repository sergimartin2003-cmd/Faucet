import { useCallback, useEffect, useState } from 'react'

export type ThemePreference = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'faucet:theme'
const THEME_COLORS = { dark: '#0a0c10', light: '#f6f7f9' }

function readPreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  } catch { /* storage unavailable */ }
  return 'system'
}

export function resolveTheme(preference: ThemePreference): 'light' | 'dark' {
  if (preference !== 'system') return preference
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

export function applyTheme(preference: ThemePreference) {
  const theme = resolveTheme(preference)
  document.documentElement.dataset.theme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme])
  window.dispatchEvent(new Event('faucet:theme-applied'))
}

export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(readPreference)

  useEffect(() => {
    applyTheme(preference)
    if (preference !== 'system') return
    const query = window.matchMedia('(prefers-color-scheme: light)')
    const listener = () => applyTheme('system')
    query.addEventListener('change', listener)
    return () => query.removeEventListener('change', listener)
  }, [preference])

  const update = useCallback((next: ThemePreference) => {
    try { window.localStorage.setItem(STORAGE_KEY, next) } catch { /* storage unavailable */ }
    setPreference(next)
  }, [])

  return { preference, setPreference: update }
}

export function useResolvedTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'))
  useEffect(() => {
    const sync = () => setTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark')
    window.addEventListener('faucet:theme-applied', sync)
    return () => window.removeEventListener('faucet:theme-applied', sync)
  }, [])
  return theme
}
