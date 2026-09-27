import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { MOBS, Pixel } from '../sprites'
import { TUNING } from '../tuning'

// Stage 3 · Hunter: mobs pop out of 9 holes. Hit enough of them before the clock runs out.
// Hitting an empty hole costs nothing. Keys Q W E / A S D / Z X C (or the number pad) match the grid.

const { hitsNeeded, seconds, spawnSlowMs, spawnFastMs, staySlowMs, stayFastMs, maxMobs } = TUNING.hunter
const TOTAL_MS = seconds * 1000
const LETTERS = ['q', 'w', 'e', 'a', 's', 'd', 'z', 'x', 'c']
const NUMPAD = ['7', '8', '9', '4', '5', '6', '1', '2', '3']
const HOLES = [0, 1, 2, 3, 4, 5, 6, 7, 8]

interface Mob {
  id: number
  type: number
  until: number
}

interface Round {
  t0: number
  hits: number
  mobs: Map<number, Mob>
  poofs: Map<number, number> // hole → show the hit effect until
  nextSpawn: number
  lastHole: number
  seq: number
}

const lerp = (a: number, b: number, p: number) => a + (b - a) * Math.min(1, Math.max(0, p))

function freshRound(): Round {
  const now = performance.now()
  return { t0: now, hits: 0, mobs: new Map(), poofs: new Map(), nextSpawn: now + 500, lastHole: -1, seq: 0 }
}

export default function Hunter({ onWin }: { onWin: () => void }) {
  const [phase, setPhase] = useState<'ready' | 'playing' | 'won' | 'lost'>('ready')
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const round = useRef<Round>(freshRound())
  const loop = useRef<number>()
  const winTimer = useRef<number>()
  const [, redraw] = useReducer((n: number) => n + 1, 0)

  const stop = () => window.clearInterval(loop.current)
  useEffect(
    () => () => {
      stop()
      window.clearTimeout(winTimer.current)
    },
    [],
  )

  function tick() {
    const r = round.current
    const now = performance.now()
    const elapsed = now - r.t0
    if (elapsed >= TOTAL_MS) {
      stop()
      r.mobs.clear()
      setPhase('lost')
      return
    }
    for (const [hole, mob] of r.mobs) if (mob.until <= now) r.mobs.delete(hole)
    for (const [hole, until] of r.poofs) if (until <= now) r.poofs.delete(hole)
    if (now >= r.nextSpawn) {
      const p = elapsed / TOTAL_MS
      if (r.mobs.size < maxMobs) {
        const free = HOLES.filter((h) => !r.mobs.has(h) && h !== r.lastHole)
        const hole = free[Math.floor(Math.random() * free.length)]
        r.mobs.set(hole, { id: ++r.seq, type: Math.floor(Math.random() * MOBS.length), until: now + lerp(staySlowMs, stayFastMs, p) })
        r.lastHole = hole
      }
      r.nextSpawn = now + Math.max(spawnFastMs, lerp(spawnSlowMs, spawnFastMs, p) * (0.85 + Math.random() * 0.15))
    }
    redraw()
  }

  function start() {
    stop()
    window.clearTimeout(winTimer.current)
    round.current = freshRound()
    setPhase('playing')
    loop.current = window.setInterval(tick, 50)
  }

  const hit = useCallback(
    (hole: number) => {
      if (phaseRef.current !== 'playing') return
      const r = round.current
      if (!r.mobs.has(hole)) return // empty hole: no penalty
      r.mobs.delete(hole)
      r.poofs.set(hole, performance.now() + 250)
      r.hits++
      if (r.hits >= hitsNeeded) {
        stop()
        r.mobs.clear()
        setPhase('won')
        winTimer.current = window.setTimeout(onWin, 1000)
      }
      redraw()
    },
    [onWin],
  )

  useEffect(() => {
    if (phase !== 'playing') return
    function onKey(e: KeyboardEvent) {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
      const k = e.key.toLowerCase()
      const hole = LETTERS.includes(k) ? LETTERS.indexOf(k) : NUMPAD.indexOf(k)
      if (hole < 0) return
      e.preventDefault()
      hit(hole)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, hit])

  const r = round.current
  const elapsed = phase === 'playing' ? performance.now() - r.t0 : phase === 'ready' ? 0 : TOTAL_MS
  const left = Math.max(0, (TOTAL_MS - elapsed) / 1000)

  return (
    <div className="r1-split">
      <div className="r1-holes" role="group" aria-label="Mob holes">
        {HOLES.map((h) => {
          const mob = r.mobs.get(h)
          return (
            <button
              key={h}
              type="button"
              className={`r1-hole${mob ? ' has-mob' : ''}`}
              onPointerDown={(e) => {
                e.preventDefault()
                hit(h)
              }}
              onClick={(e) => {
                if (e.detail === 0) hit(h) // keyboard Enter/Space on a focused hole
              }}
              aria-label={`Hole ${LETTERS[h].toUpperCase()}${mob ? `: ${MOBS[mob.type].name}!` : ''}`}
            >
              <span className="r1-hole-key" aria-hidden="true">
                {LETTERS[h].toUpperCase()}
              </span>
              <span className="r1-hole-pit" aria-hidden="true" />
              {mob && (
                <span key={mob.id} className="r1-mob" aria-hidden="true">
                  <Pixel art={MOBS[mob.type].art} />
                </span>
              )}
              {r.poofs.has(h) && (
                <span className="r1-poof" aria-hidden="true">
                  💥
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="r1-side">
        <p className="r1-counter">
          🎯 Hits <strong>{r.hits}</strong> / {hitsNeeded}
        </p>
        <p className={`r1-counter${phase === 'playing' && left <= 5 ? ' is-low' : ''}`}>
          ⏱ <strong>{phase === 'won' ? '—' : left.toFixed(1)}</strong> s left
        </p>
        {(phase === 'ready' || phase === 'lost') && (
          <button type="button" className="btn torch" onClick={start}>
            {phase === 'ready' ? `▶ Start (${seconds} s)` : '↻ Try again'}
          </button>
        )}
        <p className="r1-msg" role="status">
          {phase === 'lost'
            ? `Time's up: ${r.hits} / ${hitsNeeded} hits. So close! Try again.`
            : phase === 'won'
              ? '🎉 The Nether is safe!'
              : phase === 'ready'
                ? 'Press Start when your hand is ready.'
                : ''}
        </p>
      </div>
    </div>
  )
}
