// Every difficulty number for The Trial, in one place. Target: an average first-year team clears
// all three stages in about 12 minutes of the 15-minute window. Limits marked (doc) come from
// the games spec ("Games details t1"); the rest are ours to tune.
export const TUNING = {
  assemble: {
    maxMoves: 60, // (doc)
    // The shuffle is picked so its shortest solution is this many moves (random boards need ~22).
    minDistance: 10,
    maxDistance: 14,
  },
  memory: {
    maxMoves: 20, // (doc) one move = one pair of cards flipped
    mismatchMs: 900, // how long a wrong pair stays face up
  },
  hunter: {
    hitsNeeded: 10, // (doc)
    seconds: 15, // (doc)
    spawnSlowMs: 1200, // (doc) gap between mobs at the start…
    spawnFastMs: 600, // (doc) …shrinking to this by the end
    staySlowMs: 1100, // how long a mob stays up at the start…
    stayFastMs: 750, // …shrinking to this by the end
    maxMobs: 2, // mobs up at the same time
  },
}
