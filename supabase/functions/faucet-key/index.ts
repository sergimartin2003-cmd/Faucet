// Lets a faucet creator connect their FaucetPay API key and refresh the faucet
// balance. The key is checked against FaucetPay, then stored in Supabase Vault;
// it is never returned to the browser.
//
// POST { faucet_id, api_key? }  — with api_key: validate and store; without: refresh balance.

import { createClient } from 'npm:@supabase/supabase-js@2'

const FAUCETPAY_BALANCE = 'https://faucetpay.io/api/v1/getbalance'
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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

async function faucetPayBalance(apiKey: string, currency: string) {
  try {
    const response = await fetch(FAUCETPAY_BALANCE, {
      method: 'POST',
      body: new URLSearchParams({ api_key: apiKey, currency }),
      signal: AbortSignal.timeout(15000),
    })
    const data = await response.json() as { status?: number; balance?: string | number }
    const balance = Number(data.balance)
    return { ok: data.status === 200 && Number.isFinite(balance), balance: Math.round(balance), status: data.status ?? 0 }
  } catch {
    return { ok: false, balance: 0, status: 0 }
  }
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS })
  if (request.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: 'not_configured' }, 500)

  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: userData, error: userError } = await admin.auth.getUser(token)
  if (userError || !userData.user) return jsonResponse({ error: 'auth_required' }, 401)
  const owner = userData.user.id

  let input: { faucet_id?: unknown; api_key?: unknown }
  try { input = await request.json() } catch { return jsonResponse({ error: 'invalid_request' }, 400) }
  const faucetId = typeof input.faucet_id === 'string' && UUID_PATTERN.test(input.faucet_id) ? input.faucet_id : ''
  const apiKey = typeof input.api_key === 'string' ? input.api_key.trim() : ''
  if (!faucetId || (apiKey && !/^[A-Za-z0-9_-]{16,128}$/.test(apiKey))) return jsonResponse({ error: 'invalid_request' }, 400)

  const { data: faucet } = await admin.from('faucets').select('id, currency, owner_id').eq('id', faucetId).eq('owner_id', owner).maybeSingle()
  if (!faucet) return jsonResponse({ error: 'unknown_faucet' }, 404)

  if (apiKey) {
    const check = await faucetPayBalance(apiKey, faucet.currency)
    if (!check.ok) return jsonResponse({ error: check.status === 0 ? 'faucetpay_unreachable' : 'invalid_key' }, 400)
    const { error } = await admin.rpc('faucet_store_api_key', { p_faucet_id: faucetId, p_owner: owner, p_key: apiKey, p_balance: check.balance })
    if (error) return jsonResponse({ error: 'server_error' }, 500)
    return jsonResponse({ ok: true, balance: check.balance, currency: faucet.currency }, 200)
  }

  const { data: secret } = await admin.rpc('faucet_api_key_for_owner', { p_faucet_id: faucetId, p_owner: owner })
  if (!secret?.api_key) return jsonResponse({ error: 'no_key' }, 409)
  const check = await faucetPayBalance(secret.api_key, faucet.currency)
  if (!check.ok) return jsonResponse({ error: check.status === 0 ? 'faucetpay_unreachable' : 'invalid_key' }, 400)
  await admin.rpc('faucet_set_balance', { p_faucet_id: faucetId, p_balance: check.balance })
  return jsonResponse({ ok: true, balance: check.balance, currency: faucet.currency }, 200)
})
