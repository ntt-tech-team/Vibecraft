import { ROUND1_SUBMIT_URL } from '../../config'
import { fetchRound1, usePhase2 } from './api'
import QuestBook from './QuestBook'
import { ROUND1_BRIEF, ROUND1_PHASE1 } from './round1Content'

/** Round 1's Quest Book: Phase 1 ships with the site; Phase 2 arrives once the organiser reveals it. */
export default function Round1Book() {
  const { revealed, phase2, justRevealed } = usePhase2(fetchRound1)
  return (
    <QuestBook
      round={1}
      world="overworld"
      brief={ROUND1_BRIEF}
      phase1={ROUND1_PHASE1}
      datasetNote="first"
      revealed={revealed}
      phase2={phase2}
      justRevealed={justRevealed}
      submitUrl={ROUND1_SUBMIT_URL}
      submitLabel="Submit Round 1"
    />
  )
}
