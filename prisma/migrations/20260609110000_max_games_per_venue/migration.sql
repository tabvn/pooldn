ALTER TABLE "competitions"
  ADD COLUMN IF NOT EXISTS "maxGamesPerVenuePerMatchday" INTEGER;
