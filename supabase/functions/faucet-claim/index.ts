// Public claim endpoint for creator faucets.
//
// The payout always goes from the creator's own FaucetPay faucet balance to the
// claimer: FaucetFree only relays the request with the creator's API key (kept in
// Supabase Vault). When the platform fee is enabled, a second payout sends the fee
// from the same faucet to the platform's FaucetPay account.
//
// Secrets: TURNSTILE_SECRET_KEY (Cloudflare Turnstile). SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY are provided by the runtime.

const FAUCETPAY_SEND = 'https://faucetpay.io/api/v1/send'
const TURNSTILE_VERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{2,39}$/
const ADDRESS_PATTERN = /^[A-Za-z0-9@._+:-]{3,120}$/

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
}

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

async function hmacHex(key: string, message: string) {
  const cryptoKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message)))
  return Array.from(signature, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

type FaucetPayResult = { status?: number; message?: string; balance?: string | number; payout_id?: string | number; payout_user_hash?: string }

async function faucetPaySend(apiKey: string, to: string, amount: number, currency: string, ip: string): Promise<FaucetPayResult> {
  const body = new URLSearchParams({ api_key: apiKey, to, amount: String(amount), currency })
  if (ip) body.set('ip_address', ip)
  try {
    const response = await fetch(FAUCETPAY_SEND, { method: 'POST', body, signal: AbortSignal.timeout(15000) })
    return await response.json() as FaucetPayResult
  } catch {
    return { status: 0, message: 'FaucetPay unreachable' }
  }
}

async function rpc(url: string, key: string, fn: string, args: Record<string, unknown>) {
  const response = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify(args),
  })
  const text = await response.text()
  const data = text ? JSON.parse(text) : null
  return { ok: response.ok, data }
}

const toUnits = (value: string | number | undefined) => {
  const number = Number(value)
  return Number.isFinite(number) ? Math.round(number) : null
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS })
  if (request.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.replace(/\/$/, '')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const turnstileSecret = Deno.env.get('TURNSTILE_SECRET_KEY')
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: 'not_configured' }, 500)
  if (!turnstileSecret) return jsonResponse({ error: 'captcha_not_configured' }, 503)

  let input: { slug?: unknown; address?: unknown; captcha?: unknown }
  try { input = await request.json() } catch { return jsonResponse({ error: 'invalid_request' }, 400) }
  const slug = typeof input.slug === 'string' ? input.slug.toLowerCase() : ''
  const address = typeof input.address === 'string' ? input.address.trim() : ''
  const captcha = typeof input.captcha === 'string' ? input.captcha : ''
  if (!SLUG_PATTERN.test(slug) || !captcha) return jsonResponse({ error: 'invalid_request' }, 400)
  if (!ADDRESS_PATTERN.test(address)) return jsonResponse({ error: 'invalid_address' }, 400)

  const ip = (request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0] ?? '').trim()

  const verify = await fetch(TURNSTILE_VERIFY, {
    method: 'POST',
    body: new URLSearchParams({ secret: turnstileSecret, response: captcha, ...(ip ? { remoteip: ip } : {}) }),
  }).then((response) => response.json()).catch(() => ({ success: false }))
  if (!verify.success) return jsonResponse({ error: 'captcha_failed' }, 400)

  const ipHash = await hmacHex(serviceRoleKey, `faucet-ip:${ip || 'unknown'}`)

  const reserved = await rpc(supabaseUrl, serviceRoleKey, 'faucet_reserve_claim', { p_slug: slug, p_address: address, p_ip_hash: ipHash })
  if (!reserved.ok) {
    const message = String(reserved.data?.message ?? '')
    if (message.includes('Claim too soon')) return jsonResponse({ error: 'too_soon', next_at: reserved.data?.details ?? null }, 429)
    if (message.includes('Daily limit')) return jsonResponse({ error: 'daily_limit' }, 429)
    if (message.includes('Invalid address')) return jsonResponse({ error: 'invalid_address' }, 400)
    if (message.includes('Faucet unavailable')) return jsonResponse({ error: 'unavailable' }, 409)
    return jsonResponse({ error: 'server_error' }, 500)
  }

  const claim = reserved.data as { claim_id: number; currency: string; amount: number; fee_amount: number; fee_recipient: string | null; interval_minutes: number; api_key: string }
  const payout = await faucetPaySend(claim.api_key, address, claim.amount, claim.currency, ip)
  const paid = payout.status === 200

  // Insufficient funds or a revoked key stop the faucet until the creator fixes it.
  const pauseReason = payout.status === 402 ? 'Sin fondos en FaucetPay' : payout.status === 401 || payout.status === 403 ? 'API key de FaucetPay no válida' : null

  let feeStatus = 'none'
  let feePayoutId: string | null = null
  let balance = toUnits(payout.balance)
  if (paid && claim.fee_amount > 0 && claim.fee_recipient) {
    const fee = await faucetPaySend(claim.api_key, claim.fee_recipient, claim.fee_amount, claim.currency, '')
    feeStatus = fee.status === 200 ? 'paid' : 'failed'
    feePayoutId = fee.payout_id !== undefined ? String(fee.payout_id) : null
    balance = toUnits(fee.balance) ?? balance
  }

  await rpc(supabaseUrl, serviceRoleKey, 'faucet_finish_claim', {
    p_claim_id: claim.claim_id,
    p_status: paid ? 'paid' : 'failed',
    p_payout_id: payout.payout_id !== undefined ? String(payout.payout_id) : null,
    p_payout_user_hash: payout.payout_user_hash ?? null,
    p_error: paid ? null : `${payout.status ?? 0}: ${payout.message ?? 'unknown error'}`,
    p_balance: balance,
    p_fee_status: feeStatus,
    p_fee_payout_id: feePayoutId,
    p_pause_reason: pauseReason,
  })

  if (!paid) {
    if (payout.status === 456) return jsonResponse({ error: 'address_not_linked' }, 400)
    if (payout.status === 457) return jsonResponse({ error: 'user_blocked' }, 400)
    if (pauseReason) return jsonResponse({ error: 'unavailable' }, 409)
    return jsonResponse({ error: 'payout_failed' }, 502)
  }

  return jsonResponse({
    ok: true,
    amount: claim.amount,
    currency: claim.currency,
    next_at: new Date(Date.now() + claim.interval_minutes * 60_000).toISOString(),
  }, 200)
})
