// BitLabs server-to-server reward callback.
//
// Configure in BitLabs (Apps -> your app -> Callbacks), reward callback URL:
//   https://<project-ref>.supabase.co/functions/v1/bitlabs-callback?uid=[%USER:UID%]&tx=[%TX%]&val=[%VALUE:CURRENCY%]&type=[%TYPE%]
// and set the BITLABS_APP_SECRET function secret. BitLabs appends &hash=<hex HMAC-SHA1 of
// the full URL, keyed with the app secret>; the URL must be hashed exactly as received.
// Rewards are credited once per transaction id through public.credit_offerwall_completion.

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const PROVIDER = 'bitlabs'

const text = (body: string, status: number) => new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } })

// Logs why a callback was answered the way it was, with the signature removed from the URL.
const reply = (body: string, status: number, url: string, detail = '') => {
  console.log(JSON.stringify({ status, body, detail, url: url.replace(/([?&]hash=)[^&]*/, '$1<redacted>') }))
  return text(body, status)
}

async function hmacSha1Hex(secret: string, message: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'])
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message)))
  return Array.from(signature, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

Deno.serve(async (request: Request) => {
  const raw = request.url
  if (request.method !== 'GET' && request.method !== 'POST') return reply('Method not allowed', 405, raw)

  const secret = Deno.env.get('BITLABS_APP_SECRET')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.replace(/\/$/, '')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!secret || !supabaseUrl || !serviceRoleKey) return reply('Callback is not configured', 500, raw, `secret set: ${Boolean(secret)}`)

  const hashAt = raw.lastIndexOf('&hash=')
  const received = new URL(raw).searchParams.get('hash')?.toLowerCase() ?? ''
  if (hashAt < 0 || !/^[0-9a-f]{40}$/.test(received)) return reply('Invalid hash', 401, raw, 'missing or malformed hash')

  // The runtime may see an internal URL, so also check the public one BitLabs called.
  const query = raw.slice(raw.indexOf('?') + 1, hashAt)
  const candidates = [raw.slice(0, hashAt), `${supabaseUrl}/functions/v1/bitlabs-callback?${query}`]
  const valid = (await Promise.all(candidates.map((url) => hmacSha1Hex(secret, url)))).some((hash) => safeEqual(hash, received))
  if (!valid) return reply('Invalid hash', 401, raw, 'signature mismatch')

  const params = new URL(raw).searchParams
  const uid = params.get('uid') ?? ''
  const tx = params.get('tx') ?? ''
  const value = Number(params.get('val'))
  if (!UUID_PATTERN.test(uid) || tx.length < 1 || tx.length > 128 || !Number.isFinite(value)) return reply('Invalid parameters', 400, raw)

  // Reconciliations (negative values) and zero-value events are acknowledged but not credited.
  const points = Math.min(100_000, Math.round(value))
  if (points < 1) return reply('OK', 200, raw, 'not credited')

  let response: Response
  try {
    response = await fetch(`${supabaseUrl}/rest/v1/rpc/credit_offerwall_completion`, {
      method: 'POST',
      headers: { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ p_provider: PROVIDER, p_external_transaction_id: tx, p_user_id: uid, p_points: points }),
    })
  } catch {
    return reply('Reward processing unavailable', 502, raw)
  }

  if (response.ok) return reply('OK', 200, raw, `credited ${points}`)
  const detail = await response.text()
  // Unknown user (deleted account) or a replayed transaction: acknowledge so BitLabs stops retrying.
  if (detail.includes('23503') || detail.includes('23505')) return reply('OK', 200, raw, detail)
  return reply('Reward processing failed', 502, raw, detail)
})
