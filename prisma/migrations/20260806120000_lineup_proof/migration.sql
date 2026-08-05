-- Round-66 — optional proof photo(s) attached to a per-block lineup submission.
ALTER TABLE "match_block_lineups" ADD COLUMN     "proofImageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];
