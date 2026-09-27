// Vercel Function: /api/round1. All logic lives in server/round1.ts (also used by `npm run dev`).
import { handleRound1 } from '../server/round1.js'

export function GET(request: Request) {
  return handleRound1(request, process.env)
}

export function POST(request: Request) {
  return handleRound1(request, process.env)
}
