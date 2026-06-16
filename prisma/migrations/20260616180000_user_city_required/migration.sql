-- Location is now required on every user (city is the app's top-level content
-- filter). Backfill any user missing a city to the home city (Da Nang), then
-- enforce NOT NULL. The COALESCE keeps this portable: home city by name, else
-- any city.
UPDATE "users"
SET "cityId" = COALESCE(
  (SELECT "id" FROM "cities" WHERE "name" = 'Da Nang' LIMIT 1),
  (SELECT "id" FROM "cities" LIMIT 1)
)
WHERE "cityId" IS NULL;

ALTER TABLE "users" ALTER COLUMN "cityId" SET NOT NULL;
