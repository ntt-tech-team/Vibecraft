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
  team: { id: number; name: string } | null
  clears: StageClear[]
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
