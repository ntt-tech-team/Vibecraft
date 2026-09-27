// Ender Dragon game server (Round 2, Phase 2). Runs as the Vercel function api/dragon.ts,
// and inside the Vite dev server locally (see vite.config.ts).
//
// Flow for a chat message: input filter (free) → dragon_chat_begin (team, cooldown, global cap)
// → AI engine → kindness check → output filter → reply (+ any hints the team has unlocked).
// Engines: Cloudflare Workers AI and the organiser laptop (LM Studio via a tunnel). One is tried
// first (dragon_config.engine_mode), the other takes over on any error, timeout or daily limit.
// Passwords never touch the database: each team's password per level is derived from DRAGON_SECRET.
import { createHmac, randomInt } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { makeTeamKey, normalizeTeamKey } from '../src/lib/teamKey.js'

export type DragonEnv = Record<string, string | undefined>

interface DragonConfig {
  status: 'closed' | 'open' | 'paused'
  llm_url: string
  llm_model: string
  cooldown_s: number
  engine_mode: 'cloudflare' | 'laptop'
  cf_exhausted_until: string | null
  hint1_after: number
  hint2_after: number
}

interface DragonLevel {
  level: number
  system_prompt: string
  blocked_words: string[]
  output_filter: 'none' | 'exact' | 'strict'
  hint1: string
  hint2: string
}

interface ServerConfig {
  config: DragonConfig
  levels: DragonLevel[]
}

type Engine = 'cloudflare' | 'laptop'

const CF_MODEL = '@cf/meta/llama-3.1-8b-instruct-fp8-fast'
const FIRST_TRY_MS = 15_000
const SECOND_TRY_MS = 20_000
const CONFIG_TTL_MS = 15_000
const MAX_MESSAGE = 400

// Shown instead of a reply that stayed unkind after a retry. Never contains the password.
const FRIENDLY_LINES = [
  'Nice try, adventurer! My lips are sealed, but I admire your courage.',
  'Ha! A clever attempt. The treasure stays safe with me for now.',
  'You have a brave heart. Keep trying, new ideas can open old doors.',
]

// Passwords are ADJECTIVE + NOUN ("SNEAKYPICKLE"). The words avoid what the dragons talk about
// anyway (the End, portals, obsidian…) so the censor doesn't burn innocent replies.
const ADJECTIVES = [
  'AMBER', 'AZURE', 'BRAVE', 'BRIGHT', 'CALM', 'CLEVER', 'COPPER', 'CORAL', 'COSMIC', 'CRIMSON',
  'DUSTY', 'FANCY', 'FLUFFY', 'FROSTY', 'GENTLE', 'GIANT', 'GOLDEN', 'GRUMPY', 'HAPPY', 'HUMBLE',
  'JOLLY', 'LAZY', 'LUCKY', 'MIGHTY', 'MINTY', 'MISTY', 'NOBLE', 'PEPPY', 'PLUCKY', 'PURPLE',
  'QUIET', 'RAPID', 'ROYAL', 'RUSTY', 'SILVER', 'SLEEPY', 'SNEAKY', 'SPICY', 'STORMY', 'SUNNY',
  'SWIFT', 'TINY', 'VELVET', 'WILD', 'WISE', 'ZESTY', 'BOUNCY', 'CHEERY',
]
const NOUNS = [
  'ANCHOR', 'BADGER', 'BANJO', 'BISCUIT', 'BUCKET', 'CACTUS', 'CANDLE', 'CARROT', 'COMET', 'COOKIE',
  'DONUT', 'FALCON', 'FEATHER', 'GECKO', 'GIRAFFE', 'HAMMER', 'HELMET', 'JACKET', 'KETTLE', 'KITTEN',
  'LADDER', 'LANTERN', 'LEMON', 'LLAMA', 'MANGO', 'MEADOW', 'MITTEN', 'MUFFIN', 'NOODLE', 'OTTER',
  'PANDA', 'PARROT', 'PEBBLE', 'PICKLE', 'PILLOW', 'PIZZA', 'PUMPKIN', 'RABBIT', 'ROCKET', 'SADDLE',
  'SPOON', 'TACO', 'TEAPOT', 'TIGER', 'TURNIP', 'WAFFLE', 'WALRUS', 'YOGURT',
]

