import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { makeTeamKey } from '../lib/teamKey'
import { card, input, Btn } from './ui'

// Organiser controls for the Ender Dragon (Round 2 · Phase 2). Shown in /admin once signed in.

interface Config {
  status: 'closed' | 'open' | 'paused'
  llm_url: string
  llm_model: string
  cooldown_s: number
  global_per_min: number
  guesses_per_min: number
  engine_mode: 'cloudflare' | 'laptop'
  cf_exhausted_until: string | null
  hint1_after: number
  hint2_after: number
}

// measured cost of one Dragon message on Cloudflare (27 Sep: ≈190 tokens in, ≈45 out → 2.36 neurons)
const NEURONS_PER_MSG = 2.4
const DAILY_NEURONS = 10_000

interface Overview {
  config: Config
  msgs_last_min: number
  msgs_total: number
  engine_today: { cloudflare: number; laptop: number; fallback: number }
  levels: { level: number; title: string; cleared_by: number }[]
  teams: { id: number; name: string; created_at: string; cleared: number[]; msgs: number }[]
}

const browserRandomInt = (n: number) => crypto.getRandomValues(new Uint32Array(1))[0] % n

const STATUS_LABEL: Record<Config['status'], string> = {
  closed: '💤 Closed',
  open: '🐉 Open',
  paused: '⏸ Paused',
}

