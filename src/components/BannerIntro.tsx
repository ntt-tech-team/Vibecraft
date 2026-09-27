import { useEffect, useRef, useState } from 'react'

/**
 * Intro: the event poster STRETCH-FILLED to cover the whole viewport (edge to edge, the full
 * poster — logos, title, characters, bottom strip — all visible, no gaps on any side), that
 * dissolves block-by-block (top rows first) as you scroll and re-assembles on the way back up.
 *
 * At rest the poster is painted with ONE drawImage call (no internal tile boundaries), so there
 * are ZERO seams. The tile grid only appears once the dissolve is actually in progress.
 * A small "Scroll / Swipe up to continue" hint sits on the resting poster and fades out as the scroll begins.
 * Skipped entirely for reduced-motion users.
 */

// fractions of the poster HEIGHT to keep (0 / 1 = the whole poster, no crop)
const CROP_TOP = 0
const CROP_BOTTOM = 1

export default function BannerIntro() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  const spacerRef = useRef<HTMLDivElement>(null)
  const hintRef = useRef<HTMLDivElement>(null)
  // phones/tablets get "swipe up", mouse users get "scroll"
  const [touch] = useState(() => window.matchMedia('(pointer: coarse)').matches)

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const canvas = canvasRef.current
    const backdrop = backdropRef.current
    const spacer = spacerRef.current
    const hint = hintRef.current
    if (!canvas || !backdrop || !spacer || !hint) return

    if (reduce) {
      canvas.style.display = 'none'
      backdrop.style.display = 'none'
      spacer.style.display = 'none'
      hint.style.display = 'none'
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = new Image()
    img.src = '/banner.jpg'

    let cols = 12
    let rows = 8
    let introHeight = window.innerHeight
    let imgReady = false
    let dpr = Math.min(window.devicePixelRatio || 1, 2)
    let src = { x: 0, y: 0, w: 0, h: 0 } // cropped source region (px) — full poster by default

    function computeSrc() {
      src = {
        x: 0,
        y: img.height * CROP_TOP,
        w: img.width,
        h: img.height * (CROP_BOTTOM - CROP_TOP),
      }
    }

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      const cw = window.innerWidth
      const ch = window.innerHeight
      canvas!.width = Math.round(cw * dpr)
      canvas!.height = Math.round(ch * dpr)
      canvas!.style.width = cw + 'px'
      canvas!.style.height = ch + 'px'
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      introHeight = ch
      spacer!.style.height = introHeight + 'px'
      cols = Math.max(8, Math.min(26, Math.round(cw / 60)))
      rows = Math.max(6, Math.min(18, Math.round(ch / 60)))
      draw()
    }

    const SWEEP = 0.65
    const SPAN = 0.22

    function draw() {
      const progress = Math.max(0, Math.min(1, window.scrollY / introHeight))

      // the "scroll to continue" hint is only for the poster at rest — gone within the first ~15% of the scroll
      const hintAlpha = Math.max(0, 1 - progress * 6)
      hint!.style.opacity = String(hintAlpha)
      hint!.style.visibility = hintAlpha > 0.02 ? 'visible' : 'hidden'

      if (!imgReady) return
      const cw = window.innerWidth
      const ch = window.innerHeight

      if (progress >= 1) {
        canvas!.style.display = 'none'
        backdrop!.style.display = 'none'
        return
      }
      canvas!.style.display = 'block'
      backdrop!.style.display = 'block'
      backdrop!.style.opacity = String(Math.max(0, 1 - progress * 1.1))
      ctx!.clearRect(0, 0, cw, ch)
      ctx!.globalAlpha = 1

      // At rest (until the dissolve begins) paint the whole poster in ONE call → no seams.
      // Source is stretched to the full viewport (fill), so the banner covers edge-to-edge.
      if (progress <= 0.004) {
        try {
          ctx!.drawImage(img, src.x, src.y, src.w, src.h, 0, 0, cw, ch)
        } catch {
          /* ignore */
        }
        return
      }

      // dissolving: per-tile. Source is mapped with independent x/y scale (fill = stretch).
      const scaleX = src.w / cw
      const scaleY = src.h / ch
      const bw = cw / cols
      const bh = ch / rows

      for (let r = 0; r < rows; r++) {
        const rowFrac = rows > 1 ? r / (rows - 1) : 0
        for (let c = 0; c < cols; c++) {
          const delay = (c % 3) * 0.04 + (r % 2) * 0.02
          const start = rowFrac * SWEEP + delay
          let local = (progress - start) / SPAN
          local = Math.max(0, Math.min(1, local))
          if (local >= 1) continue

          const bx = c * bw
          const by = r * bh
          const sx = src.x + bx * scaleX
          const sy = src.y + by * scaleY
          const sw = bw * scaleX
          const sh = bh * scaleY

          const shrink = 1 - local * 0.85
          // overlap neighbours by ~1px while near-assembled so no seam shows; fades as it shrinks
          const bleed = (1 - local) * 1.0
          const dw = bw * shrink + bleed
          const dh = bh * shrink + bleed
          const dx = bx + (bw - dw) / 2
          const dy = by + (bh - dh) / 2

          ctx!.globalAlpha = 1 - local
          try {
            ctx!.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh)
          } catch {
            /* ignore */
          }
        }
      }
      ctx!.globalAlpha = 1
    }

    let ticking = false
    function onScroll() {
      if (!ticking) {
        ticking = true
        window.requestAnimationFrame(() => {
          draw()
          ticking = false
        })
      }
    }

    img.onload = () => {
      imgReady = true
      computeSrc()
      resize()
    }

    resize()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', resize)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <>
      {/* solid dark fallback behind the canvas (only visible pre-load / mid-dissolve, fades out) */}
      <div
        ref={backdropRef}
        aria-hidden="true"
        style={{ position: 'fixed', inset: 0, zIndex: 99, pointerEvents: 'none', background: '#0B0E1F' }}
      />
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{ position: 'fixed', inset: 0, zIndex: 100, pointerEvents: 'none' }}
      />
      {/* lock-screen style nudge for visitors who don't realise the poster scrolls away */}
      <div ref={hintRef} className="intro-hint-wrap">
        <button
          type="button"
          className={touch ? 'intro-hint is-touch' : 'intro-hint'}
          onClick={() => window.scrollTo({ top: window.innerHeight, behavior: 'smooth' })}
        >
          <svg className="intro-hint-icon" viewBox="0 0 9 5" width="18" height="10" aria-hidden="true" shapeRendering="crispEdges">
            <path
              fill="currentColor"
              transform={touch ? 'matrix(1 0 0 -1 0 5)' : undefined}
              d="M0 0h2v1H0zM7 0h2v1H7zM1 1h2v1H1zM6 1h2v1H6zM2 2h2v1H2zM5 2h2v1H5zM3 3h3v1H3zM4 4h1v1H4z"
            />
          </svg>
          <span className="intro-hint-text">{touch ? 'Swipe up to continue' : 'Scroll to continue'}</span>
        </button>
      </div>
      <div ref={spacerRef} aria-hidden="true" style={{ height: '100vh' }} />
    </>
  )
}
