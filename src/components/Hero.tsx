import { Suspense } from 'react'
import { motion } from 'framer-motion'
import { useTimer } from '../hooks/useTimer'
import { REGISTER_FORM_URL } from '../config'
import { lazyPage } from '../lib/lazyPage'

const VoxelDiorama = lazyPage(() => import('./VoxelDiorama'))

const rise = {
  hidden: { opacity: 0, y: 14 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: 0.05 + i * 0.09, ease: 'easeOut' as const },
  }),
}

export default function Hero() {
  const { view, label, source } = useTimer()

  return (
    <section className="hero">
      <div className="wrap hero-inner">
        <motion.div
          className="hero-panel"
          initial="hidden"
          animate="show"
        >
          <motion.p className="hero-eyebrow" custom={0} variants={rise}>
            NTT presents · YUVA'26
          </motion.p>
          <motion.h1 custom={1} variants={rise}>
            VIBECRAFT
          </motion.h1>
          <motion.p className="hero-tagline" custom={2} variants={rise}>
            Every block holds a new challenge. A hackathon that skips the dead-serious tone — sharp
            time pressure, real prioritisation calls, and hands-on vibe-coding with AI tools.
          </motion.p>

          <motion.div className="hero-meta" custom={3} variants={rise}>
            <div className="meta-chip">📅 28 September 2026</div>
            <div className="meta-chip">📍 4th Floor</div>
            <div className="meta-chip">👥 Teams of 2–4</div>
          </motion.div>

          <motion.div className="hero-ctas" custom={4} variants={rise}>
            <a href={REGISTER_FORM_URL} target="_blank" rel="noopener noreferrer" className="btn torch">
              Mark Attendance
            </a>
            <a href="#rules" className="btn ghost">
              See the rules
            </a>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.25, ease: 'easeOut' }}
        >
          <Suspense fallback={<div style={{ height: 'clamp(320px, 60vw, 460px)' }} aria-hidden />}>
            <VoxelDiorama view={view} label={label} live={source === 'live'} />
          </Suspense>
        </motion.div>
      </div>
    </section>
  )
}
