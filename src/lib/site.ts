export const siteName = 'Faucet'
export const contactEmail = import.meta.env.VITE_CONTACT_EMAIL?.trim() || undefined

// Third-party monetization, active only when configured.
export const bitlabsToken = import.meta.env.VITE_BITLABS_TOKEN?.trim() || undefined
export const aadsUnitId = import.meta.env.VITE_AADS_UNIT_ID?.trim().replace(/\D/g, '') || undefined

// Origin used in links sent by email. Drops a trailing dot in the host
// ("example.com.") so confirmation links never point to a host whose TLS
// certificate the browser rejects.
export function siteOrigin() {
  const { protocol, hostname, port } = window.location
  return `${protocol}//${hostname.replace(/\.$/, '')}${port ? `:${port}` : ''}`
}
