// Round 1 Technical Task server ("The Trial": three browser games). Runs as the Vercel function
// api/round1.ts, and inside the Vite dev server locally (see vite.config.ts).
//
// The games themselves run in the browser. This only reads the team's state (game window,
// registration switch, cleared stages) and records stage clears, so every teammate's laptop
// sees the same progress. Team setup stays on /api/dragon, so one team key works all day.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { normalizeTeamKey } from '../src/lib/teamKey.js'

export type Round1Env = Record<string, string | undefined>

let db: SupabaseClient | null = null

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })
}

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await db!.rpc(name, args)
  if (error) throw error
  return data as T
}

type Body = { action?: string; key?: string; stage?: number }

export async function handleRound1(request: Request, env: Round1Env): Promise<Response> {
  const url = env.VITE_SUPABASE_URL
  const anon = env.VITE_SUPABASE_ANON_KEY
  const secret = env.DRAGON_SECRET
  const configured = Boolean(url && anon && secret)

  if (request.method === 'GET') return json({ service: 'round1', configured })
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  if (!configured) return json({ error: 'not_configured' }, 503)

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return json({ error: 'bad_request' }, 400)
  }

  db ??= createClient(url!, anon!, { auth: { persistSession: false, autoRefreshToken: false } })
  const key = normalizeTeamKey(String(body.key ?? ''))

  try {
    switch (body.action) {
      case 'status':
        return json(await rpc('r1_status', { p_secret: secret, p_key: key }))
      case 'clear':
        return json(await rpc('r1_clear', { p_secret: secret, p_key: key, p_stage: Number(body.stage) }))
      default:
        return json({ error: 'bad_action' }, 400)
    }
  } catch (e) {
    console.error('[round1]', (e as { message?: string }).message ?? e)
    return json({ error: 'server_error' }, 500)
  }
}
