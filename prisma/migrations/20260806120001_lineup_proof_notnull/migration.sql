-- Round-66 — proofImageUrls is a non-nullable scalar list (empty by default).
UPDATE "match_block_lineups" SET "proofImageUrls" = ARRAY[]::TEXT[] WHERE "proofImageUrls" IS NULL;
ALTER TABLE "match_block_lineups" ALTER COLUMN "proofImageUrls" SET NOT NULL;
ALTER TABLE "match_block_lineups" ALTER COLUMN "proofImageUrls" SET DEFAULT ARRAY[]::TEXT[];