let db: SupabaseClient | null = null
let cached: { at: number; data: ServerConfig } | null = null

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })
}

/** The team's password for a level, as its two words. Same inputs → same password. */
export function passwordParts(secret: string, teamId: number, level: number): [string, string] {
  const h = createHmac('sha256', secret).update(`dragon-pw:${teamId}:${level}`).digest()
  return [ADJECTIVES[h.readUInt16BE(0) % ADJECTIVES.length], NOUNS[h.readUInt16BE(2) % NOUNS.length]]
}

const letters = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

/** True when the reply gives the password away, according to the level's filter. */
export function leaksPassword(reply: string, [adj, noun]: [string, string], mode: DragonLevel['output_filter']): boolean {
  if (mode === 'none') return false
  const a = adj.toLowerCase()
  const n = noun.toLowerCase()
  if (mode === 'exact') {
    const text = reply.toLowerCase()
    return [`${a}${n}`, `${a} ${n}`, `${a}-${n}`, `${a}_${n}`].some((v) => text.includes(v))
  }
  // strict: ignore spacing/punctuation/case, and catch reversed or split-up passwords
  const flat = letters(reply)
  const pw = a + n
  return flat.includes(pw) || flat.includes([...pw].reverse().join('')) || (flat.includes(a) && flat.includes(n))
}

/** First blocked word in the message (whole words, any case), or null. */
export function blockedWord(message: string, words: string[]): string | null {
  if (!words.length) return null
  const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const m = message.match(new RegExp(`\\b(${escaped.join('|')})\\b`, 'i'))
  return m ? m[1].toLowerCase() : null
}

const UNKIND =
  /\b(foolish|fools?|silly|stupid|idiots?|dumb|pathetic|puny|weakling|losers?|ignorant|worthless|insolent|impudent|imbeciles?|morons?|how dare)\b/i

/** True when a reply talks down to the player. Such replies are regenerated, never shown. */
export function isUnkind(reply: string): boolean {
  return UNKIND.test(reply)
}

/** Hints the team has unlocked on a level after `msgs` messages, and how many more until the next. */
export function hintsFor(level: DragonLevel, msgs: number, config: DragonConfig) {
  const hints: string[] = []
  if (level.hint1 && msgs >= config.hint1_after) hints.push(level.hint1)
  if (level.hint2 && msgs >= config.hint2_after) hints.push(level.hint2)
  const next = !level.hint1
    ? null
    : msgs < config.hint1_after
      ? config.hint1_after - msgs
      : level.hint2 && msgs < config.hint2_after
        ? config.hint2_after - msgs
        : null
  return { hints, next_hint_in: next }
}

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await db!.rpc(name, args)
  if (error) throw error
  return data as T
}

async function serverConfig(secret: string): Promise<ServerConfig> {
  if (cached && Date.now() - cached.at < CONFIG_TTL_MS) return cached.data
  const data = await rpc<ServerConfig>('dragon_server_config', { p_secret: secret })
  cached = { at: Date.now(), data }
  return data
}

/** Cloudflare refused because the free daily neurons are used up (error 4006). */
class DailyLimitError extends Error {}

/** True for Cloudflare's "daily free allocation used up" response. */
export function isDailyLimit(status: number, body: string): boolean {
  return status === 429 && /4006|daily free allocation|neurons/i.test(body)
}

// In-memory mirror of dragon_config.cf_exhausted_until, so this instance stops calling
// Cloudflare the moment it hears "daily limit" (other instances follow within CONFIG_TTL_MS).
let cfExhaustedUntil = 0

