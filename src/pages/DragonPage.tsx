import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import WorldBackground from '../components/WorldBackground'
import { normalizeTeamKey } from '../lib/teamKey'
import './dragon.css'

// Round 2 · Phase 2 — the Ender Dragon prompt heist. Talks only to /api/dragon.

const LS_KEY = 'vc26_team_key'
const LOG_PREFIX = 'vc26_dragon_log_'
const MAX_MESSAGE = 400

type DragonStatus = 'closed' | 'open' | 'paused'

interface LevelInfo {
  level: number
  title: string
  intro: string
  points: number
  hints?: string[]
  next_hint_in?: number | null
}

interface HintState {
  hints: string[]
  next: number | null
}

interface StatusResponse {
  status: DragonStatus
  team: { id: number; name: string } | null
  cleared?: number[]
  cooldown_s?: number
  cooldown_left?: number
  levels?: LevelInfo[]
  error?: string
}

interface Line {
  from: 'you' | 'dragon' | 'system'
  text: string
  tone?: 'burn' | 'warn' | 'ok'
}

type Reply<T> = Partial<T> & { error?: string }

/** Every field may be missing; network failures come back as { error: 'network' }. */
async function api<T>(body: Record<string, unknown>): Promise<Reply<T>> {
  try {
    const res = await fetch('/api/dragon', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    return (await res.json()) as Reply<T>
  } catch {
    return { error: 'network' } as Reply<T>
  }
}

function readKey(): string {
  try {
    return localStorage.getItem(LS_KEY) ?? ''
  } catch {
    return ''
  }
}

function writeKey(key: string | null) {
  try {
    if (key) localStorage.setItem(LS_KEY, key)
    else localStorage.removeItem(LS_KEY)
  } catch {
    /* storage blocked: the team re-enters its key after a refresh */
  }
}

const UNREACHABLE = "The dragon's lair can't be reached right now. Check your Wi-Fi, or ask an organiser."

export default function DragonPage() {
  const [key, setKey] = useState(readKey)
  const [state, setState] = useState<StatusResponse | null>(null)
  const [notice, setNotice] = useState('')

  const refresh = useCallback(async (k: string) => {
    const res = await api<StatusResponse>({ action: 'status', key: k })
    if (res.error || !res.status) {
      setNotice(UNREACHABLE)
      return null
    }
    const s = res as StatusResponse
    if (k && !s.team) {
      writeKey(null)
      setKey('')
      setNotice("That team key doesn't work any more. Set up again, or ask an organiser.")
    }
    setState(s)
    return s
  }, [])

  useEffect(() => {
    void refresh(key)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // While the dragon is closed or paused, check back every 30 s so the page wakes up by itself.
  // Hidden tabs don't check at all; returning to the tab checks straight away.
  useEffect(() => {
    if (!state || state.status === 'open') return
    const check = () => {
      if (!document.hidden) void refresh(key)
    }
    const id = window.setInterval(check, 30_000)
    document.addEventListener('visibilitychange', check)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', check)
    }
  }, [state, key, refresh])

  function joined(newKey: string) {
    writeKey(newKey)
    setKey(newKey)
    setNotice('')
    void refresh(newKey)
  }

  function leave() {
    if (!window.confirm('Leave this team on this laptop? You can join again with the team key.')) return
    writeKey(null)
    setKey('')
    setState((s) => (s ? { ...s, team: null } : s))
  }

  return (
    <div className="round-page">
      <WorldBackground world="end" />
      <header className="site">
        <nav className="nav">
          <Link to="/" className="brand">
            <span className="block-icon" aria-hidden="true" />
            VIBECRAFT
          </Link>
          <Link to="/round/2" className="dg-navlink">
            ← Round 2
          </Link>
        </nav>
      </header>

      <main className="dg-main">
        <div className="dg-shell">
          <p className="round-eyebrow" style={{ color: 'var(--ender-light)' }}>
            ROUND 2 · PHASE 2 · TECHNICAL TASK
          </p>
          <h1 className="dg-title">The Ender Dragon</h1>
          <p className="dg-lead">
            Four dragons each guard a password. Talk them into revealing it, then enter it to beat the
            level. Every team gets its own passwords, so sharing answers won't help anyone.{' '}
            <strong>Beat all four dragons to earn your team 1 advantage point.</strong>
          </p>

          {notice && (
            <p className="dg-notice" role="status">
              {notice}
            </p>
          )}

          {!state ? (
            <p className="dg-muted">Waking the dragon…</p>
          ) : !state.team ? (
            <TeamGate onJoined={joined} />
          ) : (
            <Game key={state.team.id} teamKey={key} state={state} refresh={() => refresh(key)} onLeave={leave} />
          )}
        </div>
      </main>
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
function TeamGate({ onJoined }: { onJoined: (key: string) => void }) {
  const [name, setName] = useState('')
  const [joinKey, setJoinKey] = useState('')
  const [created, setCreated] = useState<{ name: string; key: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [setupMsg, setSetupMsg] = useState('')
  const [joinMsg, setJoinMsg] = useState('')

  async function setup(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setSetupMsg('')
    const res = await api<{ team: { name: string }; key: string }>({ action: 'setup', name })
    setBusy(false)
    if (res.key && res.team) {
      setCreated({ name: res.team.name, key: res.key })
      return
    }
    const err = res.error
    setSetupMsg(
      err === 'name_taken'
        ? 'That team name is already set up. If a teammate did it, ask them for the team key and join below. If not, ask an organiser.'
        : err === 'bad_name'
          ? 'Use 2–40 characters, including at least two letters or numbers.'
          : err === 'team_limit'
            ? 'Team setup is full. Ask an organiser.'
            : UNREACHABLE,
    )
  }

  async function join(e: FormEvent) {
    e.preventDefault()
    const k = normalizeTeamKey(joinKey)
    if (!k) return
    setBusy(true)
    setJoinMsg('')
    const res = await api<StatusResponse>({ action: 'status', key: k })
    setBusy(false)
    if (res.team) onJoined(k)
    else setJoinMsg(res.error ? UNREACHABLE : "That key doesn't match any team. Check it with your teammate.")
  }

  if (created) {
    return (
      <div className="dg-card dg-created">
        <p className="dg-label">Team set up: {created.name}</p>
        <p className="dg-bigkey">{created.key}</p>
        <p>
          This is your <strong>team key</strong>. Teammates who want to play on their own laptops enter it
          under “Join your team”. Keep it inside your team.
        </p>
        <button className="btn torch" onClick={() => onJoined(created.key)}>
          Enter the dragon's lair →
        </button>
      </div>
    )
  }

  return (
    <div className="dg-gate">
      <form className="dg-card" onSubmit={setup}>
        <h2 className="dg-h2">New here? Set up your team</h2>
        <p className="dg-muted">One person per team does this, once.</p>
        <label htmlFor="dg-team-name" className="dg-label">
          Team name (as registered)
        </label>
        <input
          id="dg-team-name"
          className="dg-input"
          value={name}
          maxLength={40}
          autoComplete="off"
          onChange={(e) => setName(e.target.value)}
        />
        <button className="btn torch" disabled={busy || name.trim().length < 2}>
          Set up team
        </button>
        <p className="dg-err" role="status">
          {setupMsg}
        </p>
      </form>

      <form className="dg-card" onSubmit={join}>
        <h2 className="dg-h2">Join your team</h2>
        <p className="dg-muted">Enter the team key shown on your teammate's screen.</p>
        <label htmlFor="dg-join-key" className="dg-label">
          Team key
        </label>
        <input
          id="dg-join-key"
          className="dg-input dg-mono"
          value={joinKey}
          placeholder="CREEPER-123456"
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => setJoinKey(e.target.value)}
        />
        <button className="btn" disabled={busy || !joinKey.trim()}>
          Join
        </button>
        <p className="dg-err" role="status">
          {joinMsg}
        </p>
      </form>
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
function loadLog(teamId: number): Record<number, Line[]> {
  try {
    return JSON.parse(localStorage.getItem(LOG_PREFIX + teamId) ?? '{}') as Record<number, Line[]>
  } catch {
    return {}
  }
}

function Game({
  teamKey,
  state,
  refresh,
  onLeave,
}: {
  teamKey: string
  state: StatusResponse
  refresh: () => Promise<StatusResponse | null>
  onLeave: () => void
}) {
  const team = state.team!
  const levels = state.levels ?? []
  const cleared = new Set(state.cleared ?? [])
  const current = levels.find((l) => !cleared.has(l.level))?.level ?? null

  const [selected, setSelected] = useState<number>(current ?? levels.length)
  const [log, setLog] = useState<Record<number, Line[]>>(() => loadLog(team.id))
  const [message, setMessage] = useState('')
  const [guess, setGuess] = useState('')
  const [guessMsg, setGuessMsg] = useState('')
  const [guessShake, setGuessShake] = useState(false)
  const [pending, setPending] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [cooldownUntil, setCooldownUntil] = useState(() => Date.now() + (state.cooldown_left ?? 0) * 1000)
  // unlocked hints per level (from the server, so every teammate's laptop sees the same)
  const [hintState, setHintState] = useState<Record<number, HintState>>({})
  useEffect(() => {
    setHintState(Object.fromEntries(levels.map((l) => [l.level, { hints: l.hints ?? [], next: l.next_hint_in ?? null }])))
  }, [state]) // eslint-disable-line react-hooks/exhaustive-deps
  const [now, setNow] = useState(Date.now())
  const logEnd = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(LOG_PREFIX + team.id, JSON.stringify(log))
    } catch {
      /* ignore */
    }
    logEnd.current?.scrollIntoView({ block: 'nearest' })
  }, [log, team.id])

  // follow the player to the next level after a clear
  useEffect(() => {
    if (current !== null) setSelected(current)
  }, [current])

  const add = (level: number, ...lines: Line[]) =>
    setLog((prev) => ({ ...prev, [level]: [...(prev[level] ?? []), ...lines].slice(-40) }))

  const cooldownLeft = Math.max(0, Math.ceil((cooldownUntil - now) / 1000))
  const open = state.status === 'open'
  const info = levels.find((l) => l.level === selected)
  const isCurrent = selected === current
  const canSend = open && isCurrent && !pending && cooldownLeft === 0 && message.trim().length > 0

  async function send(e: FormEvent) {
    e.preventDefault()
    if (!canSend || !info) return
    const text = message.trim()
    setPending(true)
    const res = await api<{
      ok: boolean
      reply: string
      burned: boolean
      blocked_word: string
      reason: string
      retry_after: number
      cooldown_s: number
      hints: string[]
      next_hint_in: number | null
    }>({ action: 'chat', key: teamKey, level: selected, message: text })
    setPending(false)

    if (res.blocked_word) {
      add(selected, {
        from: 'system',
        tone: 'warn',
        text: `🛡️ ${info.title} refuses to hear the word “${res.blocked_word}”. Rephrase it. This didn't use your turn.`,
      })
      return
    }
    if (res.ok) {
      setMessage('')
      setCooldownUntil(Date.now() + (res.cooldown_s ?? 30) * 1000)
      const newHint = !!res.hints && res.hints.length > (hintState[selected]?.hints.length ?? 0)
      if (res.hints) setHintState((h) => ({ ...h, [selected]: { hints: res.hints ?? [], next: res.next_hint_in ?? null } }))
      add(
        selected,
        { from: 'you', text },
        res.burned
          ? { from: 'dragon', tone: 'burn', text: '🔥 The dragon started to answer, but its reply contained the password, so its fire burned the words away.' }
          : { from: 'dragon', text: res.reply ?? '…' },
        ...(newHint ? [{ from: 'system' as const, tone: 'ok' as const, text: '💡 A new hint is unlocked above the chat.' }] : []),
      )
      return
    }

    const reason = res.reason
    if (reason === 'cooldown' || reason === 'busy') {
      setCooldownUntil(Date.now() + (res.retry_after ?? 8) * 1000)
      if (reason === 'busy')
        add(selected, { from: 'system', tone: 'warn', text: 'The dragon is battling other adventurers. Try again in a few seconds.' })
    } else if (reason === 'dozed') {
      add(selected, { from: 'system', tone: 'warn', text: "The dragon dozed off before answering. That try didn't count. Send it again." })
    } else if (res.error === 'too_long') {
      add(selected, { from: 'system', tone: 'warn', text: `Keep messages under ${MAX_MESSAGE} characters.` })
    } else if (reason && ['closed', 'paused', 'locked', 'already_cleared', 'no_team'].includes(reason)) {
      await refresh()
    } else {
      add(selected, { from: 'system', tone: 'warn', text: UNREACHABLE })
    }
  }

  async function submitGuess(e: FormEvent) {
    e.preventDefault()
    if (!guess.trim() || !isCurrent || pending) return
    setPending(true)
    setGuessMsg('')
    const res = await api<{ ok: boolean; correct: boolean; points: number; reason: string; retry_after: number }>({
      action: 'guess',
      key: teamKey,
      level: selected,
      guess,
    })
    setPending(false)
    if (res.ok && res.correct) {
      // All-or-nothing: only the last level carries the point (dragon_levels.points)
      const isLast = selected === Math.max(...levels.map((l) => l.level))
      add(selected, {
        from: 'system',
        tone: 'ok',
        text: isLast
          ? `🏆 You beat all ${levels.length} dragons! +${res.points || 1} advantage point for your team.`
          : `🏆 Level ${selected} cleared! Keep going: beat all ${levels.length} dragons to earn 1 advantage point.`,
      })
      setGuess('')
      await refresh()
      return
    }
    if (res.ok) {
      setGuessMsg("That's not the password.")
      setGuessShake(true)
      window.setTimeout(() => setGuessShake(false), 400)
      return
    }
    const reason = res.reason
    if (reason === 'guess_limit') setGuessMsg(`Too many guesses. Try again in ${res.retry_after ?? 30}s.`)
    else if (reason && ['closed', 'paused', 'locked', 'already_cleared', 'no_team'].includes(reason)) await refresh()
    else setGuessMsg(UNREACHABLE)
  }

  return (
    <div className="dg-game">
      <div className="dg-teambar">
        <span>
          Team <strong>{team.name}</strong>
        </span>
        <button className="dg-link" onClick={() => setShowKey((v) => !v)}>
          {showKey ? <span className="dg-mono">{teamKey}</span> : 'Show team key'}
        </button>
        <button className="dg-link" onClick={onLeave}>
          Not your team?
        </button>
      </div>

      {state.status !== 'open' && (
        <p className="dg-banner" role="status">
          {state.status === 'paused'
            ? '⏸ The organisers have paused the dragons. Hang tight, this page will wake up by itself.'
            : '💤 The dragons are asleep. They wake up when Phase 2 begins, and this page will update by itself.'}
        </p>
      )}

      <div className="dg-layout">
        <ol className="dg-ladder" aria-label="Levels">
          {levels.map((l) => {
            const done = cleared.has(l.level)
            const locked = !done && l.level !== current
            return (
              <li key={l.level}>
                <button
                  className={`dg-step${l.level === selected ? ' is-selected' : ''}${done ? ' is-done' : ''}`}
                  disabled={locked}
                  onClick={() => setSelected(l.level)}
                  aria-current={l.level === selected ? 'step' : undefined}
                >
                  <span className="dg-step-num">{done ? '✓' : locked ? '🔒' : l.level}</span>
                  <span className="dg-step-name">{l.title}</span>
                </button>
              </li>
            )
          })}
        </ol>

        <section className="dg-panel" aria-label="Chat with the dragon">
          {current === null ? (
            <div className="dg-victory">
              <p className="dg-bigemoji" aria-hidden="true">
                🐉👑
              </p>
              <h2 className="dg-h2">You outwitted all the dragons!</h2>
              <p>Your team has cleared every level and earned 1 advantage point. Well played.</p>
            </div>
          ) : info ? (
            <>
              <div className="dg-panel-head">
                <h2 className="dg-h2">
                  Level {info.level} · {info.title}
                </h2>
                <p className="dg-muted">{info.intro}</p>
                {!cleared.has(selected) && (
                  <div className="dg-hints">
                    {(hintState[selected]?.hints ?? []).map((h, i) => (
                      <p key={i} className="dg-hint">
                        💡 <strong>Hint {i + 1}:</strong> {h}
                      </p>
                    ))}
                    {hintState[selected]?.next != null && (
                      <p className="dg-small">
                        💡 {hintState[selected]!.hints.length ? 'Another hint' : 'A hint'} unlocks after{' '}
                        {hintState[selected]!.next} more message{hintState[selected]!.next === 1 ? '' : 's'} to this dragon.
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="dg-log" aria-live="polite">
                {(log[selected] ?? []).length === 0 && (
                  <p className="dg-muted dg-empty">Say something to the dragon to begin.</p>
                )}
                {(log[selected] ?? []).map((line, i) => (
                  <p key={i} className={`dg-line dg-${line.from}${line.tone ? ` dg-${line.tone}` : ''}`}>
                    {line.from === 'dragon' && <span aria-hidden="true">🐉 </span>}
                    {line.text}
                  </p>
                ))}
                <div ref={logEnd} />
              </div>

              {cleared.has(selected) ? (
                <p className="dg-ok">✅ You beat this level.</p>
              ) : (
                <>
                  <p className="dg-rule">
                    🐉 Dragons forget everything between messages, so each message has to work on its own.
                    Found the password? Type it in the box below.
                  </p>
                  <form className="dg-compose" onSubmit={send}>
                    <label htmlFor="dg-msg" className="sr-only">
                      Message to the dragon
                    </label>
                    <textarea
                      id="dg-msg"
                      className="dg-input"
                      rows={3}
                      maxLength={MAX_MESSAGE}
                      value={message}
                      placeholder="Try to trick the dragon…"
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          e.currentTarget.form?.requestSubmit()
                        }
                      }}
                    />
                    <div className="dg-compose-row">
                      <span className="dg-small">
                        {pending
                          ? '🐉 The dragon is thinking…'
                          : cooldownLeft > 0
                            ? `🐉 The dragon is catching its breath… ${cooldownLeft}s`
                            : `${message.length}/${MAX_MESSAGE}`}
                      </span>
                      <button className="btn torch" disabled={!canSend}>
                        Send
                      </button>
                    </div>
                  </form>

                  <form className={`dg-guess${guessShake ? ' shake' : ''}`} onSubmit={submitGuess}>
                    <label htmlFor="dg-guess" className="dg-label">
                      Got the password?
                    </label>
                    <div className="dg-guess-row">
                      <input
                        id="dg-guess"
                        className="dg-input dg-mono"
                        value={guess}
                        maxLength={60}
                        autoComplete="off"
                        spellCheck={false}
                        onChange={(e) => setGuess(e.target.value)}
                      />
                      <button className="btn" disabled={!open || pending || !guess.trim()}>
                        Check
                      </button>
                    </div>
                    <p className="dg-err" role="status">
                      {guessMsg}
                    </p>
                  </form>
                </>
              )}
            </>
          ) : null}
        </section>
      </div>
    </div>
  )
}
