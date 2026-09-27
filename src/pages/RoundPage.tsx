import { Link, useParams } from 'react-router-dom'
import WorldBackground, { type World } from '../components/WorldBackground'
import Round2Gate from '../components/Round2Gate'
import Round1Book from '../components/questbook/Round1Book'
import { REGISTER_FORM_URL, ROUND2_SUBMIT_URL, ROUND3_PPT_URL } from '../config'
import NotFound from './NotFound'

function FormCta({ url, label }: { url: string; label: string }) {
  if (!url || url === 'REPLACE_ME') {
    return (
      <button className="btn torch round-cta" disabled>
        {label} — coming soon
      </button>
    )
  }
  return (
    <a className="btn torch round-cta" href={url} target="_blank" rel="noopener noreferrer">
      {label}
    </a>
  )
}

export default function RoundPage() {
  const { id } = useParams()
  if (id !== '1' && id !== '2' && id !== '3') return <NotFound />
  const round = id === '2' ? 2 : id === '3' ? 3 : 1
  const world: World = round === 1 ? 'overworld' : round === 2 ? 'nether' : 'end'
  const eyebrowColor =
    round === 1 ? 'var(--grass-light)' : round === 2 ? 'var(--torch-light)' : 'var(--ender-light)'
  const eyebrow = round === 1 ? 'OVERWORLD · ROUND 1' : round === 2 ? 'NETHER · ROUND 2' : 'THE END · ROUND 3'

  return (
    <div className="round-page">
      <WorldBackground world={world} />

      <header className="site">
        <nav className="nav">
          <Link to="/" className="brand">
            <span className="block-icon" aria-hidden="true" />
            VIBECRAFT
          </Link>
          <a
            href={REGISTER_FORM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn torch nav-cta"
          >
            Mark Attendance
          </a>
        </nav>
      </header>

      <main className="round-main">
        <div className={round === 3 ? 'round-card' : 'round-card round-card--wide'}>
          <p className="round-eyebrow" style={{ color: eyebrowColor }}>
            {eyebrow}
          </p>

          {round === 1 && (
            <>
              <h1>Round 1 — The Overworld</h1>
              <p>
                Build your solution in two phases. Phase 1 is open now. Phase 2 stays sealed until the
                organisers reveal it, and you submit at the end of Phase 2. The Technical Task and the Fun
                Task earn your team advantage points along the way.
              </p>
              <Round1Book />
              <div className="round-phase">
                <p className="round-eyebrow" style={{ color: 'var(--grass-light)', margin: '0 0 10px' }}>
                  TECHNICAL TASK · THE TRIAL
                </p>
                <p>
                  Three quick games: clear all three as a team before the timer runs out to earn 1
                  advantage point.
                </p>
                <Link to="/round/1/task" className="btn round-cta" style={{ marginTop: 0 }}>
                  Play The Trial →
                </Link>
              </div>
            </>
          )}

          {round === 2 && (
            <>
              <h1>Round 2 — Level Up</h1>
              <p>
                Every team gets the advanced problem statements and moves through multiple build
                stages, with advantage points on the Technical Tasks — and a few surprises built in.
              </p>
              <Round2Gate submitUrl={ROUND2_SUBMIT_URL} />
              <div className="round-phase">
                <p className="round-eyebrow" style={{ color: 'var(--ender-light)', margin: '0 0 10px' }}>
                  PHASE 2 · TECHNICAL TASK
                </p>
                <Link to="/round/2/dragon" className="btn round-cta" style={{ marginTop: 0 }}>
                  Face the Ender Dragon →
                </Link>
              </div>
            </>
          )}

          {round === 3 && (
            <>
              <h1>Round 3 — The Finale</h1>
              <p>
                Submit your final working prototype as a presentation and present it live. Like the
                reality shows, strong performance in earlier rounds earns you an edge here too — this
                is where VibeCraft Season 1 crowns its winner.
              </p>
              <FormCta url={ROUND3_PPT_URL} label="Submit your PPT" />
            </>
          )}

          <div>
            <Link to="/" className="round-back">
              ← Back to VibeCraft
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