const nextUtcMidnight = () => {
  const d = new Date()
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1)
}

async function chatCompletion(url: string, headers: Record<string, string>, model: string, system: string, message: string, timeoutMs: number): Promise<string> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify({
        model,
        temperature: 0.7,
        max_tokens: 150,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: message },
        ],
      }),
      signal: ctrl.signal,
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      if (isDailyLimit(res.status, body)) throw new DailyLimitError(body.slice(0, 200))
      throw new Error(`llm status ${res.status}`)
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
    const text = data.choices?.[0]?.message?.content?.trim()
    if (!text) throw new Error('llm empty reply')
    return text.slice(0, 800)
  } finally {
    clearTimeout(timer)
  }
}

function cloudflareReady(config: DragonConfig, env: DragonEnv): boolean {
  if (!env.CF_ACCOUNT_ID || !env.CF_AI_TOKEN) return false
  const until = Math.max(cfExhaustedUntil, config.cf_exhausted_until ? Date.parse(config.cf_exhausted_until) : 0)
  return Date.now() >= until
}

/** Which engines to try, in order. */
export function engineOrder(config: DragonConfig, env: DragonEnv): Engine[] {
  if (!cloudflareReady(config, env)) return ['laptop']
  return config.engine_mode === 'laptop' ? ['laptop', 'cloudflare'] : ['cloudflare', 'laptop']
}

function askEngine(engine: Engine, config: DragonConfig, env: DragonEnv, system: string, message: string, timeoutMs: number) {
  if (engine === 'cloudflare') {
    return chatCompletion(
      `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/ai/v1/chat/completions`,
      { authorization: `Bearer ${env.CF_AI_TOKEN}` },
      CF_MODEL,
      system,
      message,
      timeoutMs,
    )
  }
  return chatCompletion(`${config.llm_url.replace(/\/+$/, '')}/v1/chat/completions`, {}, config.llm_model, system, message, timeoutMs)
}

/** A kind reply from the first engine that works, or null if every engine failed. */
async function dragonReply(config: DragonConfig, env: DragonEnv, secret: string, system: string, message: string) {
  const order = engineOrder(config, env)
  for (let i = 0; i < order.length; i++) {
    const engine = order[i]
    const timeout = i === 0 ? FIRST_TRY_MS : SECOND_TRY_MS
    try {
      let text = await askEngine(engine, config, env, system, message, timeout)
      if (isUnkind(text)) text = await askEngine(engine, config, env, system, message, timeout)
      if (isUnkind(text)) {
        return { text: FRIENDLY_LINES[Math.floor(Math.random() * FRIENDLY_LINES.length)], engine: 'fallback' as const }
      }
      return { text, engine }
    } catch (e) {
      if (e instanceof DailyLimitError) {
        cfExhaustedUntil = nextUtcMidnight()
        cached = null
        await rpc('dragon_mark_cf_exhausted', { p_secret: secret }).catch(() => {})
      }
      // fall through to the next engine
    }
  }
  return null
}

type Body = { action?: string; key?: string; name?: string; level?: number; message?: string; guess?: string }

