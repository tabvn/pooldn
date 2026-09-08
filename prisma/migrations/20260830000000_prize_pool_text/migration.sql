-- Round-76 — Competition.prizePool becomes free text.
--
-- It was Decimal(18,2), so the column rejected anything that wasn't a bare
-- number — including "10,000,000", which is literally what the input's own
-- placeholder suggests. Organizers should be able to write the prize the way
-- they say it ("5M + trophy", "Cash + table time").
--
-- Existing values are stored as e.g. 5000000.00. The cast drops an all-zero
-- fraction so they don't start rendering as "5000000.00" now that the display
-- no longer treats the column as a number; a real fraction (3000000.50) is
-- kept verbatim. formatPrize() in lib/utils.ts puts the thousands separators
-- back for values that are still bare numbers.
ALTER TABLE "competitions"
  ALTER COLUMN "prizePool" TYPE TEXT
  USING regexp_replace("prizePool"::text, '\.0+$', '');
