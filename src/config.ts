// ---- Event configuration ----
// These drive the *fallback* countdown shown before Supabase is wired up (or if it
// is unreachable). Once the live admin timer is running, it takes over the display.
export const EVENT_START = '2026-09-28T09:00:00+05:30' // 9:00 AM IST
export const EVENT_END = '2026-09-28T18:00:00+05:30' // 6:00 PM IST

// Default duration the admin panel pre-fills when starting the timer (editable live).
export const DEFAULT_DURATION_MS = 9 * 60 * 60 * 1000 // 9 hours

// ---- Google Forms ----
export const REGISTER_FORM_URL = 'https://forms.gle/v47byrcnZ6Htpj386' // ① hero + nav button
export const ROUND1_SUBMIT_URL = 'https://forms.gle/U7vuWsGCnpegAN4Z6' // ② Round 1 submission
export const ROUND2_SUBMIT_URL = 'https://forms.gle/oMCE55CrKakjPmVV9' // ③ Round 2 project submission
export const ROUND3_PPT_URL = 'https://forms.gle/gdmK2UYi2wKcfohM8' // ④ Round 3 PPT submission

// ---- Dataset (the 10 class-section timetables, used in Round 1 and Round 2) ----
export const DATASET_URL = 'https://drive.google.com/drive/folders/178oRX8akrUp6eqASCOQ5FafWfJi2RM4t'
