import CoreTeam from './CoreTeam'

export default function About() {
  return (
    <section className="about">
      <div className="wrap about-grid">
        <div className="about-copy">
          <h2>Not your usual hackathon</h2>
          <p>
            VibeCraft trades the standard hackathon's dead-serious tone for something more fun to
            actually be at. You'll build under a fixed clock, make real prioritisation calls when
            everything feels urgent at once, and pick up efficient AI-assisted building along the way —
            all while it stays light enough that people actually show up wanting to build.
          </p>
          <p>Technical skill matters, but so does how you handle the pressure. Both get evaluated.</p>
        </div>
        <CoreTeam />
      </div>
    </section>
  )
}
