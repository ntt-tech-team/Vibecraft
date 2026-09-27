import { useEffect, useRef, useState } from 'react'
import { isSupabaseConfigured } from '../lib/supabase'
import { fetchRound2, usePhase2, type Round2Unlocked } from './questbook/api'
import { previewMode } from './questbook/devPreview'
import QuestBook from './questbook/QuestBook'

const LS_KEY = 'vibecraft_r2_code'

type Status = 'locked' | 'checking' | 'unlocked' | 'error'

/** Round 2's first lock: the hall code. It opens the Quest Book (the brief + Phase 1); Phase 2
 * stays sealed until the organiser reveals it from /admin. The text is fetched from Supabase
 * only after the code matches — it's never in the page before that. */
export default function Round2Gate({ submitUrl }: { submitUrl: string }) {
  const [status, setStatus] = useState<Status>('locked')
  const [unlocked, setUnlocked] = useState<{ code: string; data: Round2Unlocked } | null>(null)
  const [msg, setMsg] = useState('')
  const [shake, setShake] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Re-verify a remembered code on mount (the problems are never persisted locally).
  useEffect(() => {
    if (previewMode()) {
      void verify('preview', true)
      return
    }
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
    if (!clean || (!isSupabaseConfigured && !previewMode())) return

    setStatus('checking')
    setMsg(silent ? '' : 'Checking…')
    let res
    try {
      res = await fetchRound2(clean)
    } catch {
      setStatus('error')
      setMsg('Something went wrong verifying that code. Try again.')
      return
    }

    if (res.ok) {
      setUnlocked({ code: clean, data: res })
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
  if (!isSupabaseConfigured && !previewMode()) {
    return (
      <div className="round-locked">
        🔒 Round 2 unlocks on event day — you'll need the access code the organisers announce in
        the hall.
      </div>
    )
  }

  // ---- unlocked: the Quest Book ----
  if (status === 'unlocked' && unlocked) {
    return <Round2Book code={unlocked.code} initial={unlocked.data} submitUrl={submitUrl} />
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

/** Round 2's second lock: Phase 2 waits for the organiser's Reveal switch. */
function Round2Book({ code, initial, submitUrl }: { code: string; initial: Round2Unlocked; submitUrl: string }) {
  const { revealed, phase2, justRevealed } = usePhase2(
    () => fetchRound2(code).then((r) => (r.ok ? { revealed: r.revealed, phase2: r.phase2 } : null)),
    { revealed: initial.revealed, phase2: initial.phase2 },
  )

  if (!initial.brief || !initial.phase1) {
    return (
      <div className="round-locked">
        ⚠️ Round 2's problem statement isn't loaded yet. Please tell a volunteer.
      </div>
    )
  }

  return (
    <div className="r2-unlocked">
      <p className="r2-note">✅ Unlocked. Phase 1 is open below.</p>
      <QuestBook
        round={2}
        world="nether"
        brief={initial.brief}
        phase1={initial.phase1}
        datasetNote="again"
        revealed={revealed}
        phase2={phase2}
        justRevealed={justRevealed}
        submitUrl={submitUrl}
        submitLabel="Submit Round 2"
      />
    </div>
  )
}
