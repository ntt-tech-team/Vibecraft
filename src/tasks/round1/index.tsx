import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import WorldBackground from '../../components/WorldBackground'
import { post, readKey, writeKey, UNREACHABLE, type R1Status, type StageClear } from './api'
import TeamGate from './TeamGate'
import Assemble from './stages/Assemble'
import Memory from './stages/Memory'
import Hunter from './stages/Hunter'
import { ITEMS, MOBS, Pixel } from './sprites'
import { TUNING } from './tuning'
import './round1.css'

// Round 1 · Technical Task — "The Trial": three stages the whole team clears in order within the
// organisers' 15-minute window. The games run in the browser; /api/round1 holds the window and
// each team's cleared stages, so every teammate's laptop shows the same progress.

type StageNo = 1 | 2 | 3
type Theme = 'space' | 'forest' | 'nether'

interface StageInfo {
  no: StageNo
  title: string
  place: string
  theme: Theme
  story: string
  how: string
  keys: string
}

const STAGES: StageInfo[] = [
  {
    no: 1,
    title: 'Assemble',
    place: '🚀 Space',
    theme: 'space',
    story: 'The VibeCraft poster got scrambled in orbit. Slide the pieces back into place.',
    how: `Click a piece next to the gap to slide it. Rebuild the poster within ${TUNING.assemble.maxMoves} moves.`,
    keys: '⌨️ Arrow keys slide a piece into the gap.',
  },
  {
    no: 2,
    title: 'Memory',
    place: '🌲 Night Forest',
    theme: 'forest',
    story: 'Night fell and your items got scattered across the forest. Find every pair.',
    how: `Flip two cards per move. Match all 8 pairs within ${TUNING.memory.maxMoves} moves.`,
    keys: '⌨️ Arrow keys move between cards, Enter flips a card.',
  },
  {
    no: 3,
    title: 'Hunter',
    place: '🔥 Nether',
    theme: 'nether',
    story: 'Hostile mobs are swarming the Nether. Strike them before they duck back down.',
    how: `Hit ${TUNING.hunter.hitsNeeded} mobs within ${TUNING.hunter.seconds} seconds. Empty holes don't cost you anything.`,
    keys: '⌨️ Keys Q W E / A S D / Z X C hit the 9 holes (same layout as the grid).',
  },
]

/** A stage this laptop cleared that the server hasn't confirmed yet. at = server-clock ms. */
interface Pending {
  stage: StageNo
  at: number
}

const POLL_WAITING_MS = 15_000 // before the window opens: notice the Open quickly
const POLL_PLAYING_MS = 20_000 // while open: pick up teammates' clears
const RETRY_MS = 4_000
const WINDOW_MIN = 15 // for the intro text; the real window is whatever the organisers open in /admin
const pendingKey = (teamId: number) => `vc26_r1_pending_${teamId}`

function loadPending(teamId: number): Pending[] {
  try {
    return JSON.parse(localStorage.getItem(pendingKey(teamId)) ?? '[]') as Pending[]
  } catch {
    return []
  }
}

function savePending(teamId: number, list: Pending[]) {
  try {
    if (list.length) localStorage.setItem(pendingKey(teamId), JSON.stringify(list))
    else localStorage.removeItem(pendingKey(teamId))
  } catch {
    /* storage blocked: pending clears just won't survive a refresh */
  }
}

const IST_TIME: Intl.DateTimeFormatOptions = {
  timeZone: 'Asia/Kolkata',
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
  hour12: true,
}

function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  return `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`
}

