import { useSyncExternalStore } from 'react'

const NAVIGATE_EVENT = 'faucet:navigate'

function subscribe(callback: () => void) {
  window.addEventListener('popstate', callback)
  window.addEventListener(NAVIGATE_EVENT, callback)
  return () => {
    window.removeEventListener('popstate', callback)
    window.removeEventListener(NAVIGATE_EVENT, callback)
  }
}

export function usePathname() {
  return useSyncExternalStore(subscribe, () => window.location.pathname, () => '/')
}

export function navigate(to: string, options: { replace?: boolean } = {}) {
  const current = window.location.pathname + window.location.search + window.location.hash
  if (to !== current) {
    if (options.replace) window.history.replaceState(null, '', to)
    else window.history.pushState(null, '', to)
    window.dispatchEvent(new Event(NAVIGATE_EVENT))
  }
  window.scrollTo(0, 0)
}
