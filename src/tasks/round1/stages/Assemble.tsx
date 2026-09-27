import { useCallback, useEffect, useRef, useState } from 'react'
import { TUNING } from '../tuning'

// Stage 1 · Assemble: a 3×3 sliding puzzle of the VibeCraft poster. board[position] = piece,
// pieces 0–7 are the poster, 8 is the gap. Solved when board is [0,1,2,3,4,5,6,7,8].

const SIZE = 3
const GAP = 8
const SOLVED = [0, 1, 2, 3, 4, 5, 6, 7, 8]
const { maxMoves, minDistance, maxDistance } = TUNING.assemble

function neighbours(pos: number): number[] {
  const row = Math.floor(pos / SIZE)
  const col = pos % SIZE
  const out: number[] = []
  if (row > 0) out.push(pos - SIZE)
  if (row < SIZE - 1) out.push(pos + SIZE)
  if (col > 0) out.push(pos - 1)
  if (col < SIZE - 1) out.push(pos + 1)
  return out
}

/** A random board whose shortest solution is minDistance–maxDistance moves. Walking outward
 *  from the solved board (breadth-first) means it is always solvable, and never too hard. */
function shuffledBoard(): number[] {
  const seen = new Set<string>([SOLVED.join('')])
  const pools: number[][][] = []
  let frontier = [SOLVED]
  for (let depth = 1; depth <= maxDistance; depth++) {
    const next: number[][] = []
    for (const board of frontier) {
      const gap = board.indexOf(GAP)
      for (const n of neighbours(gap)) {
        const b = board.slice()
        b[gap] = b[n]
        b[n] = GAP
        const id = b.join('')
        if (!seen.has(id)) {
          seen.add(id)
          next.push(b)
        }
      }
    }
    frontier = next
    if (depth >= minDistance) pools.push(next)
  }
  const pool = pools[Math.floor(Math.random() * pools.length)]
  return pool[Math.floor(Math.random() * pool.length)]
}

const ARROW_FROM: Record<string, number> = { ArrowUp: SIZE, ArrowDown: -SIZE, ArrowLeft: 1, ArrowRight: -1 }

export default function Assemble({ onWin }: { onWin: () => void }) {
  const [board, setBoard] = useState(shuffledBoard)
  const [moves, setMoves] = useState(0)
  const [numbers, setNumbers] = useState(true)
  const [state, setState] = useState<'play' | 'won' | 'lost'>('play')
  const timer = useRef<number>()
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const newBoard = useCallback(() => {
    window.clearTimeout(timer.current)
    setBoard(shuffledBoard())
    setMoves(0)
    setState('play')
  }, [])

  const slide = useCallback(
    (pos: number) => {
      if (state !== 'play') return
      const gap = board.indexOf(GAP)
      if (!neighbours(gap).includes(pos)) return
      const b = board.slice()
      b[gap] = b[pos]
      b[pos] = GAP
      const m = moves + 1
      setBoard(b)
      setMoves(m)
      if (b.every((piece, i) => piece === i)) {
        setState('won')
        timer.current = window.setTimeout(onWin, 900)
      } else if (m >= maxMoves) {
        setState('lost')
        timer.current = window.setTimeout(newBoard, 2200)
      }
    },
    [board, moves, state, onWin, newBoard],
  )

  // Arrow keys slide the piece next to the gap into it (↑ moves the piece below the gap up).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const d = ARROW_FROM[e.key]
      if (d === undefined) return
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      e.preventDefault()
      const gap = board.indexOf(GAP)
      const from = gap + d
      if (from < 0 || from >= SIZE * SIZE) return
      if (Math.abs(d) === 1 && Math.floor(from / SIZE) !== Math.floor(gap / SIZE)) return
      slide(from)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [board, slide])

  const gap = board.indexOf(GAP)
  const movable = new Set(neighbours(gap))

  return (
    <div className="r1-assemble">
      <div className={`r1-board${state === 'won' ? ' is-solved' : ''}`} role="group" aria-label="Sliding puzzle">
        {/* one element per piece (fixed order) so a slide animates instead of re-mounting */}
        {SOLVED.slice(0, 8).map((piece) => {
          const pos = board.indexOf(piece)
          return (
            <button
              key={piece}
              type="button"
              className={`r1-piece${movable.has(pos) ? ' can-move' : ''}`}
              style={{
                transform: `translate(${(pos % SIZE) * 100}%, ${Math.floor(pos / SIZE) * 100}%)`,
                backgroundPosition: `${(piece % SIZE) * 50}% ${Math.floor(piece / SIZE) * 50}%`,
              }}
              onClick={() => slide(pos)}
              aria-label={`Piece ${piece + 1}${movable.has(pos) ? ', next to the gap' : ''}`}
            >
              {numbers && <span className="r1-piece-num">{piece + 1}</span>}
            </button>
          )
        })}
        {state === 'won' && (
          <span
            className="r1-piece r1-piece-last"
            style={{ transform: 'translate(200%, 200%)', backgroundPosition: '100% 100%' }}
            aria-hidden="true"
          />
        )}
      </div>

      <div className="r1-side">
        <p className="r1-side-label">Goal</p>
        <img src="/banner.jpg" alt="The finished VibeCraft poster" className="r1-goal" />
        <p className={`r1-counter${maxMoves - moves <= 10 ? ' is-low' : ''}`}>
          Moves <strong>{moves}</strong> / {maxMoves}
        </p>
        <label className="r1-check">
          <input type="checkbox" checked={numbers} onChange={(e) => setNumbers(e.target.checked)} />
          Show piece numbers
        </label>
        <button type="button" className="btn ghost r1-small-btn" onClick={newBoard} disabled={state === 'won'}>
          ↻ New board
        </button>
      </div>

      <p className="r1-msg" role="status">
        {state === 'lost'
          ? `Out of moves! Here comes a fresh board. You've got this.`
          : state === 'won'
            ? '🎉 Poster rebuilt!'
            : ''}
      </p>
    </div>
  )
}
