import { Link } from 'react-router-dom'
import WorldBackground from '../components/WorldBackground'

/** Shown for any address the site doesn't have (instead of a blank page). */
export default function NotFound() {
  return (
    <div className="round-page">
      <WorldBackground world="overworld" />
      <header className="site">
        <nav className="nav">
          <Link to="/" className="brand">
            <span className="block-icon" aria-hidden="true" />
            VIBECRAFT
          </Link>
        </nav>
      </header>
      <main className="round-main">
        <div className="round-card">
          <p className="round-eyebrow" style={{ color: 'var(--torch-light)' }}>
            404 · PAGE NOT FOUND
          </p>
          <h1>This page doesn't exist</h1>
          <p>Maybe a creeper blew it up. Check the address, or head back to the start.</p>
          <Link to="/" className="btn torch round-cta">
            ← Back to VibeCraft
          </Link>
        </div>
      </main>
    </div>
  )
}
