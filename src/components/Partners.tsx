const PARTNERS = [
  'SRM Institute of Science & Technology, Tiruchirappalli',
  "YUVA'26",
  'Neuro Tech Titans',
  "Institution's Innovation Council",
]

export default function Partners() {
  return (
    <section className="partners">
      <div className="wrap">
        <p className="label">Presented alongside</p>
        <div className="partner-row">
          {PARTNERS.map((p) => (
            <span className="partner-badge" key={p}>
              {p}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
