import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { ITEMS, Pixel, type ItemId } from '../sprites'
import { TUNING } from '../tuning'

// Stage 2 · Memory: 4×4 cards, 8 pairs of items. One move = one pair flipped.

const { maxMoves, mismatchMs } = TUNING.memory
const IDS = Object.keys(ITEMS) as ItemId[]
const COLS = 4

function newDeck(): ItemId[] {
  const deck = [...IDS, ...IDS]
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }
  return deck
}

const ARROW_STEP: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -COLS, ArrowDown: COLS }

export default function Memory({ onWin }: { onWin: () => void }) {
  const [deck, setDeck] = useState(newDeck)
  const [up, setUp] = useState<number[]>([]) // face up but not matched yet (0–2 cards)
  const [matched, setMatched] = useState<number[]>([])
  const [moves, setMoves] = useState(0)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const timers = useRef<number[]>([])
  const cards = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => {
    cards.current[0]?.focus({ preventScroll: true })
    const list = timers.current
    return () => list.forEach((t) => window.clearTimeout(t))
  }, [])

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms))
  }

  function reset() {
    setDeck(newDeck())
    setUp([])
    setMatched([])
    setMoves(0)
    setBusy(false)
    setMsg('')
  }

  function lose() {
    setBusy(true)
    setMsg('Out of moves! Reshuffling the cards…')
    later(reset, 2200)
  }

  function flip(i: number) {
    if (busy || matched.includes(i) || up.includes(i)) return
    if (up.length === 0) {
      setUp([i])
      return
    }
    const first = up[0]
    const m = moves + 1
    setMoves(m)
    if (deck[first] === deck[i]) {
      const now = [...matched, first, i]
      setMatched(now)
      setUp([])
      if (now.length === deck.length) {
        setBusy(true)
        setMsg('🎉 All pairs found!')
        later(onWin, 900)
      } else if (m >= maxMoves) {
        lose()
      }
    } else {
      setUp([first, i])
      setBusy(true)
      later(() => {
        setUp([])
        setBusy(false)
        if (m >= maxMoves) lose()
      }, mismatchMs)
    }
  }

  function onGridKey(e: KeyboardEvent<HTMLDivElement>) {
    const step = ARROW_STEP[e.key]
    const idx = Number((e.target as HTMLElement).dataset.idx)
    if (step === undefined || Number.isNaN(idx)) return
    e.preventDefault()
    const next = idx + step
    if (next < 0 || next >= deck.length) return
    if (Math.abs(step) === 1 && Math.floor(next / COLS) !== Math.floor(idx / COLS)) return
    cards.current[next]?.focus()
  }

  const left = maxMoves - moves

  return (
    <div className="r1-split">
      <div className="r1-cards" role="group" aria-label="Memory cards" onKeyDown={onGridKey}>
        {deck.map((id, i) => {
          const isMatched = matched.includes(i)
          const isUp = isMatched || up.includes(i)
          return (
            <button
              key={i}
              ref={(el) => {
                cards.current[i] = el
              }}
              type="button"
              data-idx={i}
              className={`r1-card${isUp ? ' is-up' : ''}${isMatched ? ' is-matched' : ''}`}
              onClick={() => flip(i)}
              aria-label={isUp ? `${ITEMS[id].name}${isMatched ? ', matched' : ''}` : `Card ${i + 1}, face down`}
            >
              <span className="r1-card-inner">
                <span className="r1-card-face r1-card-back" aria-hidden="true" />
                <span className="r1-card-face r1-card-front" aria-hidden="true">
                  <Pixel art={ITEMS[id].art} className="r1-card-art" />
                  {isMatched && <span className="r1-card-tick">✓</span>}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      <div className="r1-side">
        <p className={`r1-counter${left <= 4 ? ' is-low' : ''}`}>
          Moves <strong>{moves}</strong> / {maxMoves}
        </p>
        <p className="r1-counter">
          Pairs <strong>{matched.length / 2}</strong> / {IDS.length}
        </p>
        <button type="button" className="btn ghost r1-small-btn" onClick={reset} disabled={busy}>
          ↻ Reshuffle
        </button>
        <p className="r1-msg" role="status">
          {msg}
        </p>
      </div>
    </div>
  )
}