function formatClock(ms: number): string {
  const s = Math.ceil(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export default function Round1Task() {
  const [key, setKey] = useState(readKey)
  const [status, setStatus] = useState<R1Status | null>(null)
  const [offset, setOffset] = useState(0) // server clock − laptop clock (ms)
  const [notice, setNotice] = useState('')
  const [flushNote, setFlushNote] = useState('')
  const [now, setNow] = useState(Date.now())
  const [pending, setPending] = useState<Pending[]>([])
  const [pendingFor, setPendingFor] = useState<number | null>(null) // team whose pending list is loaded
  const [view, setView] = useState<{ stage: StageNo; mode: 'play' | 'done' } | null>(null)
  const [sawOpen, setSawOpen] = useState(false)

  // Replies can arrive out of order (a poll sent just before a stage clear); keep the newest.
  const newest = useRef(0)
  const apply = useCallback((s: R1Status) => {
    const at = Date.parse(s.now)
    if (at < newest.current) return
    newest.current = at
    setOffset(at - Date.now())
    setStatus(s)
  }, [])

  const refresh = useCallback(
    async (k: string) => {
      const res = await post<R1Status>('/api/round1', { action: 'status', key: k })
      if (res.error || !res.now) {
        setNotice(UNREACHABLE)
        return
      }
      const s = res as R1Status
      setNotice('')
      if (k && !s.team) {
        writeKey(null)
        setKey('')
        setNotice("That team key doesn't work any more. Join again with your team key, or ask an organiser.")
      }
      apply(s)
    },
    [apply],
  )

  useEffect(() => {
    void refresh(key)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(id)
  }, [])

  // ---- derived state ----
  const team = status?.team ?? null
  const teamId = team?.id ?? null
  const serverCleared = new Set((status?.clears ?? []).map((c) => c.stage))
  const cleared = new Set<number>([...serverCleared, ...pending.map((p) => p.stage)])
  const current = ([1, 2, 3] as StageNo[]).find((s) => !cleared.has(s)) ?? null
  const serverNow = now + offset
  const openUntil = status?.open_until ? Date.parse(status.open_until) : 0
  const openedAt = status?.opened_at ? Date.parse(status.opened_at) : 0
  const isOpen = openUntil > serverNow
  const teamDone = serverCleared.has(3)

  useEffect(() => {
    if (isOpen) setSawOpen(true)
  }, [isOpen])

  // ---- this laptop's unconfirmed clears (survive a refresh) ----
  useEffect(() => {
    setPending(teamId ? loadPending(teamId) : [])
    setPendingFor(teamId)
    setView(null)
  }, [teamId])

  // start at the team's first unfinished stage (once this laptop's pending clears are loaded)
  useEffect(() => {
    if (team && !view && pendingFor === team.id)
      setView(current ? { stage: current, mode: 'play' } : { stage: 3, mode: 'done' })
  }, [team, view, current, pendingFor])

  // while the games are closed, point at the team's current stage so a reopen lands there
  useEffect(() => {
    if (!isOpen && current && view?.mode === 'play' && view.stage !== current) setView({ stage: current, mode: 'play' })
  }, [isOpen, current, view])

  const pendingRef = useRef(pending)
  pendingRef.current = pending
  const flushing = useRef(false)

  const updatePending = useCallback(
    (fn: (list: Pending[]) => Pending[]) => {
      setPending((list) => {
        const next = fn(list)
        if (teamId) savePending(teamId, next)
        return next
      })
    },
    [teamId],
  )

  const flush = useCallback(async () => {
    const next = [...pendingRef.current].sort((a, b) => a.stage - b.stage)[0]
    if (!next || flushing.current || !key) return
    flushing.current = true
    const res = await post<R1Status>('/api/round1', { action: 'clear', key, stage: next.stage })
    flushing.current = false
    const drop = () => updatePending((list) => list.filter((p) => p.stage !== next.stage))
    if (res.ok && res.now) {
      apply(res as R1Status)
      setFlushNote('')
      drop()
    } else if (res.reason === 'closed') {
      updatePending(() => [])
      setFlushNote("⏰ Time ran out before your last stage clear reached the server, so it didn't count.")
      void refresh(key)
    } else if (res.reason === 'too_fast') {
      drop()
      setFlushNote('That clear reached the server faster than anyone could play it. Please play the stage again.')
    } else if (res.reason === 'no_team') {
      void refresh(key)
    } else {
      // network or server hiccup, or the previous stage isn't saved yet: the retry loop tries again
      setFlushNote('⏳ Saving your progress… check your Wi-Fi if this stays here.')
      if (res.reason === 'locked') void refresh(key)
    }
  }, [key, apply, refresh, updatePending])

  useEffect(() => {
    if (!pending.length) return
    void flush()
    const id = window.setInterval(() => void flush(), RETRY_MS)
    return () => window.clearInterval(id)
  }, [pending.length, flush])

  // ---- keep in sync with teammates and the organisers' window ----
  const ready = status !== null
  useEffect(() => {
    if (ready) return
    const id = window.setInterval(() => void refresh(key), 8_000) // first load failed: keep trying
    return () => window.clearInterval(id)
  }, [ready, key, refresh])
  useEffect(() => {
    if (!ready || teamDone) return
    const check = () => {
      if (!document.hidden) void refresh(key)
    }
    const id = window.setInterval(check, isOpen ? POLL_PLAYING_MS : POLL_WAITING_MS)
    document.addEventListener('visibilitychange', check)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', check)
    }
  }, [ready, teamDone, isOpen, key, refresh])

  function won(stage: StageNo) {
    if (!cleared.has(stage)) updatePending((list) => [...list, { stage, at: Date.now() + offset }])
    setView({ stage, mode: 'done' })
  }

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
    setStatus((s) => (s ? { ...s, team: null, clears: [] } : s))
  }

  // ---- render ----
  let body: ReactNode
  if (!status) {
    body = <p className="r1-muted">{notice ? '' : 'Loading The Trial…'}</p>
  } else if (!team) {
    body = <TeamGate registrationOpen={status.registration_open} onJoined={joined} />
  } else if (view) {
    const stage3 = status.clears.find((c) => c.stage === 3)
    const pending3 = pending.find((p) => p.stage === 3)
    let main: ReactNode
    if (cleared.size === 3) {
      main = <Victory teamName={team.name} stage3={stage3} pending3={pending3} openedAt={openedAt} />
    } else if (view.mode === 'done' && cleared.has(view.stage)) {
      main = <StageDone stage={view.stage} next={current} onNext={(s) => setView({ stage: s, mode: 'play' })} />
    } else if (!isOpen) {
      main = <Closed timeUp={sawOpen || openedAt > 0} clearedCount={cleared.size} onCheck={() => void refresh(key)} />
    } else {
      const stageNo = Math.min(view.stage, current ?? 3) as StageNo
      main = (
        <StageShell
          info={STAGES[stageNo - 1]}
          teammateCleared={cleared.has(stageNo)}
          next={current}
          onNext={(s) => setView({ stage: s, mode: 'play' })}
        >
          {stageNo === 1 ? (
            <Assemble onWin={() => won(1)} />
          ) : stageNo === 2 ? (
            <Memory onWin={() => won(2)} />
          ) : (
            <Hunter onWin={() => won(3)} />
          )}
        </StageShell>
      )
    }
    body = (
      <>
        <div className="r1-status">
          <TeamBar name={team.name} teamKey={key} onLeave={leave} />
          <StageTrack cleared={cleared} current={current} />
          <TimerBar isOpen={isOpen} leftMs={openUntil - serverNow} done={cleared.size === 3} />
        </div>
        {flushNote && cleared.size < 3 && (
          <p className="r1-notice" role="status">
            {flushNote}
          </p>
        )}
        {main}
      </>
    )
  }

  return (
    <div className="round-page">
      <WorldBackground world="overworld" />
      <header className="site">
        <nav className="nav">
          <Link to="/" className="brand">
            <span className="block-icon" aria-hidden="true" />
            VIBECRAFT
          </Link>
          <Link to="/round/1" className="r1-navlink">
            ← Round 1
          </Link>
        </nav>
      </header>

      <main className="r1-main">
        <div className="r1-shell">
          <div className="r1-heading">
            <h1 className="r1-title">The Trial</h1>
            <p className="round-eyebrow r1-eyebrow">ROUND 1 · TECHNICAL TASK</p>
          </div>
          {!team && (
            <p className="r1-lead">
              Three stages: <strong>Assemble</strong>, <strong>Memory</strong> and <strong>Hunter</strong>. Clear all
              three as a team before the {WINDOW_MIN}-minute timer runs out to earn{' '}
              <strong>1 advantage point</strong>. Everyone on the team can play on their own laptop, and a stage
              cleared by anyone counts for the whole team.
            </p>
          )}

          {notice && (
            <p className="r1-notice" role="status">
              {notice}
            </p>
          )}

          {body}
        </div>
      </main>
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
function TeamBar({ name, teamKey, onLeave }: { name: string; teamKey: string; onLeave: () => void }) {
  const [showKey, setShowKey] = useState(false)
  return (
    <div className="r1-teambar">
      <span>
        Team <strong>{name}</strong>
      </span>
      <button type="button" className="r1-link" onClick={() => setShowKey((v) => !v)}>
        {showKey ? <span className="r1-mono">{teamKey}</span> : 'Show team key'}
      </button>
      <button type="button" className="r1-link" onClick={onLeave}>
        Not your team?
      </button>
    </div>
  )
}

function TimerBar({ isOpen, leftMs, done }: { isOpen: boolean; leftMs: number; done: boolean }) {
  if (done) return null
  return (
    <div className={`r1-timer${isOpen && leftMs <= 60_000 ? ' is-low' : ''}${isOpen ? '' : ' is-closed'}`} role="timer">
      {isOpen ? (
        <>
          <span className="r1-timer-label">⏳ Left</span>
          <span className="r1-timer-clock">{formatClock(leftMs)}</span>
        </>
      ) : (
        <span className="r1-timer-label">🔒 Closed</span>
      )}
    </div>
  )
}

function StageTrack({ cleared, current }: { cleared: Set<number>; current: StageNo | null }) {
  return (
    <ol className="r1-track" aria-label="Stages">
      {STAGES.map((s) => {
        const done = cleared.has(s.no)
        const now = s.no === current
        return (
          <li key={s.no} className={`r1-step${done ? ' is-done' : ''}${now ? ' is-now' : ''}`}>
            <span className="r1-step-num" aria-hidden="true">
              {done ? '✓' : now ? s.no : '🔒'}
            </span>
            <span>
              {s.title}
              <span className="sr-only">{done ? ' (cleared)' : now ? ' (current stage)' : ' (locked)'}</span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function Floaters({ theme }: { theme: Theme }) {
  if (theme === 'space') {
    return (
      <div className="r1-floaters" aria-hidden="true">
        <span className="r1-float f1">
          <Pixel art={ITEMS.pickaxe.art} />
        </span>
        <span className="r1-float f2">
          <Pixel art={ITEMS.tnt.art} />
        </span>
        <span className="r1-float f3">
          <Pixel art={ITEMS.diamond.art} />
        </span>
        <span className="r1-float f4">
          <Pixel art={ITEMS.pearl.art} />
        </span>
      </div>
    )
  }
  if (theme === 'forest') {
    return (
      <div className="r1-floaters" aria-hidden="true">
        <span className="r1-moon" />
        {[1, 2, 3, 4, 5, 6, 7].map((n) => (
          <span key={n} className={`r1-firefly ff${n}`} />
        ))}
      </div>
    )
  }
  return (
    <div className="r1-floaters" aria-hidden="true">
      {[1, 2, 3, 4, 5, 6].map((n) => (
        <span key={n} className={`r1-flame fl${n}`} />
      ))}
      <span className="r1-float f5">
        <Pixel art={MOBS[3].art} />
      </span>
    </div>
  )
}

function StageShell({
  info,
  teammateCleared,
  next,
  onNext,
  children,
}: {
  info: StageInfo
  teammateCleared: boolean
  next: StageNo | null
  onNext: (s: StageNo) => void
  children: ReactNode
}) {
  return (
    <div className={`r1-stage r1-stage--${info.theme}`}>
      <Floaters theme={info.theme} />
      <div className="r1-stage-body">
        {teammateCleared && next && (
          <div className="r1-banner" role="status">
            <span>✅ A teammate already cleared {info.title}!</span>
            <button type="button" className="btn torch r1-small-btn" onClick={() => onNext(next)}>
              Go to {STAGES[next - 1].title} →
            </button>
          </div>
        )}
        <div className="r1-stage-head">
          <h2 className="r1-stage-title">{info.title}</h2>
          <span className="r1-stage-tag">
            {info.place} · Stage {info.no} of 3
          </span>
        </div>
        <p className="r1-story">
          {info.story} <strong className="r1-how">How to win:</strong> {info.how}
        </p>
        <p className="r1-keys">{info.keys}</p>
        {children}
      </div>
    </div>
  )
}

function StageDone({ stage, next, onNext }: { stage: StageNo; next: StageNo | null; onNext: (s: StageNo) => void }) {
  const info = STAGES[stage - 1]
  return (
    <div className={`r1-stage r1-stage--${info.theme}`}>
      <Floaters theme={info.theme} />
      <div className="r1-stage-body r1-done">
        <p className="r1-done-big">✅ {info.title} cleared!</p>
        {stage === 1 && <img src="/banner.jpg" alt="The VibeCraft poster, rebuilt" className="r1-done-img" />}
        <p className="r1-story">Saved for your whole team. Every teammate's laptop will show it within a few seconds.</p>
        {next && (
          <button type="button" className="btn torch" onClick={() => onNext(next)}>
            Next: {STAGES[next - 1].title} →
          </button>
        )}
      </div>
    </div>
  )
}

function Closed({ timeUp, clearedCount, onCheck }: { timeUp: boolean; clearedCount: number; onCheck: () => void }) {
  return (
    <div className="r1-card-panel r1-closed">
      {timeUp ? (
        <>
          <p className="r1-done-big">⏰ Time's up!</p>
          <p className="r1-muted">
            The Trial is closed. Your team cleared {clearedCount} of 3 stages. Thanks for playing!
          </p>
        </>
      ) : (
        <>
          <p className="r1-done-big">🔒 The Trial hasn't opened yet</p>
          <p className="r1-muted">
            It opens when the organisers start Round 1's Technical Task, and this page updates by itself. Make sure
            everyone on your team has joined with the team key before then.
          </p>
          {clearedCount > 0 && <p className="r1-muted">Your team has cleared {clearedCount} of 3 stages so far.</p>}
        </>
      )}
      <button type="button" className="btn ghost r1-small-btn" onClick={onCheck}>
        ↻ Check now
      </button>
    </div>
  )
}

function Victory({
  teamName,
  stage3,
  pending3,
  openedAt,
}: {
  teamName: string
  stage3: StageClear | undefined
  pending3: Pending | undefined
  openedAt: number
}) {
  const saved = Boolean(stage3)
  const completedAt = stage3 ? Date.parse(stage3.cleared_at) : pending3?.at ?? Date.now()
  const elapsed = stage3 ? stage3.elapsed_s : openedAt ? (completedAt - openedAt) / 1000 : null
  return (
    <div className="r1-victory" role="status">
      <p className="r1-victory-trophy" aria-hidden="true">
        🏆
      </p>
      <p className="r1-victory-title">ALL 3 STAGES CLEARED</p>
      <p className="r1-victory-team">{teamName}</p>
      <dl className="r1-victory-facts">
        <div>
          <dt>Time taken</dt>
          <dd>{elapsed === null ? '—' : formatDuration(elapsed)}</dd>
        </div>
        <div>
          <dt>Completed at</dt>
          <dd>{new Date(completedAt).toLocaleTimeString('en-US', IST_TIME)}</dd>
        </div>
      </dl>
      <p className={`r1-victory-saved${saved ? '' : ' is-pending'}`}>
        {saved
          ? '✅ +1 advantage point saved for your team'
          : '⏳ Saving your point… keep this page open and check your Wi-Fi.'}
      </p>
      <p className="r1-victory-volunteer">👉 Show this screen to a volunteer</p>
    </div>
  )
}
