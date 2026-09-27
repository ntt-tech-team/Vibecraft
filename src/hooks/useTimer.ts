import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { mapTimerRow, toView, type TimerState, type TimerView } from '../lib/timer'
import { EVENT_END, DEFAULT_DURATION_MS } from '../config'

const TIMER_ID = 1
// Supabase's free plan allows 200 live (realtime) connections per project. Visitors beyond that,
// or whose connection drops, re-read the timer row on this interval instead.
const POLL_MS = 15_000
// How long to wait for the live connection before falling back to polling.
const REALTIME_GRACE_MS = 10_000

/**
 * Preview shown when Supabase isn't configured. We deliberately DON'T count down the
 * ~days to the event (that showed huge hour values). Instead we show the configured event
 * duration as an idle clock, so it always reads as a clean sub-day HRS:MIN:SEC.
 */
function fallbackState(now: number): { state: TimerState; label: string } {
  const end = new Date(EVENT_END).getTime()
  if (now >= end) {
    return {
      state: { status: 'ended', ends_at: null, remaining_ms: null, duration_ms: DEFAULT_DURATION_MS },
      label: 'VibeCraft has wrapped',
    }
  }
  return {
    state: { status: 'idle', ends_at: null, remaining_ms: null, duration_ms: DEFAULT_DURATION_MS },
    label: 'Event timer',
  }
}

function liveLabel(state: TimerState): string {
  switch (state.status) {
    case 'running':
      return 'Time remaining'
    case 'paused':
      return 'Paused by the organisers'
    case 'ended':
      return "Time's up"
    case 'idle':
    default:
      return 'Waiting to begin'
  }
}

export interface UseTimerResult {
  view: TimerView
  label: string
  source: 'live' | 'fallback'
  ready: boolean
}

export function useTimer(): UseTimerResult {
  const [dbState, setDbState] = useState<TimerState | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const source: 'live' | 'fallback' = isSupabaseConfigured ? 'live' : 'fallback'

  // tick
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [])

  // load + realtime subscribe, with a polling fallback when realtime isn't available
  useEffect(() => {
    const db = supabase
    if (!db) return
    let active = true
    let live = false
    let pollId: number | undefined

    const fetchRow = async () => {
      const { data } = await db.from('timer_state').select('*').eq('id', TIMER_ID).single()
      if (active && data) setDbState(mapTimerRow(data))
    }
    const startPolling = () => {
      if (!active || pollId !== undefined) return
      pollId = window.setInterval(() => {
        if (!document.hidden) void fetchRow()
      }, POLL_MS)
    }
    const stopPolling = () => {
      if (pollId === undefined) return
      window.clearInterval(pollId)
      pollId = undefined
    }

    void fetchRow()

    const channel = db
      .channel('timer_state_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'timer_state', filter: `id=eq.${TIMER_ID}` },
        (payload) => {
          if (payload.new) setDbState(mapTimerRow(payload.new as Record<string, unknown>))
        },
      )
      .subscribe((status) => {
        // removeChannel() in the cleanup reports CLOSED afterwards; don't restart polling then
        if (!active) return
        if (status === 'SUBSCRIBED') {
          live = true
          stopPolling()
          void fetchRow() // catch anything missed while (re)connecting
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          live = false
          startPolling()
        }
      })

    // Refused at the connection limit often never reports an error; don't wait forever.
    const graceId = window.setTimeout(() => {
      if (!live) startPolling()
    }, REALTIME_GRACE_MS)

    // Coming back to the tab (or waking the laptop): show the current state straight away.
    const onVisible = () => {
      if (!document.hidden) void fetchRow()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      active = false
      stopPolling()
      window.clearTimeout(graceId)
      document.removeEventListener('visibilitychange', onVisible)
      db.removeChannel(channel)
    }
  }, [])

  if (source === 'live' && dbState) {
    return { view: toView(dbState, now), label: liveLabel(dbState), source, ready: true }
  }
  if (source === 'live' && !dbState) {
    // configured but row not loaded yet
    const fb = fallbackState(now)
    return { view: toView(fb.state, now), label: fb.label, source, ready: false }
  }
  const fb = fallbackState(now)
  return { view: toView(fb.state, now), label: fb.label, source, ready: true }
}
