// The problem-statement text, as stored in public.ps_content (see supabase/problem_statements.sql).

export interface PsItem {
  label?: string // bold lead-in, e.g. "The Warning System:"
  text: string
}

export interface PhaseContent {
  title: string
  intro?: string
  items: PsItem[]
}

export interface Brief {
  title: string
  scenario: string
  challenge: string
}

export type BookWorld = 'overworld' | 'nether'

/** What the page knows about Phase 2: `revealed` is null until the first answer arrives. */
export interface Phase2Info {
  revealed: boolean | null
  phase2: PhaseContent | null
}
