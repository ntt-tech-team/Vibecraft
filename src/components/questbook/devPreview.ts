import type { Brief, PhaseContent } from './types'

// DEV ONLY (never active on the live site): preview the Quest Book without touching Supabase.
//   /round/1?ps=sealed   Phase 2 stays sealed
//   /round/1?ps=live     sealed, then "the organiser reveals it" ~4 s after the page loads
//   /round/1?ps=open     already revealed
// Same for /round/2 (skips the hall code). The text comes from the git-ignored
// supabase/private/ps_content.json, served by the Vite dev server.

export type PreviewMode = 'sealed' | 'live' | 'open'

export function previewMode(): PreviewMode | null {
  if (!import.meta.env.DEV) return null
  const m = new URLSearchParams(window.location.search).get('ps')
  return m === 'sealed' || m === 'live' || m === 'open' ? m : null
}

type Parts = { brief?: Brief; phase1?: PhaseContent; phase2?: PhaseContent }
let text: Promise<Record<string, Parts>> | null = null
const loadedAt = Date.now()

export async function previewRound(round: 1 | 2) {
  text ??= fetch(import.meta.env.DEV ? '/supabase/private/ps_content.json' : '').then((r) => r.json())
  const parts = (await text)[String(round)] ?? {}
  const mode = previewMode()
  const revealed = mode === 'open' || (mode === 'live' && Date.now() - loadedAt > 4000)
  return {
    brief: parts.brief ?? null,
    phase1: parts.phase1 ?? null,
    revealed,
    phase2: revealed ? (parts.phase2 ?? null) : null,
  }
}
