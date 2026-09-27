import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { DATASET_URL } from '../../config'
import type { BookWorld, Brief, PhaseContent } from './types'
import './questbook.css'

// The problem statement as an open book: Phase 1 on the left page, Phase 2 sealed on the right
// (a stone block in the Overworld, an obsidian portal in the Nether) until the organiser
// reveals it from /admin. Then every open screen gets an "Advancement made!" toast and a
// Reveal button; the team's click plays the block-break / portal animation.

interface Props {
  round: 1 | 2
  world: BookWorld
  brief: Brief
  phase1: PhaseContent
  datasetNote: 'first' | 'again'
  revealed: boolean | null
  phase2: PhaseContent | null
  justRevealed: number
  submitUrl: string
  submitLabel: string
}

type Fx = null | 'crack' | 'shatter' | 'portal' | 'portal-out'

const CRACK_MS = 720
const SHATTER_MS = 1500
const PORTAL_MS = 1300
const PORTAL_OUT_MS = 700
const TOAST_MS = 7000

/** A 16×16 pixel-noise tile (seeded, so it's the same on every screen) as a CSS url(). */
function pixelTexture(base: string, palette: string[], weights: number[], seed: number) {
  let s = seed
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647
  const paths: Record<string, string> = {}
  for (let y = 0; y < 16; y++) {
    const row = Array.from({ length: 16 }, () => {
      const r = rnd()
      let acc = 0
      for (let i = 0; i < palette.length; i++) {
        acc += weights[i]
        if (r < acc) return palette[i]
      }
      return base
    })
    for (let x = 0; x < 16; ) {
      let w = 1
      while (x + w < 16 && row[x + w] === row[x]) w++
      if (row[x] !== base) paths[row[x]] = (paths[row[x]] ?? '') + `M${x} ${y}h${w}v1h-${w}z`
      x += w
    }
  }
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' shape-rendering='crispEdges'>` +
    `<rect width='16' height='16' fill='${base}'/>` +
    Object.entries(paths)
      .map(([c, d]) => `<path fill='${c}' d='${d}'/>`)
      .join('') +
    `</svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

const TEXTURES = {
  '--qb-stone': pixelTexture('#7F7F7F', ['#6E6E6E', '#8E8E8E', '#747474', '#666666'], [0.16, 0.14, 0.14, 0.05], 7),
  '--qb-obsidian': pixelTexture('#140C1F', ['#1E1230', '#0B0612', '#2E1C4A', '#3B2466'], [0.2, 0.2, 0.08, 0.03], 11),
} as CSSProperties

function lsGet(k: string) {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}
function lsSet(k: string, v: string | null) {
  try {
    if (v === null) localStorage.removeItem(k)
    else localStorage.setItem(k, v)
  } catch {
    /* private mode: the team just clicks Reveal again after a refresh */
  }
}

function PixelLock() {
  return (
    <svg className="qb-lock" viewBox="0 0 10 12" shapeRendering="crispEdges" aria-hidden="true">
      <path fill="#1B140C" d="M2 0h6v1H2zM1 1h1v4H1zM8 1h1v4H8zM0 4h10v8H0z" />
      <path fill="#C9C9C9" d="M3 1h4v1H3zM2 2h1v3H2zM7 2h1v3H7z" />
      <rect x="1" y="5" width="8" height="6" fill="#E0A526" />
      <rect x="1" y="5" width="8" height="1" fill="#F5CC5C" />
      <rect x="1" y="10" width="8" height="1" fill="#A8741A" />
      <path fill="#3A2A0A" d="M4 7h2v1H4zM4.5 8h1v2h-1z" />
    </svg>
  )
}

function PhaseBody({ n, phase }: { n: 1 | 2; phase: PhaseContent }) {
  return (
    <>
      <p className="qb-kicker">Phase {n}</p>
      <h2 className="qb-title">{phase.title}</h2>
      {phase.intro && <p className="qb-intro">{phase.intro}</p>}
      <ul className="qb-list">
        {phase.items.map((it, i) => (
          <li key={i}>
            {it.label && <strong>{it.label} </strong>}
            {it.text}
          </li>
        ))}
      </ul>
    </>
  )
}

export default function QuestBook(props: Props) {
  const { round, world, brief, phase1, datasetNote, revealed, phase2, justRevealed, submitUrl, submitLabel } = props
  const storeKey = `vc26_ps_r${round}_open`
  const [opened, setOpened] = useState(() => lsGet(storeKey) === '1')
  const [fx, setFx] = useState<Fx>(null)
  const [toast, setToast] = useState(false)
  const timers = useRef<number[]>([])
  const pageRef = useRef<HTMLElement>(null)

  const ready = revealed === true && phase2 !== null
  const showContent = ready && opened

  // Sealed again from /admin (e.g. after a test run): forget this laptop's earlier click.
  useEffect(() => {
    if (revealed === false && opened) {
      setOpened(false)
      lsSet(storeKey, null)
    }
  }, [revealed, opened, storeKey])

  // The organiser revealed Phase 2 while this page was open → toast.
  useEffect(() => {
    if (!justRevealed) return
    setToast(true)
    const id = window.setTimeout(() => setToast(false), TOAST_MS)
    return () => window.clearTimeout(id)
  }, [justRevealed])

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), [])

  // Shards for the block-break: 6 × 4 pieces, each falling its own way.
  const shards = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => ({
        left: `${(i % 6) * (100 / 6)}%`,
        top: `${Math.floor(i / 6) * 25}%`,
        dx: `${Math.round((Math.random() - 0.5) * 140)}px`,
        rot: `${Math.round((Math.random() - 0.5) * 120)}deg`,
        delay: `${(Math.random() * 0.25).toFixed(2)}s`,
      })),
    [],
  )

  function open() {
    setOpened(true)
    lsSet(storeKey, '1')
  }

  function reveal() {
    setToast(false)
    const later = (ms: number, f: () => void) => timers.current.push(window.setTimeout(f, ms))
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      open()
      return
    }
    if (world === 'overworld') {
      setFx('crack')
      later(CRACK_MS, () => {
        open()
        setFx('shatter')
      })
      later(CRACK_MS + SHATTER_MS, () => setFx(null))
    } else {
      setFx('portal')
      later(PORTAL_MS, () => {
        open()
        setFx('portal-out')
      })
      later(PORTAL_MS + PORTAL_OUT_MS, () => setFx(null))
    }
  }

  const sealInner = (
    <div className="qb-seal-plate">
      <PixelLock />
      {ready ? (
        <>
          <p className="qb-seal-title">Phase 2 is ready</p>
          <button type="button" className="btn torch qb-reveal" onClick={reveal} disabled={fx !== null}>
            Reveal Phase 2
          </button>
        </>
      ) : (
        <>
          <p className="qb-seal-title">Sealed</p>
          <p className="qb-seal-text">Phase 2 opens when the organisers reveal it.</p>
        </>
      )}
    </div>
  )

  let seal = null
  if (world === 'overworld') {
    if (fx === 'shatter') {
      seal = (
        <div className="qb-shards" aria-hidden="true">
          {shards.map((s, i) => (
            <span
              key={i}
              style={{ left: s.left, top: s.top, animationDelay: s.delay, '--dx': s.dx, '--rot': s.rot } as CSSProperties}
            />
          ))}
        </div>
      )
    } else if (!showContent) {
      seal = (
        <div className={`qb-seal qb-seal--stone${fx === 'crack' ? ' is-cracking' : ''}`}>
          <svg className="qb-cracks" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <path d="M50 50 L44 40 L46 26 L38 12" />
            <path d="M50 50 L62 45 L71 32 L88 27 M50 50 L57 63 L54 79 L62 95" />
            <path d="M50 50 L35 56 L23 52 L7 61 M46 26 L30 22 M71 32 L77 13" />
            <path d="M35 56 L31 73 L19 89 M57 63 L75 70 L93 81 M23 52 L15 36" />
          </svg>
          {sealInner}
        </div>
      )
    }
  } else if (!showContent || fx === 'portal-out') {
    seal = (
      <div className={`qb-seal qb-seal--portal${fx === 'portal' ? ' is-lit' : ''}${fx === 'portal-out' ? ' is-out' : ''}`}>
        <div className="qb-portal">{fx === null && sealInner}</div>
      </div>
    )
  }

  const datasetLink = (
    <a className="qb-dl" href={DATASET_URL} target="_blank" rel="noopener noreferrer">
      Download dataset
    </a>
  )

  return (
    <div className={`qb qb--${world}`} style={TEXTURES}>
      <section className="qb-brief" aria-labelledby={`qb-brief-${round}`}>
        <p className="qb-brief-kicker">Problem statement</p>
        <h2 className="qb-brief-title" id={`qb-brief-${round}`}>
          {brief.title}
        </h2>
        <div className="qb-brief-grid">
          <div>
            <h3>The Scenario</h3>
            <p>{brief.scenario}</p>
          </div>
          <div>
            <h3>Your Challenge</h3>
            <p>{brief.challenge}</p>
          </div>
        </div>
      </section>

      <div className="qb-book">
        <section className="qb-page qb-page--left" aria-label="Phase 1">
          <PhaseBody n={1} phase={phase1} />
          <p className="qb-note">
            <strong>Dataset:</strong>{' '}
            {datasetNote === 'first' ? (
              <>You'll need the timetables for all 10 class sections to build this. {datasetLink} from Google Drive.</>
            ) : (
              <>
                This is the same dataset you downloaded in Phase 1 of Round 1: the timetables for all 10 class sections.{' '}
                {datasetLink} again from Google Drive if you need it.
              </>
            )}
          </p>
          <span className="qb-folio" aria-hidden="true">1</span>
        </section>

        <section className="qb-page qb-page--right" aria-label="Phase 2" ref={pageRef}>
          {showContent && phase2 && (
            <div className={fx ? 'qb-appear' : undefined}>
              <PhaseBody n={2} phase={phase2} />
              <div className="qb-rule">
                <p className="qb-rule-title">Final submission rule</p>
                <p>
                  All features and interfaces built across the various rounds must be integrated into a single, unified web
                  application. For the finale, teams must submit <strong>one live deployment link</strong> that contains all
                  functionalities functioning together in one place based on user request.
                </p>
              </div>
              {submitUrl && submitUrl !== 'REPLACE_ME' ? (
                <a className="btn torch qb-submit" href={submitUrl} target="_blank" rel="noopener noreferrer">
                  {submitLabel}
                </a>
              ) : (
                <button className="btn torch qb-submit" disabled>
                  {submitLabel}: coming soon
                </button>
              )}
            </div>
          )}
          {seal}
          <span className="qb-folio" aria-hidden="true">2</span>
        </section>
      </div>

      {/* portalled: .round-card's backdrop-filter would otherwise trap position:fixed inside the card */}
      {createPortal(
        <div className="qb-toast-slot" aria-live="polite">
          {toast && (
            <button
              type="button"
              className="qb-toast"
              onClick={() => {
                setToast(false)
                pageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
              }}
            >
              <span className="qb-toast-icon" aria-hidden="true" />
              <span>
                <span className="qb-toast-title">Advancement made!</span>
                <span className="qb-toast-text">Phase 2 revealed</span>
              </span>
            </button>
          )}
        </div>,
        document.body,
      )}
    </div>
  )
}
