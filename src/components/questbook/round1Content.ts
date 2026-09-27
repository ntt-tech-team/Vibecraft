import type { Brief, PhaseContent } from './types'

// Round 1's brief and Phase 1 are public: they ship with the site. Phase 2 (and all of Round 2)
// is secret and comes from Supabase only after the organiser reveals it — see
// supabase/problem_statements.sql. Never put Phase 2 text in this repo: it's public.

export const ROUND1_BRIEF: Brief = {
  title: 'The Attendance Predictor',
  scenario:
    "College students are constantly stressing about their attendance. Even though existing college portals show how many classes they have attended and how many classes they were absent, they often lose track of how many classes they have to actually attend. Existing systems do not tell students how many classes they must attend to maintain attendance above 90%, to recover from the detention zone (75%), or to prevent falling into detention. By the time they check their portal, it's often too late, and they fall below the mandatory 75% mark.",
  challenge:
    'Build a smart attendance dashboard that helps students plan their upcoming classes without risking detention. Take the scenario of a college where the semester started on 29th August 2026 and ends on 29th November 2026. You will be provided with the full semester timetables for 10 different class sections.',
}

export const ROUND1_PHASE1: PhaseContent = {
  title: 'The Core Calculator',
  intro:
    "Design a website where a student can select their specific class section and enter their current attendance percentage for their subjects. The website must figure out today's date (and also ask the user for a preferred future date for planning) and calculate:",
  items: [
    { text: 'How many total classes are left in the semester?' },
    { text: 'Exactly how many of those remaining classes the student must attend to stay out of the danger zone.' },
    { text: 'If applicable, how many classes they must attend to maintain attendance above 90% or reach 90%.' },
    {
      label: 'The Warning System:',
      text: 'If a student\'s attendance is so low that it is mathematically impossible to recover before November, the website must loudly warn them with an "Irreversible Detention" alert.',
    },
  ],
}
