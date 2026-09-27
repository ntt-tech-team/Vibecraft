import { useEffect, useRef, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

const LS_KEY = 'vibecraft_r2_code'

interface Problem {
  sort_order: number
  title: string
  body: string
}

type Status = 'locked' | 'checking' | 'unlocked' | 'error'

/** The server-gated Round 2 content: enter the code → the whole problem-statement list
 * is fetched via verify_round2 (never present in the page until the code matches). */
export default function Round2Gate({ submitUrl }: { submitUrl: string }) {
  const [status, setStatus] = useState<Status>('locked')
  const [problems, setProblems] = useState<Problem[]>([])
  const [msg, setMsg] = useState('')
  const [shake, setShake] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Re-verify a remembered code on mount (the problems are never persisted locally).
  useEffect(() => {
    let stored: string | null = null
    try {
      stored = localStorage.getItem(LS_KEY)
    } catch {
      /* ignore */
    }
    if (stored && isSupabaseConfigured) void verify(stored, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function verify(code: string, silent = false) {
    const clean = code.trim()
    if (!clean || !supabase) return

    setStatus('checking')
    setMsg(silent ? '' : 'Checking…')
    const { data, error } = await supabase.rpc('verify_round2', { code: clean })

    if (error) {
      setStatus('error')
      setMsg('Something went wrong verifying that code. Try again.')
      return
    }
    const rows = ((data as Problem[]) ?? []).slice().sort((a, b) => a.sort_order - b.sort_order)
    if (rows.length > 0) {
      setProblems(rows)
      setStatus('unlocked')
      setMsg('')
      try {
        localStorage.setItem(LS_KEY, clean)
      } catch {
        /* ignore */
      }
    } else {
      setStatus('error')
      setMsg('Wrong code. Check the code announced in the hall.')
      setShake(true)
      setTimeout(() => setShake(false), 400)
      try {
        localStorage.removeItem(LS_KEY)
      } catch {
        /* ignore */
      }
      if (inputRef.current) {
        inputRef.current.value = ''
        inputRef.current.focus()
      }
    }
  }

  // ---- not live yet (no Supabase) ----
  if (!isSupabaseConfigured) {
    return (
      <div className="round-locked">
        🔒 Round 2 unlocks on event day — you'll need the access code the organisers announce in
        the hall.
      </div>
    )
  }

  // ---- unlocked: show the problem-statement list + submit ----
  if (status === 'unlocked') {
    return (
      <div className="r2-unlocked">
        <p className="r2-note">✅ Unlocked. Choose a problem statement and build your solution.</p>
        {problems.map((p, i) => (
          <article className="r2-problem" key={i}>
            <h2>{p.title}</h2>
            <p style={{ whiteSpace: 'pre-wrap' }}>{p.body}</p>
          </article>
        ))}
        {submitUrl && submitUrl !== 'REPLACE_ME' ? (
          <a className="btn torch round-cta" href={submitUrl} target="_blank" rel="noopener noreferrer">
            Submit Your Project
          </a>
        ) : (
          <button className="btn torch round-cta" disabled>
            Submit Your Project — coming soon
          </button>
        )}
      </div>
    )
  }

  // ---- locked: code entry ----
  return (
    <div className="r2-gate">
      <label htmlFor="gateInput" className="r2-gate-label">
        Access code
      </label>
      <div className={`r2-gate-row${shake ? ' shake' : ''}`}>
        <input
          ref={inputRef}
          type="text"
          id="gateInput"
          className="r2-input"
          autoComplete="off"
          placeholder="Enter the Round 2 access code"
          aria-describedby="gateMsg"
          onKeyDown={(e) => {
            if (e.key === 'Enter') void verify((e.target as HTMLInputElement).value)
          }}
        />
        <button
          className="btn torch"
          disabled={status === 'checking'}
          onClick={() => void verify(inputRef.current?.value ?? '')}
        >
          {status === 'checking' ? 'Checking…' : 'Unlock'}
        </button>
      </div>
      <p className={`r2-msg${status === 'error' ? ' err' : ''}`} id="gateMsg" aria-live="polite">
        {msg}
      </p>
    </div>
  )
}
