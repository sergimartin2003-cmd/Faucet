import App from './App.tsx'
import { useLang } from './lib/i18n'

// Remounting on a language change re-renders every translated string; data stays in the query cache.
export default function Root() {
  const lang = useLang()
  return <App key={lang} />
}
