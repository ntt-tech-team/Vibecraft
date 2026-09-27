import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useReducedMotion, type PanInfo } from 'framer-motion'
import WorldBackground, { type World } from './WorldBackground'

interface RoundCard {
  id: number
  title: string
  sub: string
  world: World
  href: string
}

const ROUNDS: RoundCard[] = [
  { id: 1, title: 'ROUND 1', sub: 'Open to every registered team', world: 'overworld', href: '/round/1' },
  { id: 2, title: 'ROUND 2', sub: 'Unlocks after Round 1', world: 'nether', href: '/round/2' },
  { id: 3, title: 'ROUND 3', sub: 'The grand finale', world: 'end', href: '/round/3' },
]
const N = ROUNDS.length

// visual state per stack depth (0 = front, 1 = middle, 2 = back)
const DEPTH = [
  { y: 0, scale: 1, opacity: 1, zIndex: 30 },
  { y: 28, scale: 0.94, opacity: 0.9, zIndex: 20 },
  { y: 56, scale: 0.88, opacity: 0.72, zIndex: 10 },
]

/**
 * OxygenOS-style stacked "widget" deck: one round card in front, the other two
 * peeking behind. Auto-advances (paused on hover/focus/drag). Click a peeking card
 * to bring it forward; click the front card to open its page. Dots + drag + arrow
 * keys for manual control. Reduced-motion → static, still navigable.
 */
export default function RoundsDeck() {
  const navigate = useNavigate()
  const reduce = useReducedMotion() ?? false
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const wasDrag = useRef(false)

  const next = () => setActive((a) => (a + 1) % N)
  const prev = () => setActive((a) => (a - 1 + N) % N)

  // auto-advance
  useEffect(() => {
    if (reduce || paused) return
    const id = window.setInterval(next, 5000)
    return () => window.clearInterval(id)
  }, [reduce, paused])

  function onCardClick(i: number) {
    if (wasDrag.current) return
    if (i === active) navigate(ROUNDS[i].href)
    else setActive(i)
  }

  function onDragEnd(_e: unknown, info: PanInfo) {
    if (info.offset.x < -60) next()
    else if (info.offset.x > 60) prev()
    setTimeout(() => (wasDrag.current = false), 40)
    setPaused(false)
  }

  return (
    <div
      className="rounds-deck"
      role="group"
      aria-roledescription="carousel"
      aria-label="The three rounds"
      tabIndex={0}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault()
          next()
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault()
          prev()
        } else if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          navigate(ROUNDS[active].href)
        }
      }}
    >
      <div className="deck-stage">
        {ROUNDS.map((r, i) => {
          const depth = (i - active + N) % N
          const d = DEPTH[depth]
          const isFront = depth === 0
          return (
            <motion.div
              key={r.id}
              className={`deck-card world-${r.world}`}
              style={{ transformOrigin: '50% 0%', zIndex: d.zIndex }}
              animate={{ y: d.y, scale: d.scale, opacity: d.opacity }}
              transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 30 }}
              drag={isFront && !reduce ? 'x' : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.35}
              onDragStart={() => {
                wasDrag.current = true
                setPaused(true)
              }}
              onDragEnd={onDragEnd}
              onClick={() => onCardClick(i)}
              role={isFront ? 'link' : 'button'}
              aria-label={isFront ? `Open ${r.title} page` : `Show ${r.title}`}
              aria-hidden={!isFront}
            >
              <WorldBackground world={r.world} fixed={false} />
              <div className="deck-card-inner">
                <span className="deck-label">{r.title}</span>
                <p className="deck-sub">{r.sub}</p>
                {isFront && <span className="deck-open">Open round →</span>}
              </div>
            </motion.div>
          )
        })}
      </div>

      <div className="deck-dots" role="tablist" aria-label="Choose a round">
        {ROUNDS.map((r, i) => (
          <button
            key={r.id}
            className="deck-dot"
            aria-label={r.title}
            aria-current={i === active}
            onClick={() => setActive(i)}
          />
        ))}
      </div>

      <span aria-live="polite" className="sr-only">
        {ROUNDS[active].title} — {ROUNDS[active].sub}
      </span>
    </div>
  )
}
