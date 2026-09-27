import { useEffect, useRef, useState, type FocusEvent, type KeyboardEvent, type PointerEvent } from 'react'

/**
 * NTT core team, drawn as a Minecraft inventory window beside the About copy.
 *
 * One slide per role, in rank order. It advances by itself (the green XP bar is the timer) and pauses while
 * the mouse is over it, keyboard-focused, off-screen or paused by the ⏸ button (which also shows a PAUSED
 * label). Visitors can also use the arrows, tap a hotbar slot, swipe, or press ←/→ (each restarts the
 * timer). No auto-advance for reduced-motion users.
 *
 * Adding a photo: put a 600×800 JPG at public/team/<slug>.jpg and a 96×96 face crop at
 * public/team/thumbs/<slug>.jpg, then set `photo: '<slug>'` on the member below.
 * Members without a photo get a "photo coming soon" frame.
 */

type Member = { name: string; photo?: string }
type Role = { role: string; members: Member[] }

const TEAM: Role[] = [
  { role: 'President', members: [{ name: 'Naren Karthik R', photo: 'naren' }] },
  { role: 'Vice President', members: [{ name: 'R S Hareecharan', photo: 'hareecharan' }] },
  { role: 'Secretary', members: [{ name: 'Mashiga Shri', photo: 'mashiga' }] },
  { role: 'Treasurer', members: [{ name: 'Rasmitha B', photo: 'rashmitha' }] },
  { role: 'Tech Lead', members: [{ name: 'Kishor A', photo: 'kishore' }] },
  { role: 'Social Media Lead', members: [{ name: 'Vishesh U', photo: 'vishesh' }] },
  {
    role: 'Design Leads',
    members: [
      { name: 'Dharshan M R', photo: 'dharshan' },
      { name: 'Harshini Ritikka M K', photo: 'harshini' },
    ],
  },
  {
    role: 'Event Coordinators',
    members: [
      { name: 'Shrikalyan K', photo: 'shree' },
      { name: 'Siva Balan S', photo: 'siva-balan' },
      { name: 'Someshwar J', photo: 'somesh' },
    ],
  },
]

const INTERVAL_MS = 4500
const SWIPE_PX = 40

// bump when photos are replaced under the same file names, so browsers don't keep the cached old ones
const PHOTO_VERSION = 2 // 2 = B/W portraits
const photoSrc = (slug: string) => `/team/${slug}.jpg?v=${PHOTO_VERSION}`
const thumbSrc = (slug: string) => `/team/thumbs/${slug}.jpg?v=${PHOTO_VERSION}`

type Dir = 'next' | 'prev'

