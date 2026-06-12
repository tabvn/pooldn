-- Round-58 · "Fixed Match Day(s)" scheduling — explicit ISO date list the
-- organizer picks on the Schedule tab. JSONB array of "YYYY-MM-DD" strings.

ALTER TABLE "competitions"
  ADD COLUMN IF NOT EXISTS "fixedMatchDates" JSONB;
