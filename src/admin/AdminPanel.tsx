import { useEffect, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { mapTimerRow, toView, pad, type TimerState } from '../lib/timer'
import { page, card, input, Btn } from './ui'
import DragonAdmin from './DragonAdmin'
import Round1Admin from './Round1Admin'
import ProblemStatementsAdmin from './ProblemStatementsAdmin'

const TIMER_ID = 1

export default function AdminPanel() {
  const [session, setSession] = useState<Session | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authMsg, setAuthMsg] = useState('')
  const [state, setState] = useState<TimerState | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [err, setErr] = useState('')
  const [hours, setHours] = useState(9)
  const [mins, setMins] = useState(0)

  // clock tick
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [])

  // auth session
  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  // timer fetch + realtime
  useEffect(() => {
    if (!supabase || !session) return
    let active = true
    supabase
      .from('timer_state')
      .select('*')
      .eq('id', TIMER_ID)
      .single()
      .then(({ data }) => {
        if (active && data) setState(mapTimerRow(data))
      })
    const channel = supabase
      .channel('admin_timer')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'timer_state', filter: `id=eq.${TIMER_ID}` },
        (payload) => {
          if (payload.new) setState(mapTimerRow(payload.new as Record<string, unknown>))
        },
      )
      .subscribe()
    return () => {
      active = false
      supabase!.removeChannel(channel)
    }
  }, [session])

  async function write(patch: Partial<Record<string, unknown>>) {
    if (!supabase) return
    setErr('')
    const { data, error } = await supabase.from('timer_state').update(patch).eq('id', TIMER_ID).select('id')
    if (error) setErr(error.message)
    // RLS rejects silently (0 rows updated) when the signed-in email isn't the organiser's
    else if (!data?.length) setErr("The database refused the change: this account isn't the organiser account.")
  }

  async function signIn(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setAuthMsg('Signing in…')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setAuthMsg(error ? error.message : '')
  }

  // ---- not configured ----
  if (!isSupabaseConfigured) {
    return (
      <div style={page}>
        <div style={card}>
          <h1 style={{ fontFamily: '"Press Start 2P", monospace', fontSize: 18 }}>Admin</h1>
          <p style={{ color: '#CFC6A9' }}>
            Supabase isn't configured yet. Add <code>VITE_SUPABASE_URL</code> and{' '}
            <code>VITE_SUPABASE_ANON_KEY</code> to your <code>.env.local</code> (see{' '}
            <code>supabase/SETUP.md</code>), then reload. Until then the site shows a plain fallback
            countdown and this panel is inactive.
          </p>
        </div>
      </div>
    )
  }

  // ---- login ----
  if (!session) {
    return (
      <div style={page}>
        <form style={card} onSubmit={signIn}>
          <h1 style={{ fontFamily: '"Press Start 2P", monospace', fontSize: 18 }}>Admin login</h1>
          <p style={{ color: '#CFC6A9', fontSize: 14 }}>Organisers only.</p>
          <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
            <input
              style={input}
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
            />
            <input
              style={input}
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            <Btn tone="torch">Sign in</Btn>
            {authMsg && <p style={{ color: '#FF9130', fontSize: 14 }}>{authMsg}</p>}
          </div>
        </form>
      </div>
    )
  }

  // ---- controls ----
  const view = state ? toView(state, now) : null
  const status = view?.status ?? 'idle'

  const startMs = (hours * 60 + mins) * 60 * 1000
  const start = () =>
    write({
      status: 'running',
      ends_at: new Date(Date.now() + startMs).toISOString(),
      remaining_ms: null,
      duration_ms: startMs,
    })
  const pause = () => {
    if (!state?.ends_at) return
    const remaining = Math.max(0, new Date(state.ends_at).getTime() - Date.now())
    write({ status: 'paused', remaining_ms: remaining, ends_at: null })
  }
  const resume = () => {
    const remaining = Math.max(0, state?.remaining_ms ?? 0)
    write({ status: 'running', ends_at: new Date(Date.now() + remaining).toISOString(), remaining_ms: null })
  }
  const adjust = (deltaMs: number) => {
    if (!state) return
    if (state.status === 'running' && state.ends_at) {
      const newEnds = Math.max(Date.now(), new Date(state.ends_at).getTime() + deltaMs)
      write({ ends_at: new Date(newEnds).toISOString() })
    } else if (state.status === 'paused') {
      write({ remaining_ms: Math.max(0, (state.remaining_ms ?? 0) + deltaMs) })
    }
  }
  const stop = () => write({ status: 'ended', ends_at: null, remaining_ms: 0 })
  const reset = () => write({ status: 'idle', ends_at: null, remaining_ms: null })

  return (
    <div style={page}>
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontFamily: '"Press Start 2P", monospace', fontSize: 18, margin: 0 }}>
            Timer control
          </h1>
          <Btn tone="ghost" onClick={() => supabase?.auth.signOut()}>
            Sign out
          </Btn>
        </div>

        {/* live readout */}
        <div
          style={{
            margin: '20px 0',
            padding: '18px',
            background: '#0B0E1F',
            border: '2px solid #FF9130',
            borderRadius: 4,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 12, letterSpacing: 1, color: '#FFB35C', textTransform: 'uppercase' }}>
            {status}
          </div>
          <div
            style={{
              fontFamily: '"Press Start 2P", monospace',
              fontSize: 34,
              color: '#FFB35C',
              marginTop: 10,
            }}
          >
            {view ? `${pad(view.h)}:${pad(view.m)}:${pad(view.s)}` : '--:--:--'}
          </div>
        </div>

        {/* start with duration */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <label style={{ fontSize: 13 }}>
            Hours
            <input
              style={{ ...input, width: 80, marginTop: 4 }}
              type="number"
              min={0}
              value={hours}
              onChange={(e) => setHours(Math.max(0, Number(e.target.value)))}
            />
          </label>
          <label style={{ fontSize: 13 }}>
            Minutes
            <input
              style={{ ...input, width: 80, marginTop: 4 }}
              type="number"
              min={0}
              max={59}
              value={mins}
              onChange={(e) => setMins(Math.min(59, Math.max(0, Number(e.target.value))))}
            />
          </label>
          <Btn tone="grass" onClick={start}>
            {status === 'idle' || status === 'ended' ? 'Start' : 'Restart'}
          </Btn>
        </div>

        {/* run controls */}
        <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
          {status === 'running' && (
            <Btn tone="torch" onClick={pause}>
              ⏸ Pause
            </Btn>
          )}
          {status === 'paused' && (
            <Btn tone="grass" onClick={resume}>
              ▶ Resume
            </Btn>
          )}
          <Btn tone="tnt" onClick={stop} disabled={status === 'idle' || status === 'ended'}>
            ⏹ Stop
          </Btn>
          <Btn tone="ghost" onClick={reset}>
            ↺ Reset
          </Btn>
        </div>

        {/* live adjust */}
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 13, color: '#CFC6A9', marginBottom: 8 }}>
            Extend / shorten (works while running or paused)
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              ['−15m', -15 * 60000],
              ['−5m', -5 * 60000],
              ['+5m', 5 * 60000],
              ['+15m', 15 * 60000],
              ['+30m', 30 * 60000],
            ].map(([lbl, ms]) => (
              <Btn
                key={lbl as string}
                tone="ghost"
                disabled={status !== 'running' && status !== 'paused'}
                onClick={() => adjust(ms as number)}
              >
                {lbl}
              </Btn>
            ))}
          </div>
        </div>

        {err && <p style={{ color: '#E33D2E', marginTop: 16, fontSize: 14 }}>⚠ {err}</p>}
        <p style={{ color: '#6b6482', fontSize: 12, marginTop: 18 }}>
          Changes sync to every open page within about a second. Participants can only watch — the
          database rejects any write that isn't from this admin account.
        </p>
      </div>
      <ProblemStatementsAdmin />
      <Round1Admin />
      <DragonAdmin />
    </div>
  )
}