export async function handleDragon(request: Request, env: DragonEnv): Promise<Response> {
  const url = env.VITE_SUPABASE_URL
  const anon = env.VITE_SUPABASE_ANON_KEY
  const secret = env.DRAGON_SECRET
  const configured = Boolean(url && anon && secret)

  if (request.method === 'GET') {
    return json({ service: 'dragon', configured, cloudflare: Boolean(env.CF_ACCOUNT_ID && env.CF_AI_TOKEN) })
  }
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
  const level = Number(body.level)

  try {
    switch (body.action) {
      case 'status': {
        const status = await rpc<{ team: unknown; msgs?: Record<string, number>; levels?: { level: number }[] }>(
          'dragon_status',
          { p_secret: secret, p_key: key },
        )
        if (!status.team || !status.levels) return json(status)
        const { config, levels } = await serverConfig(secret!)
        const withHints = status.levels.map((l) => {
          const full = levels.find((x) => x.level === l.level)
          const msgs = status.msgs?.[String(l.level)] ?? 0
          return { ...l, msgs, ...(full ? hintsFor(full, msgs, config) : { hints: [], next_hint_in: null }) }
        })
        return json({ ...status, levels: withHints })
      }

      case 'setup': {
        const newKey = makeTeamKey(randomInt)
        try {
          const team = await rpc('dragon_team_setup', { p_secret: secret, p_name: String(body.name ?? ''), p_key: newKey })
          return json({ team, key: newKey })
        } catch (e) {
          const msg = (e as { message?: string }).message ?? ''
          if (['bad_name', 'name_taken', 'team_limit', 'registration_closed'].includes(msg)) return json({ error: msg }, 409)
          throw e
        }
      }

      case 'chat': {
        const message = String(body.message ?? '').trim()
        if (!message) return json({ error: 'empty' }, 400)
        if (message.length > MAX_MESSAGE) return json({ error: 'too_long' }, 400)
        const { config, levels } = await serverConfig(secret!)
        const lvl = levels.find((l) => l.level === level)
        if (!lvl) return json({ error: 'bad_level' }, 400)

        // Input filter first: costs nothing and doesn't use up the team's turn.
        const hit = blockedWord(message, lvl.blocked_words)
        if (hit) return json({ ok: true, blocked_word: hit })

        const begin = await rpc<{
          ok: boolean
          reason?: string
          retry_after?: number
          team_id: number
          msg_id: number
          prev_last: string | null
          cooldown_s: number
          level_msgs: number
        }>('dragon_chat_begin', { p_secret: secret, p_key: key, p_level: level, p_message: message })
        if (!begin.ok) return json({ ok: false, reason: begin.reason, retry_after: begin.retry_after })

        const parts = passwordParts(secret!, begin.team_id, level)
        const system = lvl.system_prompt.split('{{PASSWORD}}').join(parts.join(''))
        const answer = await dragonReply(config, env, secret!, system, message)
        if (!answer) {
          await rpc('dragon_chat_refund', { p_secret: secret, p_msg_id: begin.msg_id, p_prev_last: begin.prev_last })
          return json({ ok: false, reason: 'dozed' })
        }
        await rpc('dragon_chat_finish', { p_secret: secret, p_msg_id: begin.msg_id, p_engine: answer.engine }).catch(() => {})

        // `engine` isn't shown to players; it lets organisers verify failover from the browser's Network tab
        const extra = { cooldown_s: begin.cooldown_s, msgs: begin.level_msgs, engine: answer.engine, ...hintsFor(lvl, begin.level_msgs, config) }
        if (leaksPassword(answer.text, parts, lvl.output_filter)) return json({ ok: true, burned: true, ...extra })
        return json({ ok: true, reply: answer.text, ...extra })
      }

      case 'guess': {
        const guess = String(body.guess ?? '')
        if (!letters(guess) || guess.length > 60) return json({ error: 'empty' }, 400)
        const gate = await rpc<{ ok: boolean; reason?: string; retry_after?: number; team_id: number }>(
          'dragon_guess_begin',
          { p_secret: secret, p_key: key, p_level: level },
        )
        if (!gate.ok) return json({ ok: false, reason: gate.reason, retry_after: gate.retry_after })
        if (letters(guess) !== letters(passwordParts(secret!, gate.team_id, level).join(''))) {
          return json({ ok: true, correct: false })
        }
        const clear = await rpc<{ points: number }>('dragon_clear', { p_secret: secret, p_team_id: gate.team_id, p_level: level })
        return json({ ok: true, correct: true, points: clear.points })
      }

      default:
        return json({ error: 'bad_action' }, 400)
    }
  } catch (e) {
    console.error('[dragon]', (e as { message?: string }).message ?? e)
    return json({ error: 'server_error' }, 500)
  }
}
