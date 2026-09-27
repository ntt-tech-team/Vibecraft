const FORMAT_TILES = [
  { glyph: '🏫', text: 'Fully offline. All rounds run in person on the 4th floor.' },
  { glyph: '🤖', text: "AI tools are fair game — it's a vibe-coding event. Use what makes you faster." },
  { glyph: '🤝', text: 'Play fair and follow event-day instructions so rounds run on schedule.' },
  { glyph: '⏱️', text: "Submit within the window you're given. Late work may not count." },
]

export default function Rules() {
  return (
    <section id="rules">
      <div className="wrap">
        <div className="section-head">
          <h2>Team &amp; Registration</h2>
          <p>What you need to know before you sign up.</p>
        </div>
        <div className="card-row">
          <div className="pixel-panel card">
            <h3>
              <span className="dot" aria-hidden="true" />
              Team Rules
            </h3>
            <p style={{ margin: '0 0 18px', fontSize: 15, color: '#3d3524' }}>
              Whoever you bring, bring them ready to build — how your team handles the pressure
              matters as much as what you ship.
            </p>
            <ul>
              <li>2–4 members per team — no solo runs, no teams of 5+.</li>
              <li>
                Bring your own device. Laptop, tablet, whatever you build on — the venue doesn't
                supply hardware. Get it charged and your tools installed before Round 1 starts.
              </li>
              <li>
                Technical <em>and</em> non-technical tasks both count toward evaluation. Show up and
                participate in both — sitting one out costs you.
              </li>
            </ul>
            <p className="bonus-note" style={{ marginTop: 18 }}>
              Tip: sort out who's doing what before the clock starts. There's no pause button for
              team huddles once Round 1 begins.
            </p>
          </div>

          <div className="pixel-panel card">
            <h3>
              <span className="dot" aria-hidden="true" />
              Format &amp; Ground Rules
            </h3>
            <div className="format-list">
              {FORMAT_TILES.map((t, i) => (
                <div className="format-item" key={i}>
                  <div className="glyph" aria-hidden="true">{t.glyph}</div>
                  <p>{t.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