export default function CoreTeam() {
  const [index, setIndex] = useState(0)
  const [dir, setDir] = useState<Dir>('next')
  const [userPaused, setUserPaused] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [inView, setInView] = useState(false)
  const [autoplay] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const rootRef = useRef<HTMLDivElement>(null)
  const swipeStart = useRef<number | null>(null)

  const playing = autoplay && !userPaused && !hovered && !focused && inView
  const current = TEAM[index]

  function go(to: number, d: Dir) {
    setDir(d)
    setIndex((to + TEAM.length) % TEAM.length)
  }
  const next = () => go(index + 1, 'next')
  const prev = () => go(index - 1, 'prev')

  // only run the slideshow while the box is actually on screen
  useEffect(() => {
    const el = rootRef.current
    if (!el || !('IntersectionObserver' in window)) {
      setInView(true)
      return
    }
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.35 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // warm the next slide's photos so the switch doesn't flash an empty frame
  useEffect(() => {
    if (!inView) return
    for (const m of TEAM[(index + 1) % TEAM.length].members) {
      if (m.photo) new Image().src = photoSrc(m.photo)
    }
  }, [index, inView])

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      next()
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      prev()
    }
  }

  // pause for keyboard focus only — a mouse click on an arrow shouldn't freeze the slideshow
  function onFocus(e: FocusEvent) {
    try {
      if ((e.target as HTMLElement).matches(':focus-visible')) setFocused(true)
    } catch {
      /* ignore */
    }
  }
  function onBlur(e: FocusEvent) {
    if (!rootRef.current?.contains(e.relatedTarget as Node | null)) setFocused(false)
  }

  function onSwipeStart(e: PointerEvent) {
    swipeStart.current = e.clientX
  }
  function onSwipeEnd(e: PointerEvent) {
    if (swipeStart.current === null) return
    const dx = e.clientX - swipeStart.current
    swipeStart.current = null
    if (Math.abs(dx) >= SWIPE_PX) {
      if (dx < 0) next()
      else prev()
    }
  }

  return (
    <div
      ref={rootRef}
      className="ct"
      role="region"
      aria-roledescription="carousel"
      aria-label="Neuro Tech Titans core team"
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onBlur={onBlur}
      onPointerEnter={(e) => e.pointerType === 'mouse' && setHovered(true)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && setHovered(false)}
    >
      <div className="ct-titlebar">
        <div>
          <h3 className="ct-title">Core Team</h3>
          <span className="ct-sub">Neuro Tech Titans · the crew behind VibeCraft</span>
        </div>
        <div className="ct-meta">
          {autoplay && userPaused && <span className="ct-paused">Paused</span>}
          <span className="ct-counter" aria-hidden="true">
            {index + 1}/{TEAM.length}
          </span>
          {autoplay && (
            <button
              type="button"
              className={userPaused ? 'ct-btn ct-btn-sm is-on' : 'ct-btn ct-btn-sm'}
              onClick={() => setUserPaused((p) => !p)}
              aria-label={userPaused ? 'Play slideshow' : 'Pause slideshow'}
            >
              {userPaused ? <PlayIcon /> : <PauseIcon />}
            </button>
          )}
        </div>
      </div>

      <div
        className="ct-stage"
        onPointerDown={onSwipeStart}
        onPointerUp={onSwipeEnd}
        onPointerCancel={() => (swipeStart.current = null)}
      >
        <div key={index} className={`ct-slide is-${dir}`} data-count={current.members.length}>
          {current.members.map((m) => (
            <figure className="ct-member" key={m.name}>
              <figcaption className="ct-nametag">{m.name}</figcaption>
              <div className="ct-photo">
                {m.photo ? (
                  <img
                    src={photoSrc(m.photo)}
                    alt={m.name}
                    width={600}
                    height={800}
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                  />
                ) : (
                  <div className="ct-placeholder">
                    <HeadIcon />
                    <span>Photo coming soon</span>
                  </div>
                )}
              </div>
            </figure>
          ))}
        </div>
      </div>

      <p className="sr-only" aria-live={playing ? 'off' : 'polite'}>
        {current.role}: {current.members.map((m) => m.name).join(', ')}
      </p>

      <div className="ct-controls">
        <button type="button" className="ct-btn" onClick={prev} aria-label="Previous role">
          <ArrowIcon flip />
        </button>
        <div key={index} className="ct-tooltip" aria-hidden="true">
          {current.role}
        </div>
        <button type="button" className="ct-btn" onClick={next} aria-label="Next role">
          <ArrowIcon />
        </button>
      </div>

      <div className="ct-xp" aria-hidden="true">
        {autoplay && (
          <span
            key={index}
            className="ct-xp-fill"
            style={{ animationDuration: `${INTERVAL_MS}ms`, animationPlayState: playing ? 'running' : 'paused' }}
            onAnimationEnd={(e) => e.target === e.currentTarget && next()}
          />
        )}
      </div>

      <div className="ct-hotbar" role="group" aria-label="Choose a role">
        {TEAM.map((r, i) => {
          const lead = r.members[0]
          return (
            <button
              key={r.role}
              type="button"
              className={i === index ? 'ct-slot is-active' : 'ct-slot'}
              onClick={() => i !== index && go(i, i > index ? 'next' : 'prev')}
              aria-label={`${r.role}: ${r.members.map((m) => m.name).join(', ')}`}
              aria-current={i === index ? 'true' : undefined}
            >
              {lead.photo ? (
                <img src={thumbSrc(lead.photo)} alt="" width={96} height={96} loading="lazy" draggable={false} />
              ) : (
                <HeadIcon />
              )}
              {r.members.length > 1 && (
                <span className="ct-count" aria-hidden="true">
                  {r.members.length}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ArrowIcon({ flip = false }: { flip?: boolean }) {
  return (
    <svg viewBox="0 0 4 7" width="8" height="14" aria-hidden="true" shapeRendering="crispEdges">
      <path
        fill="currentColor"
        transform={flip ? 'matrix(-1 0 0 1 4 0)' : undefined}
        d="M0 0h1v7H0zM1 1h1v5H1zM2 2h1v3H2zM3 3h1v1H3z"
      />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 5 6" width="10" height="12" aria-hidden="true" shapeRendering="crispEdges">
      <path fill="currentColor" d="M0 0h2v6H0zM3 0h2v6H3z" />
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 4 7" width="7" height="12" aria-hidden="true" shapeRendering="crispEdges">
      <path fill="currentColor" d="M0 0h1v7H0zM1 1h1v5H1zM2 2h1v3H2zM3 3h1v1H3z" />
    </svg>
  )
}

// blocky head-and-shoulders silhouette for members without a photo yet
function HeadIcon() {
  return (
    <svg className="ct-head" viewBox="0 0 12 12" aria-hidden="true" shapeRendering="crispEdges">
      <path fill="currentColor" d="M3 0h6v6H3zM1 7h10v5H1z" />
    </svg>
  )
}
