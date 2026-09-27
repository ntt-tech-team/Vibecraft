import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { card, input, Btn } from './ui'

// Organiser controls for Round 1's Technical Task ("The Trial"), the team registration switch,
// and every team's advantage points so far. Shown in /admin once signed in.

interface Clear {
  stage: number
  cleared_at: string
  elapsed_s: number
}

interface Team {
  id: number
  name: string
  created_at: string
  clears: Clear[]
  dragon_points: number
}

interface Overview {
  now: string
  config: {
    registration_open: boolean
    r1_opened_at: string | null
    r1_open_until: string | null
  }
  teams: Team[]
}

const IST: Intl.DateTimeFormatOptions = { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }

const duration = (s: number) => `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`
const clock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export default function Round1Admin() {
  const [data, setData] = useState<Overview | null>(null)
  const [offset, setOffset] = useState(0) // server clock − this laptop's clock
  const [now, setNow] = useState(Date.now())
  const [minutes, setMinutes] = useState(15)
  const [filter, setFilter] = useState('')
  const [sort, setSort] = useState<'name' | 'finish' | 'points'>('name')
  const [err, setErr] = useState('')
  const [note, setNote] = useState('')

  const load = useCallback(async () => {
    if (!supabase) return
    const { data: res, error } = await supabase.rpc('admin_r1_overview')
    if (error) {
      setErr(
        error.message === 'forbidden'
          ? 'This account is not the organiser account.'
          : /admin_r1_overview/.test(error.message)
            ? 'Run supabase/round1.sql in the Supabase SQL editor first.'
            : error.message,
      )
      return
    }
    setErr('')
    const o = res as Overview
    setOffset(Date.parse(o.now) - Date.now())
    setData(o)
  }, [])

  useEffect(() => {
    void load()
    const id = window.setInterval(() => {
      if (!document.hidden) void load()
    }, 10_000)
    const tick = window.setInterval(() => setNow(Date.now()), 500)
    return () => {
      window.clearInterval(id)
      window.clearInterval(tick)
    }
  }, [load])

  async function call(fn: string, args: Record<string, unknown>, done: string) {
    if (!supabase) return
    const { error } = await supabase.rpc(fn, args)
    if (error) {
      setErr(error.message)
      return
    }
    setNote(done)
    await load()
  }

  if (!data) {
    return (
      <div style={{ ...card, maxWidth: 760, marginTop: 24 }}>
        <h2 style={h2}>Round 1 · The Trial</h2>
        <p style={{ color: '#CFC6A9' }}>{err || 'Loading…'}</p>
      </div>
    )
  }

  const cfg = data.config
  const serverNow = now + offset
  const until = cfg.r1_open_until ? Date.parse(cfg.r1_open_until) : 0
  const open = until > serverNow
  const finished = data.teams.filter((t) => t.clears.some((c) => c.stage === 3))
  const stageCount = (n: number) => data.teams.filter((t) => t.clears.some((c) => c.stage === n)).length

  const rows = data.teams.map((t) => {
    const last = t.clears.find((c) => c.stage === 3)
    const r1 = last ? 1 : 0
    return { ...t, last, r1, total: r1 + Number(t.dragon_points) }
  })
  const q = filter.trim().toLowerCase()
  const shown = rows
    .filter((r) => !q || r.name.toLowerCase().includes(q))
    .sort((a, b) =>
      sort === 'finish'
        ? (a.last?.elapsed_s ?? Infinity) - (b.last?.elapsed_s ?? Infinity)
        : sort === 'points'
          ? b.total - a.total || a.name.localeCompare(b.name)
          : 0,
    )

  function copyCsv() {
    const lines = [
      'Team,Trial stages,Trial finished at (IST),Trial time taken,Trial point,Dragon points,Total points',
      ...rows.map((r) =>
        [
          `"${r.name.replace(/"/g, '""')}"`,
          r.clears.length,
          r.last ? new Date(r.last.cleared_at).toLocaleTimeString('en-US', IST) : '',
          r.last ? duration(r.last.elapsed_s) : '',
          r.r1,
          r.dragon_points,
          r.total,
        ].join(','),
      ),
    ]
    navigator.clipboard.writeText(lines.join('\n')).then(
      () => setNote(`Copied ${rows.length} teams as CSV. Paste into Google Sheets.`),
      () => setErr("Couldn't copy. Your browser blocked clipboard access."),
    )
  }

  return (
    <div style={{ ...card, maxWidth: 760, marginTop: 24 }}>
      <h2 style={h2}>Round 1 · The Trial</h2>

      <div style={{ ...statusBox, borderColor: open ? '#6FA043' : '#1B140C' }}>
        {open ? (
          <>
            <span style={{ fontWeight: 700 }}>🟢 Games open</span>
            <span style={{ fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 28, fontWeight: 800, color: '#6FA043' }}>
              {clock(until - serverNow)}
            </span>
          </>
        ) : (
          <span style={{ fontWeight: 700 }}>🔒 Games closed{cfg.r1_opened_at ? ' (the last window has ended)' : ''}</span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 12 }}>
        <label style={lbl}>
          Minutes
          <input
            style={{ ...input, marginTop: 4, width: 90 }}
            type="number"
            min={1}
            max={120}
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
          />
        </label>
        <Btn
          tone="grass"
          onClick={() => {
            if (open && !window.confirm('The games are already open. Restart the clock from now? Time taken restarts too.')) return
            void call('admin_r1_open', { p_minutes: minutes }, `Games open for ${minutes} minutes.`)
          }}
        >
          ▶ Open games
        </Btn>
        <Btn tone="ghost" disabled={!cfg.r1_opened_at} onClick={() => void call('admin_r1_extend', { p_minutes: 1 }, 'Added 1 minute.')}>
          +1 min
        </Btn>
        <Btn tone="ghost" disabled={!cfg.r1_opened_at} onClick={() => void call('admin_r1_extend', { p_minutes: 5 }, 'Added 5 minutes.')}>
          +5 min
        </Btn>
        <Btn
          tone="tnt"
          disabled={!open}
          onClick={() => {
            if (window.confirm('Close the games now? Stage clears stop counting.')) void call('admin_r1_close', {}, 'Games closed.')
          }}
        >
          ■ Close now
        </Btn>
      </div>
      <p style={small}>
        Players' screens pick up changes within about 15–20 seconds. "Time taken" on the victory screen counts from when you
        pressed Open. The +min buttons don't restart it.
      </p>

      <h3 style={h3}>Team registration</h3>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontWeight: 700 }}>{cfg.registration_open ? '🟢 Open: teams can register new names' : '🔒 Closed: only existing team keys work'}</span>
        {cfg.registration_open ? (
          <Btn
            tone="tnt"
            onClick={() => {
              if (window.confirm('Close team registration? New team names will be refused on every page (Round 1 and the Dragon).'))
                void call('admin_set_registration', { p_open: false }, 'Registration closed.')
            }}
          >
            Close registration
          </Btn>
        ) : (
          <Btn tone="grass" onClick={() => void call('admin_set_registration', { p_open: true }, 'Registration open.')}>
            Open registration
          </Btn>
        )}
      </div>
      <p style={small}>Close it once Round 1 is over, so no team can register a second name later. Lost keys: "New key" in the Dragon panel below.</p>

      <h3 style={h3}>Points</h3>
      <p style={{ fontSize: 14, color: '#CFC6A9', margin: '0 0 8px' }}>
        {data.teams.length} teams · 🏆 finished The Trial: <strong style={{ color: '#6FA043' }}>{finished.length}</strong> · Stage 1:{' '}
        {stageCount(1)} · Stage 2: {stageCount(2)} · Stage 3: {stageCount(3)}
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <input style={{ ...input, flex: 1, minWidth: 180 }} placeholder="Search teams…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <select style={{ ...input, width: 'auto' }} value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort teams">
          <option value="name">Sort: name</option>
          <option value="finish">Sort: Trial finish time</option>
          <option value="points">Sort: total points</option>
        </select>
        <Btn tone="ghost" onClick={copyCsv}>
          Copy CSV
        </Btn>
      </div>
      <div style={{ maxHeight: 420, overflow: 'auto', border: '2px solid #1B140C', borderRadius: 4 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#0B0E1F', textAlign: 'left' }}>
              <th style={th}>Team</th>
              <th style={th}>Trial</th>
              <th style={th}>Finished at</th>
              <th style={th}>Time taken</th>
              <th style={th}>Trial pt</th>
              <th style={th}>Dragon pt</th>
              <th style={th}>Total</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr>
                <td style={td} colSpan={7}>
                  No teams yet.
                </td>
              </tr>
            )}
            {shown.map((r) => (
              <tr key={r.id} style={{ borderTop: '1px solid rgba(241,233,210,0.1)' }}>
                <td style={{ ...td, fontWeight: 700, overflowWrap: 'anywhere' }}>{r.name}</td>
                <td style={td}>{r.clears.length}/3</td>
                <td style={td}>{r.last ? new Date(r.last.cleared_at).toLocaleTimeString('en-US', IST) : '—'}</td>
                <td style={td}>{r.last ? duration(r.last.elapsed_s) : '—'}</td>
                <td style={td}>{r.r1}</td>
                <td style={td}>{r.dragon_points}</td>
                <td style={{ ...td, fontWeight: 800, color: '#FFB35C' }}>{r.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {note && <p style={{ color: '#6FA043', fontSize: 14, marginTop: 14, overflowWrap: 'anywhere' }}>{note}</p>}
      {err && <p style={{ color: '#E33D2E', fontSize: 14, marginTop: 14 }}>⚠ {err}</p>}
    </div>
  )
}

const h2 = { fontFamily: '"Press Start 2P", monospace', fontSize: 16, margin: '0 0 12px' }
const h3 = { fontSize: 14, textTransform: 'uppercase' as const, letterSpacing: 1, color: '#FFB35C', margin: '22px 0 10px' }
const lbl = { fontSize: 13, color: '#CFC6A9', display: 'block' }
const small = { color: '#6b6482', fontSize: 12, margin: '8px 0 0' }
const statusBox = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '12px 16px', border: '3px solid', borderRadius: 4, background: '#0B0E1F' }
const th = { padding: '8px 10px', fontSize: 12, textTransform: 'uppercase' as const, letterSpacing: 0.5, color: '#CFC6A9', position: 'sticky' as const, top: 0, background: '#0B0E1F' }
const td = { padding: '8px 10px', color: '#F1E9D2' }
