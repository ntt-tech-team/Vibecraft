import { useState, type FormEvent } from 'react'
import { normalizeTeamKey } from '../../lib/teamKey'
import { post, UNREACHABLE, type R1Status } from './api'

// Register a team (one member, once, for the whole day) or join it with the team key.
// Registration goes through /api/dragon so the Dragon in Round 2 uses the same key.

export default function TeamGate({
  registrationOpen,
  onJoined,
}: {
  registrationOpen: boolean
  onJoined: (key: string) => void
}) {
  const [name, setName] = useState('')
  const [joinKey, setJoinKey] = useState('')
  const [created, setCreated] = useState<{ name: string; key: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [setupMsg, setSetupMsg] = useState('')
  const [joinMsg, setJoinMsg] = useState('')

  async function setup(e: FormEvent) {
    e.preventDefault()
    if (!window.confirm(`Register your team as "${name.trim()}"?\n\nThis name can't be changed later, and it's used for every round.`)) return
    setBusy(true)
    setSetupMsg('')
    const res = await post<{ team: { name: string }; key: string }>('/api/dragon', { action: 'setup', name })
    setBusy(false)
    if (res.key && res.team) {
      setCreated({ name: res.team.name, key: res.key })
      return
    }
    const err = res.error
    setSetupMsg(
      err === 'name_taken'
        ? 'That team name is already registered. If a teammate did it, ask them for the team key and join on the right. If not, ask an organiser.'
        : err === 'registration_closed'
          ? 'Team registration is closed. Join with your team key, or ask an organiser.'
          : err === 'bad_name'
            ? 'Use 2–40 characters, including at least two letters or numbers.'
            : err === 'team_limit'
              ? 'Team registration is full. Ask an organiser.'
              : UNREACHABLE,
    )
  }

  async function join(e: FormEvent) {
    e.preventDefault()
    const k = normalizeTeamKey(joinKey)
    if (!k) return
    setBusy(true)
    setJoinMsg('')
    const res = await post<R1Status>('/api/round1', { action: 'status', key: k })
    setBusy(false)
    if (res.team) onJoined(k)
    else setJoinMsg(res.error ? UNREACHABLE : "That key doesn't match any team. Check it with your teammate.")
  }

  if (created) {
    return (
      <div className="r1-card-panel r1-created">
        <p className="r1-label">Team registered: {created.name}</p>
        <p className="r1-bigkey">{created.key}</p>
        <p>
          📝 <strong>Write this team key down now.</strong> Your teammates type it under “Join your team” to play on
          their own laptops, and your team uses the same key in every round, including Round 2. Keep it inside your
          team.
        </p>
        <button type="button" className="btn torch" onClick={() => onJoined(created.key)}>
          I've written it down. Continue →
        </button>
      </div>
    )
  }

  return (
    <div className="r1-gate">
      {registrationOpen ? (
        <form className="r1-card-panel" onSubmit={setup}>
          <h2 className="r1-h2">Register your team</h2>
          <p className="r1-warn">⚠ Only ONE member registers, once. Everyone else joins with the team key.</p>
          <label htmlFor="r1-team-name" className="r1-label">
            Team name (as registered for VibeCraft)
          </label>
          <input
            id="r1-team-name"
            className="r1-input"
            value={name}
            maxLength={40}
            autoComplete="off"
            onChange={(e) => setName(e.target.value)}
          />
          <p className="r1-small">The name can't be changed later. It stays the same for every round.</p>
          <button className="btn torch" disabled={busy || name.trim().length < 2}>
            Register team
          </button>
          <p className="r1-err" role="status">
            {setupMsg}
          </p>
        </form>
      ) : (
        <div className="r1-card-panel">
          <h2 className="r1-h2">Registration is closed</h2>
          <p className="r1-muted">
            Join with the team key your team got when it registered. Lost it, or never registered? Ask an organiser.
          </p>
        </div>
      )}

      <form className="r1-card-panel" onSubmit={join}>
        <h2 className="r1-h2">Join your team</h2>
        <p className="r1-muted">Enter the team key shown on your teammate's screen.</p>
        <label htmlFor="r1-join-key" className="r1-label">
          Team key
        </label>
        <input
          id="r1-join-key"
          className="r1-input r1-mono"
          value={joinKey}
          placeholder="CREEPER-123456"
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => setJoinKey(e.target.value)}
        />
        <button className="btn" disabled={busy || !joinKey.trim()}>
          Join
        </button>
        <p className="r1-err" role="status">
          {joinMsg}
        </p>
      </form>
    </div>
  )
}
