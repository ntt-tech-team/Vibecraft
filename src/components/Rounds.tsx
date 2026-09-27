import RoundsDeck from './RoundsDeck'
import RoundsBackground from './RoundsBackground'

export default function Rounds() {
  return (
    <section className="rounds-zone" id="rounds">
      <RoundsBackground />
      <div className="wrap">
        <div className="section-head">
          <h2>The Rounds</h2>
          <p>
            Three rounds, and every team plays all three. Each one unlocks on event day as the
            clock moves.
          </p>
        </div>
        <RoundsDeck />
      </div>
    </section>
  )
}
