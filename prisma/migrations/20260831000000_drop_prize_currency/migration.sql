-- Round-83 — drop Competition.currency; the prize is free text now.
--
-- The column only ever existed to label the prize, and since prizePool became
-- free text the separate picker was redundant — an organizer who wants to say
-- "10,000,000 VND" (or "$500", or "5M + trophy") just types it.
--
-- Fold the currency into the prize first so no existing competition loses its
-- unit. Only values that read as a bare amount get the suffix: anything the
-- organizer already worded themselves is left exactly as typed. Bare amounts
-- also gain thousands separators here, because once the string stops being
-- purely numeric formatPrize() renders it verbatim.
UPDATE "competitions"
SET "prizePool" =
      regexp_replace(
        trim(to_char(
          replace(replace("prizePool", ',', ''), ' ', '')::numeric,
          'FM999,999,999,999,990.99'
        )),
        '\.$', ''
      ) || ' ' || "currency"
WHERE "prizePool" IS NOT NULL
  AND btrim("prizePool") <> ''
  AND "prizePool" ~ '^[0-9][0-9,[:space:]]*(\.[0-9]+)?$'
  AND "currency" IS NOT NULL
  AND btrim("currency") <> '';

ALTER TABLE "competitions" DROP COLUMN "currency";
