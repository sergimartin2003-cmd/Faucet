import { createClient } from 'npm:@supabase/supabase-js@2'

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

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS })
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: 'Function is not configured' }, 500)

  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  if (!token) return jsonResponse({ error: 'Authentication required' }, 401)

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // The caller can only ever remove the account the access token belongs to.
  const { data: userData, error: userError } = await admin.auth.getUser(token)
  if (userError || !userData.user) return jsonResponse({ error: 'Authentication required' }, 401)

  const { error: removeError } = await admin.auth.admin.deleteUser(userData.user.id)
  if (removeError) return jsonResponse({ error: 'Account removal failed' }, 500)

  return jsonResponse({ deleted: true }, 200)
})
