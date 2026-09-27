import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { card, Btn } from './ui'

// Organiser switches for the Quest Book: reveal (or re-seal) Phase 2 of Round 1 and Round 2.
// Shown in /admin once signed in. See supabase/problem_statements.sql.

interface Status {
  r1_p2_revealed: boolean
  r2_p2_revealed: boolean
  loaded: string[] // e.g. ["1:phase2", "2:brief", …]
  r2_code_set: boolean
}

const NEEDED = ['1:phase2', '2:brief', '2:phase1', '2:phase2']

export default function ProblemStatementsAdmin() {
  const [data, setData] = useState<Status | null>(null)
  const [err, setErr] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!supabase) return
    const { data: res, error } = await supabase.rpc('admin_ps_status')
    if (error) {
      setErr(
        error.message === 'forbidden'
          ? 'This account is not the organiser account.'
          : /admin_ps_status/.test(error.message)
            ? 'Run supabase/problem_statements.sql in the Supabase SQL editor first.'
            : error.message,
      )
      return
    }
    setErr('')
    setData(res as Status)
  }, [])

  useEffect(() => {
    void load()
    const id = window.setInterval(() => {
      if (!document.hidden) void load()
    }, 10_000)
    return () => window.clearInterval(id)
  }, [load])

  async function setRevealed(round: 1 | 2, revealed: boolean) {
    if (!supabase) return
    setBusy(true)
    const { error } = await supabase.rpc('admin_ps_reveal', { p_round: round, p_revealed: revealed })
    setBusy(false)
    if (error) {
      setErr(error.message)
      return
    }
    setNote(revealed ? `Round ${round} Phase 2 revealed.` : `Round ${round} Phase 2 sealed again.`)
    await load()
  }

  if (!data) {
    return (
      <div style={{ ...card, maxWidth: 760, marginTop: 24 }}>
        <h2 style={h2}>Problem statements</h2>
        <p style={{ color: '#CFC6A9' }}>{err || 'Loading…'}</p>
      </div>
    )
  }

  const missing = NEEDED.filter((p) => !data.loaded.includes(p))

  function row(round: 1 | 2, revealed: boolean, sealedSees: string) {
    return (
      <div style={{ ...statusBox, borderColor: revealed ? '#6FA043' : '#1B140C', marginTop: 12 }}>
        <span>
          <span style={{ fontWeight: 700 }}>
            Round {round} · Phase 2: {revealed ? '🟢 Revealed' : '🔒 Sealed'}
          </span>
          <span style={{ display: 'block', fontSize: 13, color: '#CFC6A9', marginTop: 2 }}>
            Players see: {revealed ? 'the "Advancement made!" popup and a Reveal Phase 2 button, then Phase 2 and Submit' : sealedSees}
          </span>
        </span>
        {revealed ? (
          <Btn
            tone="ghost"
            disabled={busy}
            onClick={() => {
              if (window.confirm(`Seal Round ${round} Phase 2 again? Screens that already opened it keep it until they refresh.`))
                void setRevealed(round, false)
            }}
          >
            Seal again
          </Btn>
        ) : (
          <Btn
            tone="grass"
            disabled={busy}
            onClick={() => {
              if (window.confirm(`Reveal Round ${round} Phase 2 to every team now?`)) void setRevealed(round, true)
            }}
          >
            Reveal Phase 2
          </Btn>
        )}
      </div>
    )
  }

  return (
    <div style={{ ...card, maxWidth: 760, marginTop: 24 }}>
      <h2 style={h2}>Problem statements</h2>
      {row(1, data.r1_p2_revealed, 'Phase 1 and the sealed stone page')}
      {row(2, data.r2_p2_revealed, 'after the hall code: Phase 1 and the sealed obsidian portal')}
      {missing.length > 0 && (
        <p style={{ color: '#FFB35C', fontSize: 14, marginTop: 14 }}>
          ⚠ Text not loaded yet: {missing.join(', ')}. Run supabase/private/ps_content.sql in the Supabase SQL editor.
        </p>
      )}
      {!data.r2_code_set && (
        <p style={{ color: '#FFB35C', fontSize: 14, marginTop: 8 }}>
          ⚠ The Round 2 hall code is still the placeholder (CHANGE-ME-BEFORE-EVENT).
        </p>
      )}
      <p style={small}>
        Players' screens pick up a Reveal within about 15–20 seconds (straight away when they switch back to the tab). Round 1
        Phase 1 is always visible. Round 2 needs the hall code first. After a test run, press Seal again.
      </p>
      {note && <p style={{ color: '#6FA043', fontSize: 14, marginTop: 14 }}>{note}</p>}
      {err && <p style={{ color: '#E33D2E', fontSize: 14, marginTop: 14 }}>⚠ {err}</p>}
    </div>
  )
}

const h2 = { fontFamily: '"Press Start 2P", monospace', fontSize: 16, margin: '0 0 4px' }
const small = { color: '#6b6482', fontSize: 12, margin: '12px 0 0' }
const statusBox = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '12px 16px', border: '3px solid', borderRadius: 4, background: '#0B0E1F' }
