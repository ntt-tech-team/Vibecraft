// Talks to /api/round1 (game window + stage clears) and /api/dragon (team setup, shared all day).

export const LS_TEAM_KEY = 'vc26_team_key' // shared with the Dragon page: one key per team, all day

export interface StageClear {
  stage: number
  cleared_at: string
  elapsed_s: number
}

export interface R1Status {
  now: string
  registration_open: boolean
  opened_at: string | null
  open_until: string | null
  closed_early?: boolean // missing until supabase/round1_v2.sql has been run
  team: { id: number; name: string } | null
  clears: StageClear[]
}

/** Never opened, running, the timer ran out, or the organisers pressed Close before it did. */
export type TrialPhase = 'waiting' | 'open' | 'timeup' | 'stopped'

export function trialPhase(
  openedAt: string | null,
  openUntil: string | null,
  closedEarly: boolean | undefined,
  serverNow: number,
): TrialPhase {
  if (!openedAt) return 'waiting'
  if (openUntil && Date.parse(openUntil) > serverNow) return 'open'
  return closedEarly ? 'stopped' : 'timeup'
}

export type Reply<T> = Partial<T> & { error?: string; ok?: boolean; reason?: string }

/** Every field may be missing; network failures come back as { error: 'network' }. */
export async function post<T>(path: '/api/round1' | '/api/dragon', body: Record<string, unknown>): Promise<Reply<T>> {
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    return (await res.json()) as Reply<T>
  } catch {
    return { error: 'network' } as Reply<T>
  }
}

export function readKey(): string {
  try {
    return localStorage.getItem(LS_TEAM_KEY) ?? ''
  } catch {
    return ''
  }
}

export function writeKey(key: string | null) {
  try {
    if (key) localStorage.setItem(LS_TEAM_KEY, key)
    else localStorage.removeItem(LS_TEAM_KEY)
  } catch {
    /* storage blocked: the team re-enters its key after a refresh */
  }
}

export const UNREACHABLE = "The game server can't be reached right now. Check your Wi-Fi, or ask an organiser."
