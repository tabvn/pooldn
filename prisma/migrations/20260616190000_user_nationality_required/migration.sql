-- Country of origin (nationality) is now required. Backfill any user missing
-- it from their city's country code (every user has a city after the prior
-- migration), then enforce NOT NULL. Fall back to 'VN' if a country code is
-- somehow absent.
UPDATE "users" u
SET "nationality" = co."code"
FROM "cities" c
JOIN "countries" co ON co."id" = c."countryId"
WHERE u."cityId" = c."id" AND u."nationality" IS NULL;

UPDATE "users" SET "nationality" = 'VN' WHERE "nationality" IS NULL;

ALTER TABLE "users" ALTER COLUMN "nationality" SET NOT NULL;
