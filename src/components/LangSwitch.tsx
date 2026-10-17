import { Languages } from 'lucide-react'
import { setLang, t, useLang } from '../lib/i18n'

// Toggles between Spanish and English. The app re-renders from the root on change.
export default function LangSwitch({ className = 'btn btn-ghost btn-sm lang-switch' }: { className?: string }) {
  const lang = useLang()
  const next = lang === 'es' ? 'en' : 'es'
  return <button type="button" className={className} onClick={() => setLang(next)} aria-label={t('Cambiar idioma')} title={next === 'en' ? 'English' : 'Español'}>
    <Languages size={16} /><span style={{ fontWeight: 650, fontSize: 'var(--text-xs)' }}>{lang.toUpperCase()}</span>
  </button>
}
