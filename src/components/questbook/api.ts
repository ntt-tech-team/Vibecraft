import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { previewMode, previewRound } from './devPreview'
import type { Brief, Phase2Info, PhaseContent } from './types'

export interface Round2Unlocked {
  ok: true
  brief: Brief | null
  phase1: PhaseContent | null
  revealed: boolean
  phase2: PhaseContent | null
}
export type Round2Result = { ok: false } | Round2Unlocked

/** Round 1: is Phase 2 revealed yet, and its text once it is. Null when the check failed. */
export async function fetchRound1(): Promise<Phase2Info | null> {
  if (previewMode()) return previewRound(1)
  if (!supabase) return null
  const { data, error } = await supabase.rpc('ps_round1')
  if (error || !data) {
    console.warn('ps_round1:', error?.message ?? 'no data')
    return null
  }
  return data as Phase2Info
}

/** Round 2: checks the hall code first. Throws when the check itself failed. */
export async function fetchRound2(code: string): Promise<Round2Result> {
  if (previewMode()) return { ok: true, ...(await previewRound(2)) }
  if (!supabase) throw new Error('not configured')
  const { data, error } = await supabase.rpc('ps_round2', { p_code: code })
  if (error) throw new Error(error.message)
  return (data as Round2Result) ?? { ok: false }
}

const POLL_MS = 15_000

/**
 * Keeps asking whether the organiser has revealed Phase 2: every ~15 s while the tab is visible,
 * and straight away when the tab comes back into view. Stops once Phase 2 has arrived.
 * `justRevealed` changes (to a timestamp) when the reveal happens while this page is open.
 */
export function usePhase2(load: () => Promise<Phase2Info | null>, initial?: Phase2Info) {
  const [info, setInfo] = useState<Phase2Info>(initial ?? { revealed: null, phase2: null })
  const [justRevealed, setJustRevealed] = useState(0)
  const sawSealed = useRef(initial?.revealed === false)
  const skipFirst = useRef(Boolean(initial))
  const loadRef = useRef(load)
  loadRef.current = load
  const done = info.revealed === true && info.phase2 !== null

  useEffect(() => {
    if (done) return
    let alive = true
    async function check() {
      if (document.hidden) return
      const res = await loadRef.current().catch(() => null)
      if (!alive || !res) return
      if (!res.revealed || !res.phase2) sawSealed.current = true
      else if (sawSealed.current) setJustRevealed(Date.now())
      setInfo({ revealed: res.revealed, phase2: res.phase2 })
    }
    if (skipFirst.current) skipFirst.current = false
    else void check()
    // a little jitter so ~500 screens don't all ask in the same second
    const every = previewMode() ? 1500 : POLL_MS + Math.round(Math.random() * 3000)
    const id = window.setInterval(check, every)
    document.addEventListener('visibilitychange', check)
    return () => {
      alive = false
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', check)
    }
  }, [done])

  return { ...info, justRevealed }
}