export default function DragonAdmin() {
  const [data, setData] = useState<Overview | null>(null)
  const [draft, setDraft] = useState<Config | null>(null)
  const [err, setErr] = useState('')
  const [note, setNote] = useState('')
  const [filter, setFilter] = useState('')
  const [cfKeys, setCfKeys] = useState<boolean | null>(null)

  // Are the Cloudflare keys set on the server? (The admin page can't see server env directly.)
  useEffect(() => {
    fetch('/api/dragon')
      .then((r) => r.json())
      .then((d: { cloudflare?: boolean }) => setCfKeys(Boolean(d.cloudflare)))
      .catch(() => setCfKeys(null))
  }, [])

  const load = useCallback(async () => {
    if (!supabase) return
    const { data: res, error } = await supabase.rpc('admin_dragon_overview')
    if (error) {
      setErr(error.message === 'forbidden' ? 'This account is not the organiser account.' : error.message)
      return
    }
    setErr('')
    setData(res as Overview)
    setDraft((d) => d ?? (res as Overview).config)
  }, [])

  useEffect(() => {
    void load()
    const id = window.setInterval(() => void load(), 10_000)
    return () => window.clearInterval(id)
  }, [load])

  async function updateConfig(patch: Partial<Config>) {
    if (!supabase) return
    const { data: rows, error } = await supabase.from('dragon_config').update(patch).eq('id', 1).select('id')
    if (error || !rows?.length) {
      setErr(error?.message ?? 'Update was rejected. Are you signed in as the organiser?')
      return
    }
    setNote('Saved.')
    await load()
  }

  async function newKey(team: Overview['teams'][number]) {
    if (!supabase || !window.confirm(`Give "${team.name}" a new team key? Their old key stops working.`)) return
    const key = makeTeamKey(browserRandomInt)
    const { error } = await supabase.rpc('admin_team_reset_key', { p_team_id: team.id, p_key: key })
    if (error) setErr(error.message)
    else setNote(`New key for "${team.name}": ${key}. Tell the team; they join with it on the Dragon page.`)
  }

  async function removeTeam(team: Overview['teams'][number]) {
    if (!supabase || !window.confirm(`Delete "${team.name}" and all its Dragon progress? This can't be undone.`)) return
    const { error } = await supabase.rpc('admin_team_delete', { p_team_id: team.id })
    if (error) setErr(error.message)
    else {
      setNote(`Deleted "${team.name}". They can set up again with the same name.`)
      await load()
    }
  }

  if (!data || !draft) {
    return (
      <div style={{ ...card, maxWidth: 760, marginTop: 24 }}>
        <h2 style={h2}>Ender Dragon</h2>
        <p style={{ color: '#CFC6A9' }}>{err || 'Loading…'}</p>
      </div>
    )
  }

  const cfg = data.config
  // All-or-nothing scoring: a team earns its 1 advantage point by clearing the last level
  const finalLevel = Math.max(0, ...data.levels.map((l) => l.level))
  const q = filter.trim().toLowerCase()
  const teams = q ? data.teams.filter((t) => t.name.toLowerCase().includes(q)) : data.teams

  return (
    <div style={{ ...card, maxWidth: 760, marginTop: 24 }}>
      <h2 style={h2}>Ender Dragon</h2>
      <p style={{ color: '#CFC6A9', fontSize: 14, marginTop: 0 }}>
        Status: <strong style={{ color: '#FFB35C' }}>{STATUS_LABEL[cfg.status]}</strong> · {data.msgs_last_min} messages in the
        last minute (cap {cfg.global_per_min}) · {data.msgs_total} total · {data.teams.length} teams
      </p>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Btn tone="grass" disabled={cfg.status === 'open'} onClick={() => void updateConfig({ status: 'open' })}>
          🐉 Open
        </Btn>
        <Btn tone="torch" disabled={cfg.status === 'paused'} onClick={() => void updateConfig({ status: 'paused' })}>
          ⏸ Pause
        </Btn>
        <Btn tone="tnt" disabled={cfg.status === 'closed'} onClick={() => void updateConfig({ status: 'closed' })}>
          💤 Close
        </Btn>
        <Btn tone="ghost" onClick={() => void load()}>
          ↻ Refresh
        </Btn>
      </div>

      <h3 style={h3}>AI engines</h3>
      <EngineStatus cfg={cfg} cfKeys={cfKeys} today={data.engine_today} />
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
        <Btn tone={cfg.engine_mode === 'cloudflare' ? 'grass' : 'ghost'} onClick={() => void updateConfig({ engine_mode: 'cloudflare' })}>
          ☁️ Cloudflare first
        </Btn>
        <Btn tone={cfg.engine_mode === 'laptop' ? 'grass' : 'ghost'} onClick={() => void updateConfig({ engine_mode: 'laptop' })}>
          💻 Laptop first
        </Btn>
        {cfg.cf_exhausted_until && new Date(cfg.cf_exhausted_until) > new Date() && (
          <Btn tone="torch" onClick={() => void updateConfig({ cf_exhausted_until: null })}>
            Retry Cloudflare now
          </Btn>
        )}
      </div>
      <p style={{ color: '#6b6482', fontSize: 12, margin: '8px 0 0' }}>
        Whichever engine is first answers every message; the other takes over automatically on any error, slowness or
        Cloudflare's daily limit. Keep LM Studio and the tunnel running either way.
      </p>

      <h3 style={h3}>Levels cleared</h3>
      <p style={{ fontSize: 14, color: '#CFC6A9', margin: '0 0 8px' }}>
        🏆 Teams that earned the point (beat all {data.levels.length} dragons):{' '}
        <strong style={{ color: '#6FA043' }}>{data.teams.filter((t) => t.cleared.includes(finalLevel)).length}</strong>
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {data.levels.map((l) => (
          <span key={l.level} style={chip}>
            L{l.level}: {l.cleared_by} team{l.cleared_by === 1 ? '' : 's'}
          </span>
        ))}
      </div>

      <h3 style={h3}>Settings</h3>
      <div style={{ display: 'grid', gap: 10 }}>
        <label style={lbl}>
          AI address (tunnel URL from cloudflared, or http://localhost:1234 when testing on this laptop)
          <input style={{ ...input, marginTop: 4 }} value={draft.llm_url} onChange={(e) => setDraft({ ...draft, llm_url: e.target.value.trim() })} />
        </label>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <label style={lbl}>
            Model id in LM Studio
            <input style={{ ...input, marginTop: 4, width: 160 }} value={draft.llm_model} onChange={(e) => setDraft({ ...draft, llm_model: e.target.value.trim() })} />
          </label>
          <label style={lbl}>
            Cooldown per team (s)
            <input style={{ ...input, marginTop: 4, width: 110 }} type="number" min={0} max={600} value={draft.cooldown_s} onChange={(e) => setDraft({ ...draft, cooldown_s: Number(e.target.value) })} />
          </label>
          <label style={lbl}>
            Max messages / min (all teams)
            <input style={{ ...input, marginTop: 4, width: 110 }} type="number" min={1} max={5000} value={draft.global_per_min} onChange={(e) => setDraft({ ...draft, global_per_min: Number(e.target.value) })} />
          </label>
          <label style={lbl}>
            Hint 1 after (messages)
            <input style={{ ...input, marginTop: 4, width: 110 }} type="number" min={0} max={50} value={draft.hint1_after} onChange={(e) => setDraft({ ...draft, hint1_after: Number(e.target.value) })} />
          </label>
          <label style={lbl}>
            Hint 2 after (messages)
            <input style={{ ...input, marginTop: 4, width: 110 }} type="number" min={0} max={50} value={draft.hint2_after} onChange={(e) => setDraft({ ...draft, hint2_after: Number(e.target.value) })} />
          </label>
          <label style={lbl}>
            Guesses / min per team
            <input style={{ ...input, marginTop: 4, width: 110 }} type="number" min={1} max={60} value={draft.guesses_per_min} onChange={(e) => setDraft({ ...draft, guesses_per_min: Number(e.target.value) })} />
          </label>
        </div>
        <div>
          <Btn
            tone="grass"
            onClick={() =>
              void updateConfig({
                llm_url: draft.llm_url,
                llm_model: draft.llm_model,
                cooldown_s: draft.cooldown_s,
                global_per_min: draft.global_per_min,
                guesses_per_min: draft.guesses_per_min,
                hint1_after: draft.hint1_after,
                hint2_after: draft.hint2_after,
              })
            }
          >
            Save settings
          </Btn>
        </div>
        <p style={{ color: '#6b6482', fontSize: 12, margin: 0 }}>
          Level prompts and blocked words are edited in Supabase → Table Editor → dragon_levels. The site picks up
          changes within about 15 seconds.
        </p>
      </div>

      <h3 style={h3}>Teams</h3>
      <input style={{ ...input, marginBottom: 10 }} placeholder="Search teams…" value={filter} onChange={(e) => setFilter(e.target.value)} />
      <div style={{ maxHeight: 360, overflowY: 'auto', border: '2px solid #1B140C', borderRadius: 4 }}>
        {teams.length === 0 && <p style={{ padding: 12, color: '#CFC6A9', margin: 0 }}>No teams yet.</p>}
        {teams.map((t) => (
          <div key={t.id} style={row}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{t.name}</div>
              <div style={{ fontSize: 12, color: '#CFC6A9' }}>
                {t.cleared.includes(finalLevel) ? '✅ 1 point · ' : ''}Levels: {t.cleared.length}/{data.levels.length} ·{' '}
                {t.msgs} messages
              </div>
            </div>
            <Btn tone="ghost" onClick={() => void newKey(t)}>
              New key
            </Btn>
            <Btn tone="tnt" onClick={() => void removeTeam(t)}>
              Delete
            </Btn>
          </div>
        ))}
      </div>

      {note && <p style={{ color: '#6FA043', fontSize: 14, marginTop: 14, overflowWrap: 'anywhere' }}>{note}</p>}
      {err && <p style={{ color: '#E33D2E', fontSize: 14, marginTop: 14 }}>⚠ {err}</p>}
    </div>
  )
}

function EngineStatus({ cfg, cfKeys, today }: { cfg: Config; cfKeys: boolean | null; today: Overview['engine_today'] }) {
  const exhausted = cfg.cf_exhausted_until && new Date(cfg.cf_exhausted_until) > new Date()
  const used = Math.round(today.cloudflare * NEURONS_PER_MSG)
  const cloud =
    cfKeys === false
      ? '⚠️ Cloudflare keys are not set on the server, so everything goes to the laptop.'
      : exhausted
        ? `⛔ Cloudflare's free limit is used up. Using the laptop until ${new Date(cfg.cf_exhausted_until!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`
        : '✅ Cloudflare ready.'
  return (
    <div style={{ fontSize: 14, color: '#CFC6A9', display: 'grid', gap: 4 }}>
      <span>
        First engine: <strong style={{ color: '#FFB35C' }}>{cfg.engine_mode === 'cloudflare' ? 'Cloudflare' : 'Laptop'}</strong> · {cloud}
      </span>
      <span>
        Today: Cloudflare {today.cloudflare} messages (≈{used.toLocaleString()} of {DAILY_NEURONS.toLocaleString()} free neurons,{' '}
        {Math.min(100, Math.round((used / DAILY_NEURONS) * 100))}%) · Laptop {today.laptop}
        {today.fallback ? ` · Friendly fallback lines ${today.fallback}` : ''}
      </span>
    </div>
  )
}

const h2 = { fontFamily: '"Press Start 2P", monospace', fontSize: 16, margin: '0 0 10px' }
const h3 = { fontSize: 14, textTransform: 'uppercase' as const, letterSpacing: 1, color: '#FFB35C', margin: '22px 0 10px' }
const lbl = { fontSize: 13, color: '#CFC6A9', display: 'block' }
const chip = { padding: '6px 10px', border: '2px solid #1B140C', background: '#0B0E1F', borderRadius: 3, fontSize: 13 }
const row = { display: 'flex', gap: 8, alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid rgba(241,233,210,0.1)' }
